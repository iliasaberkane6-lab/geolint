// Runs via the `version` npm lifecycle script: after `npm version` bumps
// package.json, keep the VERSION constant in src/core/types.ts identical so
// --version, SARIF and the MCP serverInfo never go stale.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const file = 'src/core/types.ts';
const src = readFileSync(file, 'utf8');
const next = src.replace(/export const VERSION = '[^']+';/, `export const VERSION = '${version}';`);
if (next === src) {
  throw new Error('VERSION constant not found in src/core/types.ts');
}
writeFileSync(file, next);
console.log(`VERSION -> ${version}`);

// Keep the MCP registry manifest in lockstep: server.json version and the
// npm package reference must match package.json or `mcp-publisher publish`
// rejects the release.
const server = JSON.parse(readFileSync('server.json', 'utf8'));
server.version = version;
for (const pkg of server.packages ?? []) {
  if (pkg.registryType === 'npm') pkg.version = version;
}
writeFileSync('server.json', `${JSON.stringify(server, null, 2)}\n`);
console.log(`server.json -> ${version}`);
