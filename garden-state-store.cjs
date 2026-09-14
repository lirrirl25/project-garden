const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 8 * 1024 * 1024;

function validState(state) {
  return state && typeof state === 'object' && !Array.isArray(state)
    && Array.isArray(state.projects) && Array.isArray(state.activities)
    && state.projects.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Number.isFinite(p.points || 0))
    && Number.isFinite(state.gardenDust || 0) && (state.gardenDust || 0) >= 0;
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, text, 'utf8'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

function createGardenStateStore(directory) {
  const file = path.join(directory, 'garden-state.json');
  const backup = path.join(directory, 'garden-state.backup.json');
  let current = null;
  let recovered = false;
  let blocked = false;
  const digest = state => crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
  const read = location => {
    if (!fs.existsSync(location)) return null;
    const text = fs.readFileSync(location, 'utf8');
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('State exceeds safe size');
    const value = JSON.parse(text);
    if (value.version !== 1 || !Number.isSafeInteger(value.revision) || !validState(value.state) || value.checksum !== digest(value.state)) throw new Error('Invalid garden save');
    return value;
  };
  try { current = read(file); } catch { recovered = true; }
  if (!current) {
    try { current = read(backup); if (current) recovered = true; } catch { /* Keep both damaged files intact. */ }
    blocked = !current && (fs.existsSync(file) || fs.existsSync(backup));
  }
  const status = () => ({ state: current?.state || null, revision: current?.revision || 0, savedAt: current?.savedAt || null, recovered, blocked, file });
  return {
    load: status,
    save(state, revision = current?.revision || 0) {
      if (blocked) throw new Error('存档暂时无法读取，已保留原文件，请先恢复备份。');
      if (!validState(state)) throw new Error('园区记录格式不完整，未覆盖原存档。');
      if (revision !== (current?.revision || 0)) throw new Error('园区记录已更新，请重新打开窗口后重试。');
      if (current?.state.projects.length && !state.projects.length) throw new Error('空园区不能覆盖已有植物，原存档已保留。');
      if (current?.checksum === digest(state)) return status();
      const next = { version: 1, revision: (current?.revision || 0) + 1, savedAt: new Date().toISOString(), checksum: digest(state), state };
      const text = JSON.stringify(next);
      if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('存档过大，请先导出备份。');
      // Previous good state is kept if the primary replacement is interrupted.
      if (current) atomicWrite(backup, JSON.stringify(current));
      atomicWrite(file, text);
      current = JSON.parse(text);
      // Mirror the latest durable state; the event journal repairs the small
      // interval between primary and backup writes if a crash interrupts us.
      try { atomicWrite(backup, text); } catch { /* The primary is already durable. */ }
      recovered = false;
      return status();
    },
  };
}
module.exports = { createGardenStateStore, atomicWrite, validState };
