const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const OUTBOX_DIRECTORY = 'project-garden-outbox';
const MAX_QUEUED_EVENTS = 400;
const OUTBOX_FILE = /^[a-f0-9]{64}\.json$/;

function outboxPathFor(userDataPath) {
  return path.join(userDataPath, OUTBOX_DIRECTORY);
}

function outboxFileName(eventId) {
  // Event IDs may contain ':' which Windows does not allow in file names.
  // Hashing keeps the on-disk name opaque and lets a repeated event naturally
  // deduplicate without putting any project data into a path.
  return `${crypto.createHash('sha256').update(eventId).digest('hex')}.json`;
}

function readOutboxEntries(userDataPath) {
  const directory = outboxPathFor(userDataPath);
  let names;
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  return names.filter((name) => OUTBOX_FILE.test(name)).flatMap((name) => {
    const filePath = path.join(directory, name);
    try {
      const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!record || typeof record !== 'object' || Array.isArray(record) || !record.event || typeof record.event !== 'object' || Array.isArray(record.event)) return [];
      const queuedAt = typeof record.queuedAt === 'string' && Number.isFinite(Date.parse(record.queuedAt)) ? record.queuedAt : '';
      return [{ filePath, queuedAt, event: record.event }];
    } catch {
      // Keep an unreadable local record intact instead of risking deletion of
      // a recoverable event. It is ignored until it can be repaired manually.
      return [];
    }
  }).sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.filePath.localeCompare(right.filePath));
}

function queueOutboxEvent({ userDataPath, event }) {
  if (!userDataPath) throw new Error('userDataPath is required');
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.eventId !== 'string' || !event.eventId) throw new Error('a valid event is required');

  const directory = outboxPathFor(userDataPath);
  const filePath = path.join(directory, outboxFileName(event.eventId));
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

  if (fs.existsSync(filePath)) return { queued: true, deduplicated: true, filePath };
  if (readOutboxEntries(userDataPath).length >= MAX_QUEUED_EVENTS) throw new Error('Project Garden local queue is full. Open the desktop app to apply pending progress.');

  try {
    fs.writeFileSync(filePath, JSON.stringify({
      version: 1,
      queuedAt: new Date().toISOString(),
      event,
    }), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return { queued: true, deduplicated: false, filePath };
  } catch (error) {
    if (error?.code === 'EEXIST') return { queued: true, deduplicated: true, filePath };
    throw error;
  }
}

function removeOutboxEntry(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = {
  MAX_QUEUED_EVENTS,
  outboxPathFor,
  queueOutboxEvent,
  readOutboxEntries,
  removeOutboxEntry,
};
