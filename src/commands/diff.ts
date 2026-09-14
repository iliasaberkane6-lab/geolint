import { readFile } from 'node:fs/promises';
import type { Finding, ScanReport } from '../core/types.js';
import { paint } from '../utils/color.js';
import { findingKey } from './util.js';

export interface ReportDiff {
  oldScore: number;
  newScore: number;
  delta: number;
  /** Findings present in the new report but not the old one. */
  added: Finding[];
  /** Findings present in the old report but gone in the new one. */
  resolved: Finding[];
}

/** Diff two scan reports by finding identity (ruleId + message). */
export function diffReports(a: ScanReport, b: ScanReport): ReportDiff {
  const aKeys = new Set(a.findings.map(findingKey));
  const bKeys = new Set(b.findings.map(findingKey));
  return {
    oldScore: a.score,
    newScore: b.score,
    delta: b.score - a.score,
    added: b.findings.filter((f) => !aKeys.has(findingKey(f))),
    resolved: a.findings.filter((f) => !bKeys.has(findingKey(f))),
  };
}

function pushGrouped(
  lines: string[],
  findings: Finding[],
  marker: string,
  markerPaint: (s: string) => string,
): void {
  if (findings.length === 0) {
    lines.push('  (none)');
    return;
  }
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byRule.get(f.ruleId) ?? [];
    list.push(f);
    byRule.set(f.ruleId, list);
  }
  for (const [ruleId, fs] of byRule) {
    lines.push(`  ${ruleId}`);
    for (const f of fs) {
      lines.push(`    ${markerPaint(marker)} ${f.message}`);
    }
  }
}

/** Render the diff as pretty, human-readable text. */
export function renderDiff(a: ScanReport, b: ScanReport, diff: ReportDiff): string {
  const arrow = diff.delta > 0 ? '↑' : diff.delta < 0 ? '↓' : '→';
  const deltaText = diff.delta > 0 ? `+${diff.delta}` : String(diff.delta);
  const colored =
    diff.delta > 0 ? paint.ok(arrow) : diff.delta < 0 ? paint.error(arrow) : paint.dim(arrow);
  const lines = [
    paint.bold('geolint diff'),
    `${a.url ?? 'old report'} → ${b.url ?? 'new report'}`,
    `score: ${diff.oldScore} → ${diff.newScore} ${colored} (${deltaText})`,
    '',
    paint.bold(`Added findings (${diff.added.length})`),
  ];
  pushGrouped(lines, diff.added, '+', paint.ok);
  lines.push('', paint.bold(`Resolved findings (${diff.resolved.length})`));
  pushGrouped(lines, diff.resolved, '-', paint.error);
  return lines.join('\n');
}

async function loadReportJson(path: string): Promise<ScanReport> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(`cannot read report file: ${path}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`report file is not valid JSON: ${path}`);
  }
  const r = data as Partial<ScanReport> | null;
  if (!r || typeof r !== 'object' || !Array.isArray(r.findings) || typeof r.score !== 'number') {
    throw new Error(`not a geolint report JSON (expected {score, findings[]}): ${path}`);
  }
  return r as ScanReport;
}

export interface DiffResult {
  diff: ReportDiff;
  output: string;
}

/** `geolint diff old.json new.json` — compare two `check -f json` reports. */
export async function runDiff(oldPath: string, newPath: string): Promise<DiffResult> {
  const [a, b] = await Promise.all([loadReportJson(oldPath), loadReportJson(newPath)]);
  const diff = diffReports(a, b);
  return { diff, output: renderDiff(a, b, diff) };
}
