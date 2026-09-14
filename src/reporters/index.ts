import type { ScanReport, SiteReport } from '../core/types.js';
import { renderPretty } from './pretty.js';

export type ReportFormat = 'pretty' | 'json' | 'sarif' | 'markdown';

export const REPORT_FORMATS: ReportFormat[] = ['pretty', 'json', 'sarif', 'markdown'];

export interface RenderOptions {
  /** Force colors on/off. Default: auto (TTY detection). */
  color?: boolean;
  /** Include findings of severity info. Default true. */
  verbose?: boolean;
}

/** Render a single-page scan report to a string for stdout/file output. */
export function renderReport(
  report: ScanReport,
  format: ReportFormat,
  opts: RenderOptions = {},
): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  // sarif/markdown implemented alongside the other reporters.
  return renderPretty(report, opts);
}

/** Render a multi-page (crawl) report. */
export function renderSiteReport(
  report: SiteReport,
  format: ReportFormat,
  opts: RenderOptions = {},
): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  // Pretty fallback: treat the aggregate as a pseudo-scan for now.
  const pseudo: ScanReport = {
    tool: report.tool,
    url: report.url,
    finalUrl: report.url,
    scannedAt: report.scannedAt,
    durationMs: report.durationMs,
    page: null,
    robots: null,
    llmsTxt: null,
    bots: [],
    findings: report.findings,
    score: report.score,
    grade: report.grade,
    categories: report.categories,
  };
  return renderPretty(pseudo, opts);
}

/** Side-by-side comparison of two scan reports (used by `check --compare`). */
export function renderCompare(_a: ScanReport, _b: ScanReport, _opts: RenderOptions = {}): string {
  return '';
}
