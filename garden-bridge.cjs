const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { readOutboxEntries, removeOutboxEntry } = require('./garden-outbox.cjs');
const { createEventJournal } = require('./garden-event-journal.cjs');
const { normalizeDate } = require('./growth-history.js');

const CONFIG_FILE = 'project-garden-bridge.json';
const MAX_BODY_BYTES = 2048;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const PROJECT_KEY = /^(?:workspace|codex):[A-Za-z0-9_-]{12,128}$/;
const CODEX_PROJECT_ID = /^[A-Za-z0-9_-]{8,128}$/;
const LEVELS = new Set(['small', 'medium', 'milestone']);
const REFLECTION_KINDS = new Set(['idea', 'decision']);

function configPathFor(userDataPath) {
  return path.join(userDataPath, CONFIG_FILE);
}

function normalizePendingProjectImport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const projects = Array.isArray(value.projects) ? value.projects : [];
  const seen = new Set();
  const safeProjects = projects.flatMap((project) => {
    const codexProjectId = typeof project?.codexProjectId === 'string' ? project.codexProjectId : '';
    const name = typeof project?.name === 'string' ? project.name.trim() : '';
    const syncProjectKey = typeof project?.syncProjectKey === 'string' ? project.syncProjectKey : null;
    if (!CODEX_PROJECT_ID.test(codexProjectId) || !name || name.length > 48 || seen.has(codexProjectId)) return [];
    if (syncProjectKey !== null && !PROJECT_KEY.test(syncProjectKey)) return [];
    seen.add(codexProjectId);
    let projectCreatedAt=null;
    try { if(project.projectCreatedAt)projectCreatedAt=normalizeDate(project.projectCreatedAt,Date.now()); } catch { /* Do not manufacture a creation date. */ }
    return [{ codexProjectId, name, projectKind: project.projectKind === 'chatgpt' ? 'chatgpt' : 'local', syncProjectKey, ...(projectCreatedAt?{projectCreatedAt}:{}) }];
  }).slice(0, 80);
  if (!safeProjects.length || typeof value.importId !== 'string' || !EVENT_ID.test(value.importId)) return null;
  return { importId: value.importId, projects: safeProjects };
}

function readState(configPath) {
  try {
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      secret: typeof saved.secret === 'string' && saved.secret.length >= 32 ? saved.secret : crypto.randomBytes(32).toString('base64url'),
      port: Number.isInteger(saved.port) ? saved.port : null,
      activeProjectId: typeof saved.activeProjectId === 'string' ? saved.activeProjectId : null,
      habitat: saved.habitat === 'garden' || saved.habitat === 'zoo' ? saved.habitat : null,
      autoCreate: saved.autoCreate !== false,
      pendingProjectImport: normalizePendingProjectImport(saved.pendingProjectImport),
      processedEventIds: Array.isArray(saved.processedEventIds) ? saved.processedEventIds.filter((id) => typeof id === 'string' && EVENT_ID.test(id)).slice(-200) : [],
    };
  } catch {
    return {
      secret: crypto.randomBytes(32).toString('base64url'),
      port: null,
      activeProjectId: null,
      habitat: null,
      autoCreate: true,
      pendingProjectImport: null,
      processedEventIds: [],
    };
  }
}

function writeState(configPath, state) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    version: 3,
    secret: state.secret,
    port: state.port,
    activeProjectId: state.activeProjectId,
    habitat: state.habitat,
    autoCreate: state.autoCreate,
    pendingProjectImport: state.pendingProjectImport,
    processedEventIds: state.processedEventIds,
  }), { encoding: 'utf8', mode: 0o600 });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function errorResponse(response, status, message) {
  sendJson(response, status, { accepted: false, error: message });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const parts = [];
    request.on('data', (part) => {
      bytes += part.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('request too large'));
        request.destroy();
        return;
      }
      parts.push(part);
    });
    request.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    request.on('error', reject);
  });
}

function parseEvent(raw) {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new Error('invalid JSON');
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('invalid event');
  if (!EVENT_ID.test(event.eventId || '')) throw new Error('invalid event id');
  if (event.projectKey !== undefined && !PROJECT_KEY.test(event.projectKey)) throw new Error('invalid project key');
  const routing = typeof event.projectKey === 'string' ? { projectKey: event.projectKey } : {};
  if (event.type === 'reflection') {
    if (!REFLECTION_KINDS.has(event.reflectionKind)) throw new Error('invalid reflection kind');
    return { eventId: event.eventId, type: 'reflection', reflectionKind: event.reflectionKind, ...routing };
  }
  if (event.type !== undefined && event.type !== 'progress') throw new Error('invalid event type');
  if (!LEVELS.has(event.level)) throw new Error('invalid progress level');
  if (typeof event.unlockPlant !== 'boolean') throw new Error('invalid plant unlock flag');
  if (event.unlockPlant && event.level !== 'milestone') throw new Error('a plant unlock must be a milestone');
  return { eventId: event.eventId, level: event.level, unlockPlant: event.unlockPlant, ...routing };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function createGardenBridge({ userDataPath, dispatchProgress }) {
  if (!userDataPath) throw new Error('userDataPath is required');
  if (typeof dispatchProgress !== 'function') throw new Error('dispatchProgress is required');

  const configPath = configPathFor(userDataPath);
  const state = readState(configPath);
  const pending = new Map();
  const journal = createEventJournal(userDataPath);
  let replayNeeded = true;
  let pollTimer;
  let lastAppliedAt = null;
  let server;
  let flushPromise = null;

  const queuedEventCount = () => {
    try {
      return readOutboxEntries(userDataPath).length;
    } catch {
      return 0;
    }
  };

  const status = () => ({
    ready: Boolean(server?.listening),
    active: Boolean(state.activeProjectId),
    habitat: state.habitat,
    autoCreate: state.autoCreate,
    queuedEvents: queuedEventCount(),
    lastAppliedAt,
  });

  const eventDetailsFor = (event) => (event.type === 'reflection'
    ? { type: 'reflection', reflectionKind: event.reflectionKind }
    : { level: event.level });

  const routingProblemFor = (event) => {
    const canAutoCreate = Boolean(state.autoCreate && state.habitat);
    if (event.projectKey ? !canAutoCreate : !state.activeProjectId) {
      return event.projectKey
        ? 'Choose a garden or zoo in Project Garden before recording automatic progress.'
        : 'Open Project Garden and choose an active project for this legacy event.';
    }
    return null;
  };

  async function applyEvent(event, options = {}) {
    const routingProblem = routingProblemFor(event);
    if (routingProblem) throw new Error(routingProblem);

    const eventDetails = eventDetailsFor(event);
    if (!options.replay && state.processedEventIds.includes(event.eventId)) return { accepted: true, deduplicated: true, ...eventDetails };
    const record = journal.record(event, options.occurredAt);

    let pendingWork = pending.get(event.eventId);
    if (!pendingWork) {
      // New MCP events carry only an opaque project key. The renderer maps it
      // to a local plant (or creates one) and never receives Codex content.
      pendingWork = Promise.resolve(dispatchProgress({ ...event, occurredAt: record.occurredAt, projectId: event.projectKey ? null : state.activeProjectId, habitat: state.habitat }))
        .then((result) => {
          state.processedEventIds = [...new Set([...state.processedEventIds, event.eventId])].slice(-200);
          lastAppliedAt = new Date().toISOString();
          writeState(configPath, state);
          return result || {};
        })
        .finally(() => pending.delete(event.eventId));
      pending.set(event.eventId, pendingWork);
    }

    const result = await pendingWork;
    return { accepted: true, deduplicated: false, ...eventDetails, ...result };
  }

  async function flushOutbox() {
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      if (replayNeeded) {
        let complete = true;
        for (const row of journal.values()) {
          try { await applyEvent(parseEvent(JSON.stringify(row.event)), { replay: true, occurredAt: row.occurredAt }); }
          catch { complete = false; }
        }
        replayNeeded = !complete;
      }
      for (const entry of readOutboxEntries(userDataPath)) {
        let event;
        try {
          // Treat the on-disk queue as untrusted input too. Malformed records
          // remain on disk rather than being discarded without the user's say.
          event = parseEvent(JSON.stringify(entry.event));
        } catch {
          continue;
        }
        try {
          await applyEvent(event, { occurredAt: entry.queuedAt || undefined });
          removeOutboxEntry(entry.filePath);
        } catch {
          // The item stays queued for the next time the desktop app has a
          // complete renderer context. Other independent events can continue.
        }
      }
      return { queuedEvents: queuedEventCount() };
    })().finally(() => { flushPromise = null; });
    return flushPromise;
  }

  const handleRequest = async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/event') return errorResponse(response, 404, 'not found');
    if (request.headers['x-project-garden-secret'] !== state.secret) return errorResponse(response, 401, 'unauthorized');
    if (!String(request.headers['content-type'] || '').startsWith('application/json')) return errorResponse(response, 415, 'JSON required');

    let event;
    try {
      event = parseEvent(await readRequestBody(request));
    } catch (problem) {
      return errorResponse(response, 400, problem.message || 'invalid request');
    }

    try {
      return sendJson(response, 200, await applyEvent(event));
    } catch (problem) {
      const routingProblem = routingProblemFor(event);
      return errorResponse(response, routingProblem ? 409 : 503, problem?.message || 'Project Garden could not apply this progress');
    }
  };

  return {
    async start() {
      if (server?.listening) return status();
      // Never retain a selected plot across an app restart. The renderer sends
      // a fresh local-only context immediately after it has loaded.
      state.activeProjectId = null;
      state.habitat = null;
      server = http.createServer((request, response) => {
        handleRequest(request, response).catch(() => errorResponse(response, 500, 'bridge error'));
      });
      await listen(server);
      state.port = server.address().port;
      writeState(configPath, state);
      pollTimer = setInterval(() => { if (state.habitat && state.autoCreate) void flushOutbox().catch(() => {}); }, 2500);
      pollTimer.unref();
      return status();
    },
    setContext(context = {}) {
      state.activeProjectId = typeof context.projectId === 'string' && context.projectId.length ? context.projectId : null;
      state.habitat = context.habitat === 'garden' || context.habitat === 'zoo' ? context.habitat : null;
      state.autoCreate = context.autoCreate !== false;
      writeState(configPath, state);
      if (state.habitat && state.autoCreate) void flushOutbox().catch(() => {});
      return status();
    },
    getStatus: status,
    getProcessedEventIds: () => [...state.processedEventIds],
    getPendingProjectImport: () => state.pendingProjectImport,
    confirmProjectImport(result = {}) {
      if (result.importId !== state.pendingProjectImport?.importId) return false;
      state.pendingProjectImport = null;
      writeState(configPath, state);
      return true;
    },
    getConfigPath: () => configPath,
    flushOutbox,
    async stop() {
      clearInterval(pollTimer);
      if (!server?.listening) return;
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function queueProjectImport({ userDataPath, projects }) {
  if (!userDataPath) throw new Error('userDataPath is required');
  const configPath = configPathFor(userDataPath);
  const state = readState(configPath);
  const pendingProjectImport = normalizePendingProjectImport({
    importId: `import-${crypto.randomBytes(12).toString('base64url')}`,
    projects,
  });
  if (!pendingProjectImport) throw new Error('no valid Codex projects to import');
  state.pendingProjectImport = pendingProjectImport;
  writeState(configPath, state);
  return { importId: pendingProjectImport.importId, count: pendingProjectImport.projects.length, configPath };
}

module.exports = { CONFIG_FILE, configPathFor, createGardenBridge, queueProjectImport };
