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
