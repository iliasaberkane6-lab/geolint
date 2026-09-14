import { readFile, writeFile } from 'node:fs/promises';
import { scan, unknownRuleIds } from '../core/engine.js';
import type { Finding, RuleCategory, ScanOptions, ScanReport, Severity } from '../core/types.js';
import {
  type RenderOptions,
  type ReportFormat,
  renderCompare,
  renderReport,
} from '../reporters/index.js';
import { findingKey, noopStatus, normalizeUrl, stderrStatus } from './util.js';

/** A finding as persisted in a baseline file. */
export interface BaselineFinding {
  ruleId: string;
  severity: Severity;
  message: string;
}

/** Shape of a --save-baseline / --baseline file. */
export interface BaselineFile {
  url: string;
  scannedAt: string;
  score: number;
  findings: BaselineFinding[];
}

export interface CheckOptions {
  format?: ReportFormat;
  /** Exit 1 when the score is below this 0–100 threshold. */
  failUnder?: number;
  only?: string[];
  ignore?: string[];
  category?: RuleCategory[];
  timeout?: number;
  userAgent?: string;
  /** Also scan this URL and render a comparison instead of the report. */
  compare?: string;
  /** Write a findings baseline JSON to this path after scanning. */
  saveBaseline?: string;
  /** Compare findings against this baseline file. */
  baseline?: string;
  verbose?: boolean;
  color?: boolean;
  /** Status sink for progress lines. Defaults to stderr for pretty, silent otherwise. */
  status?: (msg: string) => void;
}

export interface CheckResult {
  url: string;
  report: ScanReport;
  /** Rendered output destined for stdout or --output. */
  output: string;
  /** New error/warn findings not present in the baseline. */
  regressions: Finding[];
  /** Baseline findings that no longer occur. */
  resolved: BaselineFinding[];
  /** 1 when score < failUnder or regressions exist, else 0. */
  exitCode: 0 | 1;
}

/** Load and lightly validate a baseline file written by --save-baseline. */
export async function loadBaseline(path: string): Promise<BaselineFile> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(`cannot read baseline file: ${path}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`baseline file is not valid JSON: ${path}`);
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as { findings?: unknown }).findings)
  ) {
    throw new Error(`baseline file has unexpected shape: ${path}`);
  }
  const b = data as { url?: unknown; scannedAt?: unknown; score?: unknown; findings: unknown[] };
  const findings: BaselineFinding[] = b.findings.flatMap((f) => {
    const ff = f as { ruleId?: unknown; severity?: unknown; message?: unknown } | null;
    if (!ff || typeof ff.ruleId !== 'string' || typeof ff.message !== 'string') {
      return [];
    }
    return [
      {
        ruleId: ff.ruleId,
        severity: ff.severity === 'error' || ff.severity === 'warn' ? ff.severity : 'info',
        message: ff.message,
      },
    ];
  });
  return {
    url: typeof b.url === 'string' ? b.url : '',
    scannedAt: typeof b.scannedAt === 'string' ? b.scannedAt : '',
    score: typeof b.score === 'number' ? b.score : 0,
    findings,
  };
}

/** Persist a baseline file capturing this report's findings. */
export async function saveBaseline(path: string, report: ScanReport): Promise<void> {
  const baseline: BaselineFile = {
    url: report.url,
    scannedAt: report.scannedAt,
    score: report.score,
    findings: report.findings.map(({ ruleId, severity, message }) => ({
      ruleId,
      severity,
      message,
    })),
  };
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}

/**
 * Compare a fresh report against a baseline. Regressions are current
 * error/warn findings the baseline does not know (matched on ruleId+message);
 * resolved are baseline findings that disappeared.
 */
export function diffBaseline(
  report: ScanReport,
  baseline: BaselineFile,
): { regressions: Finding[]; resolved: BaselineFinding[] } {
  const baselineKeys = new Set(baseline.findings.map(findingKey));
  const currentKeys = new Set(report.findings.map(findingKey));
  const regressions = report.findings.filter(
    (f) => (f.severity === 'error' || f.severity === 'warn') && !baselineKeys.has(findingKey(f)),
  );
  const resolved = baseline.findings.filter((f) => !currentKeys.has(findingKey(f)));
  return { regressions, resolved };
}

/**
 * Audit a single URL: scan, render (or compare), optionally diff against a
 * baseline and/or save one. Returns everything the CLI needs — output text,
 * regression info and the exit code — without touching stdout itself.
 */
export async function runCheck(input: string, opts: CheckOptions = {}): Promise<CheckResult> {
  const url = normalizeUrl(input);
  const format = opts.format ?? 'pretty';
  const status = opts.status ?? (format === 'pretty' ? stderrStatus : noopStatus);
  const renderOpts: RenderOptions = { color: opts.color, verbose: opts.verbose };
  const scanOpts: ScanOptions = {
    timeout: opts.timeout,
    userAgent: opts.userAgent,
    only: opts.only,
    ignore: opts.ignore,
    categories: opts.category,
  };

  const unknown = unknownRuleIds(scanOpts);
  for (const id of unknown) {
    status(`warning: unknown rule id '${id}' — run 'geolint rules' for the list`);
  }

  status(`Scanning ${url}…`);
  const report = await scan(url, scanOpts);

  let output: string;
  if (opts.compare) {
    const other = normalizeUrl(opts.compare);
    status(`Scanning ${other}…`);
    const otherReport = await scan(other, scanOpts);
    output = renderCompare(report, otherReport, renderOpts);
  } else {
    output = renderReport(report, format, renderOpts);
  }

  let regressions: Finding[] = [];
  let resolved: BaselineFinding[] = [];
  if (opts.baseline) {
    const baseline = await loadBaseline(opts.baseline);
    ({ regressions, resolved } = diffBaseline(report, baseline));
    for (const f of regressions) {
      status(`regression [${f.ruleId}] ${f.message}`);
    }
    for (const f of resolved) {
      status(`resolved [${f.ruleId}] ${f.message}`);
    }
  }

  if (opts.saveBaseline) {
    await saveBaseline(opts.saveBaseline, report);
    status(`baseline written to ${opts.saveBaseline}`);
  }

  let exitCode: 0 | 1 = 0;
  if (opts.failUnder !== undefined && report.score < opts.failUnder) {
    exitCode = 1;
  }
  if (regressions.length > 0) {
    exitCode = 1;
  }
  return { url, report, output, regressions, resolved, exitCode };
}
