import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import outbox from '../garden-outbox.cjs';

const { queueOutboxEvent, readOutboxEntries } = outbox;

const CONFIG_FILE = 'project-garden-bridge.json';
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const PROJECT_ID = /^[A-Za-z0-9_-]{8,128}$/;

function projectKeyForCurrentCodexProject() {
  // Codex may provide a stable project ID in future/managed environments. If
  // it is not present, the local working directory is the documented Codex
  // project context, so only a one-way hash of that directory crosses the
  // loopback bridge. The path itself and all work content remain local.
  const configuredId = process.env.CODEX_PROJECT_ID;
  if (typeof configuredId === 'string' && PROJECT_ID.test(configuredId)) return `codex:${configuredId}`;
  let root = process.env.CODEX_PROJECT_ROOT || process.cwd();
  if (!process.env.CODEX_PROJECT_ROOT) {
    try {
      // Tasks may be opened in a project subfolder or worktree. For a Git
      // project, the repository root is stable across those task directories.
      root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || root;
    } catch {
      // A non-Git local project still has its configured task directory.
    }
  }
  root = path.resolve(root).replace(/\\/g, '/').toLowerCase();
  return `workspace:${createHash('sha256').update(root).digest('base64url')}`;
}

const PROJECT_KEY = projectKeyForCurrentCodexProject();

function bridgeConfigPath() {
  if (process.env.PROJECT_GARDEN_BRIDGE_PATH) return process.env.PROJECT_GARDEN_BRIDGE_PATH;
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'project-garden-desktop', CONFIG_FILE);
}

function readBridgeConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(bridgeConfigPath(), 'utf8'));
    if (!Number.isInteger(config.port) || config.port < 1 || typeof config.secret !== 'string' || config.secret.length < 32) throw new Error('missing local bridge');
    return config;
  } catch {
    throw new Error('Project Garden is not running yet. Open the desktop app and choose your garden theme first.');
  }
}

function localQueueStatus() {
  const userDataPath = path.dirname(bridgeConfigPath());
  try {
    return { available: true, queuedEvents: readOutboxEntries(userDataPath).length, userDataPath };
  } catch {
    return { available: false, queuedEvents: 0, userDataPath };
  }
}

function postEvent(event) {
  const config = readBridgeConfig();
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(event);
    const request = http.request({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/event',
      method: 'POST',
      timeout: 5500,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'x-project-garden-secret': config.secret,
      },
    }, (response) => {
      let payload = '';
      response.setEncoding('utf8');
      response.on('data', (part) => { payload += part; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(payload);
          if (response.statusCode !== 200 || !parsed.accepted) throw new Error(parsed.error || 'Project Garden did not accept this progress');
          resolve(parsed);
        } catch (problem) {
          reject(problem);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Project Garden did not respond in time')));
    request.on('error', (problem) => reject(new Error(`Could not reach local Project Garden: ${problem.message}`)));
    request.end(body);
  });
}

async function deliverOrQueue(event) {
  try {
    return { ...(await postEvent(event)), queued: false };
  } catch (deliveryProblem) {
    const queue = localQueueStatus();
    if (!queue.available) throw deliveryProblem;
    try {
      const queued = queueOutboxEvent({ userDataPath: queue.userDataPath, event });
      return { accepted: true, ...queued, queued: true };
    } catch (queueProblem) {
      throw new Error(`Project Garden is offline and its local queue could not save this progress: ${queueProblem.message}`);
    }
  }
}

const server = new McpServer({ name: 'project-garden-bridge', version: '0.3.0' });

server.registerTool('project_garden_get_sync_status', {
  title: 'Check Project Garden sync',
  description: 'Check whether the local Project Garden desktop app is open and ready to update this Codex project. This reveals no project name, files, conversation text, or other project content.',
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => {
  const queue = localQueueStatus();
  try {
    const config = readBridgeConfig();
    return {
      structuredContent: { ready: true, activeProjectSelected: Boolean(config.activeProjectId), automaticProjectCreation: config.autoCreate !== false, localQueueAvailable: queue.available, queuedEvents: queue.queuedEvents },
      content: [{ type: 'text', text: config.autoCreate !== false ? 'Project Garden can receive anonymous progress now. If the desktop app closes before delivery, the event will remain in a local queue for its next launch.' : config.activeProjectId ? 'Project Garden is ready to receive anonymous progress.' : 'Open Project Garden and select a project first; an anonymous event can still wait in the local queue.' }],
    };
  } catch (problem) {
    return {
      structuredContent: { ready: false, activeProjectSelected: false, automaticProjectCreation: false, localQueueAvailable: queue.available, queuedEvents: queue.queuedEvents },
      content: [{ type: 'text', text: queue.available ? 'Project Garden is not open, but anonymous progress can be stored in its local queue and applied when the desktop app next opens.' : problem.message }],
    };
  }
});

server.registerTool('project_garden_record_progress', {
  title: 'Record anonymous Project Garden progress',
  description: 'Record only an anonymous progress level for this Codex project in the local Project Garden desktop app. All tasks working in the same Codex project resolve to the same local plant through a one-way local workspace hash; the hash, project name, path, files, and conversation content are never sent outside this computer. If an unimported local Codex project makes eligible progress, the app creates one unnamed project plant. Call only after this turn made a concrete, verifiable project advance. Never send a project name, file name, code, conversation text, URL, person, client, or a prose summary. Use small for one clear action, medium for a coherent slice of work, and milestone only for a meaningful result. Set unlock_plant true only when the milestone created the first runnable version, clickable prototype, or first validated result. The app decides all visual growth. event_id must be a newly generated opaque ID for this single event; reuse exactly the same event_id only if retrying this same tool call.',
  inputSchema: {
    event_id: z.string().regex(EVENT_ID).describe('Opaque 8-128 character event ID; must contain no project information.'),
    level: z.enum(['small', 'medium', 'milestone']).describe('The size of the completed, concrete advance.'),
    unlock_plant: z.boolean().default(false).describe('True only for the first runnable version, clickable prototype, or first validated result.'),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ event_id, level, unlock_plant }) => {
  try {
    if (unlock_plant && level !== 'milestone') throw new Error('A plant unlock must be a milestone.');
    const result = await deliverOrQueue({ eventId: event_id, projectKey: PROJECT_KEY, level, unlockPlant: unlock_plant });
    const detail = result.queued
      ? result.deduplicated ? 'This anonymous progress was already waiting in the local Project Garden queue.' : 'Project Garden is offline, so this anonymous progress was saved in a local queue for the next desktop launch.'
      : result.deduplicated ? 'This event had already been recorded.' : 'The local Project Garden recorded the anonymous progress.';
    return {
      structuredContent: { accepted: true, queued: Boolean(result.queued), deduplicated: Boolean(result.deduplicated), level },
      content: [{ type: 'text', text: detail }],
    };
  } catch (problem) {
    return {
      isError: true,
      structuredContent: { accepted: false },
      content: [{ type: 'text', text: problem.message }],
    };
  }
});

server.registerTool('project_garden_record_insight', {
  title: 'Record an anonymous Project Garden insight',
  description: 'Award local decoration currency for one meaningful project insight without growing the plant. The insight goes only to the local plant for this Codex project; an insight alone never creates a project. Call only when this turn produced a genuinely new idea, a decision that resolves a real fork, or a useful conclusion from project discussion. Never call for casual chat, repeated brainstorming, token usage, message length, or a vague plan. Do not send project names, files, code, conversation text, URLs, people, clients, or a prose summary. The desktop app caps rewards per project each day. event_id must be a newly generated opaque ID for this single event; reuse it only if retrying the same call.',
  inputSchema: {
    event_id: z.string().regex(EVENT_ID).describe('Opaque 8-128 character event ID; must contain no project information.'),
    kind: z.enum(['idea', 'decision']).describe('idea for one genuinely new direction; decision for a concluded choice that resolves a real project fork.'),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ event_id, kind }) => {
  try {
    const result = await deliverOrQueue({ eventId: event_id, projectKey: PROJECT_KEY, type: 'reflection', reflectionKind: kind });
    const detail = result.queued
      ? result.deduplicated ? 'This anonymous insight was already waiting in the local Project Garden queue.' : 'Project Garden is offline, so this anonymous insight was saved in a local queue for the next desktop launch.'
      : result.deduplicated ? 'This insight had already been recorded.' : 'The local Project Garden recorded an anonymous insight reward.';
    return {
      structuredContent: { accepted: true, queued: Boolean(result.queued), deduplicated: Boolean(result.deduplicated), kind },
      content: [{ type: 'text', text: detail }],
    };
  } catch (problem) {
    return {
      isError: true,
      structuredContent: { accepted: false },
      content: [{ type: 'text', text: problem.message }],
    };
  }
});

// STDOUT is reserved for MCP JSON-RPC. Keep diagnostics off it.
process.on('uncaughtException', (problem) => {
  process.stderr.write(`Project Garden MCP error: ${problem.message}\n`);
  process.exitCode = 1;
});

await server.connect(new StdioServerTransport());
