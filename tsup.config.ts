import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
  format: ['esm'],
  target: 'node22',
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  splitting: false,
});
