import {
  type BotAccess,
  CATEGORY_LABELS,
  type CategoryScore,
  type Finding,
  type Grade,
  RULE_CATEGORIES,
  type RuleCategory,
  type ScanReport,
  type Severity,
  type SiteReport,
} from '../core/types.js';
import type { RenderOptions } from './index.js';
import { type Paint, clip, finish, makePaint, padEndVis, renderTable, wrapText } from './table.js';

const BAR_WIDTH = 30;
const MINI_BAR_WIDTH = 10;
const RULE_WIDTH = 72;

const SEV_GLYPH: Record<Severity, string> = { error: '✗', warn: '⚠', info: 'ℹ' };
const SEV_STYLE: Record<Severity, Parameters<Paint>[1]> = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
};
const SEV_RANK: Record<Severity, number> = { error: 0, warn: 1, info: 2 };

const GRADE_STYLE: Record<Grade, Parameters<Paint>[1]> = {
  A: 'green',
  B: 'greenBright',
  C: 'yellow',
  D: 'red',
  F: 'red',
};

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  410: 'Gone',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

function durationLabel(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function bar(score: number, width: number, style: Parameters<Paint>[1], p: Paint): string {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  return p('█'.repeat(filled), style) + p('░'.repeat(width - filled), 'dim');
}

function scoreStyle(score: number): Parameters<Paint>[1] {
  if (score >= 90) {
    return 'green';
  }
  if (score >= 75) {
    return 'greenBright';
  }
  if (score >= 60) {
    return 'yellow';
  }
  return 'red';
}

function plural(n: number, singular: string, pluralWord = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

/** '✓ clean' or '2 errors · 1 warning' — colored by worst severity. */
function issueSummary(cat: CategoryScore, p: Paint): string {
  const total = cat.errors + cat.warnings + cat.infos;
  if (total === 0) {
    return p('✓ clean', 'green');
  }
  const parts: string[] = [];
  if (cat.errors > 0) {
    parts.push(plural(cat.errors, 'error'));
  }
  if (cat.warnings > 0) {
    parts.push(plural(cat.warnings, 'warning'));
  }
  if (cat.infos > 0) {
    parts.push(plural(cat.infos, 'hint'));
  }
  const worst: Severity = cat.errors > 0 ? 'error' : cat.warnings > 0 ? 'warn' : 'info';
  return p(`${SEV_GLYPH[worst]} ${parts.join(' · ')}`, SEV_STYLE[worst]);
}

function categoryOf(ruleId: string): RuleCategory | 'other' {
  const prefix = ruleId.split('/')[0] ?? '';
  return (RULE_CATEGORIES as string[]).includes(prefix) ? (prefix as RuleCategory) : 'other';
}

function categoryLabel(cat: RuleCategory | 'other'): string {
  return cat === 'other' ? 'Other' : CATEGORY_LABELS[cat];
}

interface GroupedFinding {
  finding: Finding;
  /** For site reports: how many pages produced this identical finding. */
  pages: number;
}

function groupFindings(findings: Finding[], dedupe: boolean): GroupedFinding[] {
  if (!dedupe) {
    return findings.map((finding) => ({ finding, pages: 1 }));
  }
  const map = new Map<string, GroupedFinding>();
  for (const finding of findings) {
    const key = `${finding.ruleId}${finding.message}`;
    const entry = map.get(key);
    if (entry) {
      entry.pages += 1;
    } else {
      map.set(key, { finding, pages: 1 });
    }
  }
  return [...map.values()];
}

function sortBySeverity(findings: GroupedFinding[]): GroupedFinding[] {
  return [...findings].sort((a, b) => SEV_RANK[a.finding.severity] - SEV_RANK[b.finding.severity]);
}

function botGlyph(bot: BotAccess, p: Paint): string {
  if (bot.allowed === true) {
    return p('✓', 'green');
  }
  if (bot.allowed === false) {
    return p('✗', 'red');
  }
  return p('–', 'dim');
}

/** AI CRAWLER ACCESS matrix — bots grouped by company. */
function botMatrix(bots: BotAccess[], p: Paint): string[] {
  const allowed = bots.filter((b) => b.allowed === true).length;
  const blocked = bots.filter((b) => b.allowed === false).length;
  const unknown = bots.length - allowed - blocked;

  const summary = [`${allowed}/${bots.length} allowed`];
  if (blocked > 0) {
    summary.push(`${blocked} blocked`);
  }
  if (unknown > 0) {
    summary.push(`${unknown} unknown`);
  }
  const lines = [`  ${p('AI CRAWLER ACCESS', 'bold')} ${p(`— ${summary.join(' · ')}`, 'dim')}`];

  const byCompany = new Map<string, BotAccess[]>();
  for (const bot of bots) {
    const list = byCompany.get(bot.company) ?? [];
    list.push(bot);
    byCompany.set(bot.company, list);
  }

  const nameWidth = Math.max(...bots.map((b) => b.name.length));
  for (const [company, companyBots] of byCompany) {
    lines.push(`    ${p(company, 'bold')}`);
    for (const bot of companyBots) {
      lines.push(
        `      ${padEndVis(bot.name, nameWidth)}  ${botGlyph(bot, p)}  ${p(bot.purpose, 'dim')}`,
      );
    }
  }
  return lines;
}

/** FINDINGS section — grouped by category, severity-sorted inside. */
function findingsSection(entries: GroupedFinding[], p: Paint): string[] {
  const byCat = new Map<RuleCategory | 'other', GroupedFinding[]>();
  for (const entry of entries) {
    const cat = categoryOf(entry.finding.ruleId);
    const list = byCat.get(cat) ?? [];
    list.push(entry);
    byCat.set(cat, list);
  }
  const orderedCats = [...RULE_CATEGORIES, 'other' as const].filter((c) => byCat.has(c));

  const idWidth = Math.min(30, Math.max(...entries.map((e) => e.finding.ruleId.length)));
  const msgWidth = Math.max(20, 74 - idWidth);

  const lines: string[] = [`  ${p('FINDINGS', 'bold')}`];
  for (const cat of orderedCats) {
    lines.push(`    ${p(categoryLabel(cat), 'bold')}`);
    for (const { finding, pages } of sortBySeverity(byCat.get(cat)!)) {
      const suffix = pages > 1 ? p(` ×${pages} pages`, 'dim') : '';
      const message = clip(finding.message, msgWidth - (pages > 1 ? 9 : 0)) + suffix;
      const glyph = p(SEV_GLYPH[finding.severity], SEV_STYLE[finding.severity]);
      const ruleId = p(padEndVis(clip(finding.ruleId, idWidth), idWidth), 'dim');
      lines.push(`      ${glyph} ${ruleId} ${message}`);
      if (finding.fix) {
        lines.push(`          ${p(`fix: ${clip(finding.fix, 60)}`, 'dim')}`);
      }
      if (finding.evidence) {
        lines.push(`          ${p(`evidence: ${clip(finding.evidence, 76)}`, 'gray')}`);
      }
    }
  }
  return lines;
}

function categoriesSection(categories: Record<RuleCategory, CategoryScore>, p: Paint): string[] {
  const rows = RULE_CATEGORIES.map((cat) => {
    const cs = categories[cat];
    if (cs.rulesRun.length === 0) {
      return [
        CATEGORY_LABELS[cat],
        p('—'.repeat(MINI_BAR_WIDTH), 'dim'),
        p('—', 'dim'),
        p('no checks', 'dim'),
      ];
    }
    return [
      CATEGORY_LABELS[cat],
      bar(cs.score, MINI_BAR_WIDTH, scoreStyle(cs.score), p),
      String(cs.score),
      issueSummary(cs, p),
    ];
  });
  const table = renderTable([{ max: 24 }, {}, { align: 'right', max: 4 }, {}], rows, '  ');
  return [`  ${p('CATEGORIES', 'bold')}`, ...table.map((line) => `    ${line}`)];
}

function severityTotals(findings: Finding[]): { errors: number; warnings: number; infos: number } {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of findings) {
    if (f.severity === 'error') {
      errors += 1;
    } else if (f.severity === 'warn') {
      warnings += 1;
    } else {
      infos += 1;
    }
  }
  return { errors, warnings, infos };
}

function passedRuleIds(categories: Record<RuleCategory, CategoryScore>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const cat of RULE_CATEGORIES) {
    for (const id of [...categories[cat].passed].sort()) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return ordered;
}

function rulesRunCount(categories: Record<RuleCategory, CategoryScore>): number {
  const seen = new Set<string>();
  for (const cat of RULE_CATEGORIES) {
    for (const id of categories[cat].rulesRun) {
      seen.add(id);
    }
  }
  return seen.size;
}

function footer(
  findings: Finding[],
  categories: Record<RuleCategory, CategoryScore>,
  opts: RenderOptions,
  p: Paint,
): string[] {
  const { errors, warnings, infos } = severityTotals(findings);
  const count = (n: number, word: string, sev: Severity) =>
    n > 0 ? p(plural(n, word), SEV_STYLE[sev]) : p(plural(n, word), 'dim');

  const passed = passedRuleIds(categories);
  const run = rulesRunCount(categories);
  const checks = run > 0 ? p(` · ${passed.length}/${run} checks passed`, 'dim') : '';

  const lines = [
    `  ${p('─'.repeat(RULE_WIDTH), 'dim')}`,
    `  ${count(errors, 'error', 'error')} ${p('·', 'dim')} ${count(warnings, 'warning', 'warn')} ${p('·', 'dim')} ${count(infos, 'hint', 'info')}${checks}`,
  ];
  if (opts.verbose === true && passed.length > 0) {
    for (const line of wrapText(`Passed: ${passed.join(', ')}`, 76, '  ')) {
      lines.push(p(line, 'dim'));
    }
  }
  return lines;
}

function scoreLine(score: number, grade: Grade, p: Paint): string {
  const style = GRADE_STYLE[grade];
  return `  ${bar(score, BAR_WIDTH, style, p)}  ${p(`${score}/100`, 'bold', style)}  ${p('Grade', 'dim')} ${p(grade, 'bold', style)}`;
}

// ---------------------------------------------------------------------------
// ScanReport
// ---------------------------------------------------------------------------

/** The flagship terminal renderer for a single-page audit. */
export function renderPretty(report: ScanReport, opts: RenderOptions = {}): string {
  const p = makePaint(opts);
  const L: string[] = [];

  // Header
  L.push(
    `  ${p(report.tool.name, 'bold')} ${p(`v${report.tool.version}`, 'dim')} ${p('— AI-search readiness', 'dim')}`,
  );
  const redirected = report.page?.redirected === true || report.finalUrl !== report.url;
  const viaRedirect = redirected ? ` ${p('→', 'dim')} ${p(report.finalUrl, 'cyan')}` : '';
  L.push(`  ${p(report.url, 'cyan', 'underline')}${viaRedirect}`);

  const meta: string[] = [];
  if (report.page) {
    const statusText = STATUS_TEXT[report.page.status];
    meta.push(`${report.page.status}${statusText ? ` ${statusText}` : ''}`);
    meta.push(report.page.contentType.split(';')[0]!.trim());
    meta.push(`TTFB ${durationLabel(report.page.timingMs)}`);
  }
  meta.push(`total ${durationLabel(report.durationMs)}`);
  meta.push(dateLabel(report.scannedAt));
  if (report.robots) {
    meta.push(`robots ${report.robots.status === 0 ? 'unreachable' : report.robots.status}`);
  }
  if (report.llmsTxt) {
    meta.push(`llms.txt ${report.llmsTxt.status === 0 ? 'unreachable' : report.llmsTxt.status}`);
  }
  L.push(`  ${p(meta.join(' · '), 'dim')}`);

  // Score bar
  L.push('');
  L.push(scoreLine(report.score, report.grade, p));

  // Categories
  L.push('');
  L.push(...categoriesSection(report.categories, p));

  // Bot matrix
  if (report.bots.length > 0) {
    L.push('');
    L.push(...botMatrix(report.bots, p));
  }

  // Findings (info severity hidden only when verbose === false)
  const shown = report.findings.filter((f) => f.severity !== 'info' || opts.verbose !== false);
  if (shown.length > 0) {
    L.push('');
    L.push(...findingsSection(groupFindings(shown, false), p));
  }

  // Footer
  L.push('');
  L.push(...footer(report.findings, report.categories, opts, p));

  return finish(L.join('\n'), opts);
}

// ---------------------------------------------------------------------------
// SiteReport
// ---------------------------------------------------------------------------

function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Worst severity across a page's findings → '✗ 2 errors' style label. */
function topIssue(page: ScanReport, p: Paint): string {
  const { errors, warnings, infos } = severityTotals(page.findings);
  if (errors > 0) {
    return p(`${SEV_GLYPH.error} ${plural(errors, 'error')}`, 'red');
  }
  if (warnings > 0) {
    return p(`${SEV_GLYPH.warn} ${plural(warnings, 'warning')}`, 'yellow');
  }
  if (infos > 0) {
    return p(`${SEV_GLYPH.info} ${plural(infos, 'hint')}`, 'cyan');
  }
  return p('✓ clean', 'green');
}

const MAX_PAGE_ROWS = 15;

function pagesSection(report: SiteReport, p: Paint): string[] {
  const sorted = [...report.pages].sort(
    (a, b) =>
      a.score - b.score || severityTotals(b.findings).errors - severityTotals(a.findings).errors,
  );
  const shown = sorted.slice(0, MAX_PAGE_ROWS);
  const rows = shown.map((page) => [
    pagePath(page.finalUrl || page.url),
    String(page.score),
    p(page.grade, 'bold', GRADE_STYLE[page.grade]),
    topIssue(page, p),
  ]);
  const lines = [
    `  ${p('PAGES', 'bold')} ${p('— worst first', 'dim')}`,
    ...renderTable(
      [{ max: 42 }, { align: 'right', max: 4 }, { align: 'right', max: 2 }, {}],
      rows,
      '  ',
    ).map((line) => `    ${line}`),
  ];
  if (sorted.length > shown.length) {
    lines.push(`    ${p(`… and ${sorted.length - shown.length} more`, 'dim')}`);
  }
  return lines;
}

/** Terminal renderer for a multi-page (crawl) audit. */
export function renderSitePretty(report: SiteReport, opts: RenderOptions = {}): string {
  const p = makePaint(opts);
  const L: string[] = [];

  L.push(
    `  ${p(report.tool.name, 'bold')} ${p(`v${report.tool.version}`, 'dim')} ${p('— site audit · AI-search readiness', 'dim')}`,
  );
  L.push(`  ${p(report.url, 'cyan', 'underline')}`);
  const failed =
    report.stats.pagesFailed > 0
      ? p(`${report.stats.pagesFailed} failed`, 'red')
      : p('0 failed', 'dim');
  L.push(
    `  ${p(`${plural(report.stats.pagesScanned, 'page')} scanned · `, 'dim')}${failed}${p(` · scanned in ${durationLabel(report.durationMs)} · ${dateLabel(report.scannedAt)}`, 'dim')}`,
  );

  L.push('');
  L.push(scoreLine(report.score, report.grade, p));

  if (report.pages.length > 0) {
    L.push('');
    L.push(...pagesSection(report, p));
  }

  L.push('');
  L.push(...categoriesSection(report.categories, p));

  const shown = report.findings.filter((f) => f.severity !== 'info' || opts.verbose !== false);
  if (shown.length > 0) {
    L.push('');
    L.push(...findingsSection(groupFindings(shown, true), p));
  }

  L.push('');
  L.push(...footer(report.findings, report.categories, opts, p));

  return finish(L.join('\n'), opts);
}
