import type { Command } from 'commander';
import { scan } from '../core/engine.js';
import { renderReport } from '../reporters/index.js';

/**
 * Command registration — the commands work package owns this file and every
 * module under src/commands/. Keep this exported signature stable:
 * cli.ts calls registerCommands(program) exactly once.
 */
export function registerCommands(program: Command): void {
  program
    .command('check')
    .argument('<url>', 'URL to audit')
    .description('Audit a single URL for AI search readiness')
    .option('-f, --format <format>', 'output format: pretty|json|sarif|markdown', 'pretty')
    .action(async (url: string, opts: { format: string }) => {
      const report = await scan(url);
      console.log(renderReport(report, opts.format as never));
    });
}
