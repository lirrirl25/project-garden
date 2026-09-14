const path = require('node:path');
const { execFile } = require('node:child_process');

function createCompanionSettings({ root, testData, platform = process.platform, execute = execFile }) {
  // Tests never touch real startup shortcuts or the user's companion process.
  let testEnabled = false;
  return async function settings(enabled) {
    if (enabled !== undefined && typeof enabled !== 'boolean') throw new TypeError('Startup preference must be boolean.');
    if (platform !== 'win32') return { supported: false, enabled: false, running: false };
    if (testData) {
      if (enabled !== undefined) testEnabled = enabled;
      return { supported: true, enabled: testEnabled, running: testEnabled, isolated: true };
    }
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const script = path.join(root, 'integration/setup-codex-companion.ps1');
    const run = mode => new Promise((resolve, reject) => execute(powershell,
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', script, ...mode],
      { windowsHide: true, timeout: 15000, encoding: 'utf8' },
      (error, stdout) => error ? reject(new Error('Could not update the Codex startup setting. Another installation may own the startup shortcut.')) : resolve(stdout.trim())));
    if (enabled !== undefined) await run(enabled ? [] : ['-Disable']);
    const result = JSON.parse(await run(['-Status']));
    return { supported: true, enabled: Boolean(result.Enabled), running: Boolean(result.Running) };
  };
}
module.exports = { createCompanionSettings };
