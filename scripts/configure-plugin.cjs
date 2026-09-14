const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'plugins/project-garden-bridge/.mcp.json');
const config = {
  mcpServers: {
    'project-garden': {
      command: process.execPath,
      args: [path.join(root, 'mcp/codex-server.mjs')],
      enabled: true,
      startup_timeout_sec: 15,
      env_vars: [],
      env: {},
    },
  },
};
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log('Generated local MCP configuration. This machine-specific file is ignored by Git.');
