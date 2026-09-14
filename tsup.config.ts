import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
  format: ['esm'],
  target: 'node22',
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  // Keep the `geolint mcp` dynamic import a real lazy chunk so the MCP SDK
  // only loads when the mcp command runs — `check`/`crawl` stay fast.
  splitting: true,
});
