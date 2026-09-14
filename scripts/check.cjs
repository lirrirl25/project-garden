const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const skipped = new Set(['.git', '.install', 'node_modules', 'artifacts', 'backups', 'test-results', 'playwright-report']);
let checked = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skipped.has(entry.name) && !entry.name.startsWith('tmp-test-profile')) walk(file);
    } else if (/\.(?:js|cjs|mjs)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      if (result.error || result.status !== 0) process.exit(1);
      checked++;
    } else if (/\.json$/.test(entry.name)) {
      JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    }
  }
}
walk(root);
console.log(`Syntax and JSON checks passed (${checked} JavaScript files).`);
