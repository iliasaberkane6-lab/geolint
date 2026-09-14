import { type Command, Option } from 'commander';
import { RULE_CATEGORIES, type RuleCategory } from '../core/types.js';
import { REPORT_FORMATS, type ReportFormat } from '../reporters/index.js';
import { type BotsFormat, listBots } from './bots.js';
import { runCheck } from './check.js';
import { runCrawl } from './crawl.js';
import { runDiff } from './diff.js';
import { runInit } from './init.js';
import { type RulesFormat, listRules } from './rules.js';
import { parsePositiveInt, parseScore, stderrStatus, writeOutput } from './util.js';

interface CheckCliOptions {
  format: ReportFormat;
  output?: string;
  failUnder?: number;
  only?: string[];
  ignore?: string[];
  category?: RuleCategory[];
  timeout?: number;
  userAgent?: string;
  compare?: string;
  saveBaseline?: string;
  baseline?: string;
  verbose: boolean;
  color: boolean;
}

interface CrawlCliOptions {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  format: ReportFormat;
  output?: string;
  failUnder?: number;
  timeout?: number;
  verbose: boolean;
  color: boolean;
}

interface InitCliOptions {
  output?: string;
  maxPages: number;
  timeout?: number;
}

function formatOption(): Option {
  return new Option('-f, --format <format>', 'output format')
    .choices(REPORT_FORMATS)
    .default('pretty');
}

/**
 * Command registration — the commands work package owns this file and every
 * module under src/commands/. Keep this exported signature stable:
 * cli.ts calls registerCommands(program) exactly once.
 *
 * Command logic lives in exported async functions (runCheck, runCrawl,
 * runInit, runDiff, listRules, listBots) so it stays unit-testable; the
 * .action() wrappers only translate CLI flags, write output and set
 * process.exitCode.
 */
export function registerCommands(program: Command): void {
  program
    .command('check')
    .argument('<url>', 'URL to audit')
    .description('Audit a single URL for AI search readiness')
    .addOption(formatOption())
    .option('-o, --output <file>', 'write the report to a file instead of stdout')
    .option('--fail-under <0-100>', 'exit 1 when the score is below this threshold', parseScore)
    .option('--only <ids...>', 'only run these rule ids')
    .option('--ignore <ids...>', 'skip these rule ids')
    .addOption(new Option('--category <cats...>').choices(RULE_CATEGORIES))
    .option('--timeout <ms>', 'fetch timeout in milliseconds', parsePositiveInt)
    .option('--user-agent <ua>', 'custom User-Agent for fetching')
    .option('--compare <url2>', 'also scan this URL and render a comparison')
    .option('--save-baseline <file>', 'write a findings baseline JSON to this file')
    .option('--baseline <file>', 'fail on findings that are new since this baseline')
    .option('--verbose', 'include info-severity findings in the output', false)
    .option('--no-color', 'disable colored output')
    .action(async (url: string, opts: CheckCliOptions) => {
      const result = await runCheck(url, {
        format: opts.format,
        failUnder: opts.failUnder,
        only: opts.only,
        ignore: opts.ignore,
        category: opts.category,
        timeout: opts.timeout,
        userAgent: opts.userAgent,
        compare: opts.compare,
        saveBaseline: opts.saveBaseline,
        baseline: opts.baseline,
        verbose: opts.verbose,
        color: opts.color ? undefined : false,
      });
      await writeOutput(result.output, opts.output);
      if (opts.output) {
        console.error(`report written to ${opts.output}`);
      }
      process.exitCode = result.exitCode;
    });

  program
    .command('crawl')
    .argument('<url>', 'site URL to crawl')
    .description('Crawl same-origin pages and audit the whole site')
    .option('--max-pages <n>', 'maximum pages to crawl', parsePositiveInt, 25)
    .option('--max-depth <n>', 'maximum link depth from the entry page', parsePositiveInt, 3)
    .option('--concurrency <n>', 'parallel fetches', parsePositiveInt, 4)
    .addOption(formatOption())
    .option('-o, --output <file>', 'write the report to a file instead of stdout')
    .option(
      '--fail-under <0-100>',
      'exit 1 when the site score is below this threshold',
      parseScore,
    )
    .option('--timeout <ms>', 'fetch timeout in milliseconds', parsePositiveInt)
    .option('--verbose', 'log each fetched/scanned page to stderr', false)
    .option('--no-color', 'disable colored output')
    .action(async (url: string, opts: CrawlCliOptions) => {
      const result = await runCrawl(url, {
        maxPages: opts.maxPages,
        maxDepth: opts.maxDepth,
        concurrency: opts.concurrency,
        format: opts.format,
        failUnder: opts.failUnder,
        timeout: opts.timeout,
        verbose: opts.verbose,
        color: opts.color ? undefined : false,
      });
      await writeOutput(result.output, opts.output);
      if (opts.output) {
        console.error(`report written to ${opts.output}`);
      }
      process.exitCode = result.exitCode;
    });

  program
    .command('init')
    .argument('<url>', 'site URL to crawl')
    .description('Generate a llms.txt for the site from its crawled pages')
    .option('-o, --output <file>', 'write llms.txt to a file instead of stdout')
    .option('--max-pages <n>', 'maximum pages to crawl', parsePositiveInt, 30)
    .option('--timeout <ms>', 'fetch timeout in milliseconds', parsePositiveInt)
    .action(async (url: string, opts: InitCliOptions) => {
      const result = await runInit(url, {
        maxPages: opts.maxPages,
        timeout: opts.timeout,
        status: stderrStatus,
      });
      await writeOutput(result.markdown, opts.output);
      if (opts.output) {
        console.error(`llms.txt written to ${opts.output}`);
      }
    });

  program
    .command('diff')
    .argument('<old.json>', 'baseline report (geolint check -f json -o …)')
    .argument('<new.json>', 'new report to compare against the baseline')
    .description('Compare two geolint JSON reports: score delta, added and resolved findings')
    .action(async (oldPath: string, newPath: string) => {
      const { output } = await runDiff(oldPath, newPath);
      await writeOutput(output);
    });

  program
    .command('rules')
    .description('List the audit rules in the registry')
    .addOption(new Option('--category <cat>', 'only show this category').choices(RULE_CATEGORIES))
    .addOption(
      new Option('--format <format>', 'output format')
        .choices(['table', 'json', 'markdown'])
        .default('table'),
    )
    .action((opts: { category?: RuleCategory; format: RulesFormat }) => {
      process.stdout.write(`${listRules({ category: opts.category, format: opts.format })}\n`);
    });

  program
    .command('bots')
    .description('List known AI crawlers and the impact of blocking each one')
    .addOption(
      new Option('--format <format>', 'output format').choices(['table', 'json']).default('table'),
    )
    .action((opts: { format: BotsFormat }) => {
      process.stdout.write(`${listBots({ format: opts.format })}\n`);
    });
}
