import { CATEGORY_LABELS, type Grade, RULE_CATEGORIES, type ScanReport } from '../core/types.js';
import type { RenderOptions } from './index.js';
import { type Paint, clip, finish, makePaint, renderTable } from './table.js';

const GRADE_VALUE: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function errorCount(report: ScanReport): number {
  return report.findings.filter((f) => f.severity === 'error').length;
}

function warningCount(report: ScanReport): number {
  return report.findings.filter((f) => f.severity === 'warn').length;
}

function botsAllowed(report: ScanReport): { allowed: number; total: number } {
  return {
    allowed: report.bots.filter((b) => b.allowed === true).length,
    total: report.bots.length,
  };
}

/**
 * Delta cell: arrow shows direction of change (b vs a), color shows whether
 * the change is an improvement. `higherIsBetter=false` inverts the coloring
 * for metrics like error counts.
 */
function deltaCell(diff: number, higherIsBetter: boolean, p: Paint, text?: string): string {
  if (diff === 0) {
    return p('→ —', 'dim');
  }
  const better = higherIsBetter ? diff > 0 : diff < 0;
  const arrow = diff > 0 ? '↑' : '↓';
  const label = text ?? `${diff > 0 ? '+' : ''}${diff}`;
  return p(`${arrow} ${label}`, better ? 'green' : 'red');
}

/** Side-by-side comparison of two scan reports (`check --compare`). */
export function renderCompare(a: ScanReport, b: ScanReport, opts: RenderOptions = {}): string {
  const p = makePaint(opts);
  const L: string[] = [];

  const hostA = clip(hostOf(a.url), 24);
  const hostB = clip(hostOf(b.url), 24);

  L.push(`  ${p('geolint compare', 'bold')}`);
  L.push(`    ${p('A', 'bold')}  ${p(a.url, 'cyan')}`);
  L.push(`    ${p('B', 'bold')}  ${p(b.url, 'cyan')}`);
  L.push('');

  const rows: string[][] = [];

  rows.push([
    'Overall score',
    `${a.score} (${a.grade})`,
    `${b.score} (${b.grade})`,
    deltaCell(b.score - a.score, true, p),
  ]);

  const gradeDiff = GRADE_VALUE[b.grade] - GRADE_VALUE[a.grade];
  rows.push([
    'Grade',
    a.grade,
    b.grade,
    gradeDiff === 0 ? p('→ —', 'dim') : deltaCell(gradeDiff, true, p, `${a.grade} → ${b.grade}`),
  ]);

  for (const cat of RULE_CATEGORIES) {
    const csA = a.categories[cat];
    const csB = b.categories[cat];
    if (csA.rulesRun.length === 0 && csB.rulesRun.length === 0) {
      continue;
    }
    rows.push([
      CATEGORY_LABELS[cat],
      csA.rulesRun.length === 0 ? '—' : String(csA.score),
      csB.rulesRun.length === 0 ? '—' : String(csB.score),
      csA.rulesRun.length === 0 || csB.rulesRun.length === 0
        ? p('→ —', 'dim')
        : deltaCell(csB.score - csA.score, true, p),
    ]);
  }

  rows.push([
    'Errors',
    String(errorCount(a)),
    String(errorCount(b)),
    deltaCell(errorCount(b) - errorCount(a), false, p),
  ]);

  rows.push([
    'Warnings',
    String(warningCount(a)),
    String(warningCount(b)),
    deltaCell(warningCount(b) - warningCount(a), false, p),
  ]);

  const botsA = botsAllowed(a);
  const botsB = botsAllowed(b);
  if (botsA.total > 0 || botsB.total > 0) {
    rows.push([
      'AI bots allowed',
      `${botsA.allowed}/${botsA.total}`,
      `${botsB.allowed}/${botsB.total}`,
      deltaCell(botsB.allowed - botsA.allowed, true, p),
    ]);
  }

  const table = renderTable(
    [
      { header: 'METRIC', max: 24 },
      { header: hostA, align: 'right', max: 20 },
      { header: hostB, align: 'right', max: 20 },
      { header: 'Δ (B − A)', max: 16 },
    ],
    rows,
    '   ',
  );
  L.push(...table.map((line) => `    ${line}`));
  L.push('');

  if (b.score > a.score) {
    L.push(
      `  ${p('Winner:', 'bold')} ${p(b.url, 'green', 'bold')} ${p(`(+${b.score - a.score} points)`, 'dim')}`,
    );
  } else if (a.score > b.score) {
    L.push(
      `  ${p('Winner:', 'bold')} ${p(a.url, 'green', 'bold')} ${p(`(+${a.score - b.score} points)`, 'dim')}`,
    );
  } else {
    L.push(`  ${p('Tie', 'bold')} ${p('— identical scores', 'dim')}`);
  }

  return finish(L.join('\n'), opts);
}
