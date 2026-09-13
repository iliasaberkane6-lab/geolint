#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommands } from './commands/index.js';
import { VERSION } from './core/types.js';

const program = new Command();

program
  .name('geolint')
  .description(
    'Lint your website for AI search readiness — AI crawler access, llms.txt, structured data and citability.',
  )
  .version(VERSION);

registerCommands(program);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
