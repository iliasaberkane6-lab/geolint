import type { ScanReport, SiteReport } from '../core/types.js';
import { renderCompare as renderCompareReport } from './compare.js';
import { renderHtmlReport, renderHtmlSiteReport } from './html.js';
import { renderJson } from './json.js';
import { renderMarkdown, renderSiteMarkdown } from './markdown.js';
import { renderPretty, renderSitePretty } from './pretty.js';
import { renderSarif, renderSiteSarif } from './sarif.js';

export type ReportFormat = 'pretty' | 'json' | 'sarif' | 'markdown' | 'html';

export const REPORT_FORMATS: ReportFormat[] = ['pretty', 'json', 'sarif', 'markdown', 'html'];

export interface RenderOptions {
  /** Force colors on/off. Default: auto (TTY detection). */
  color?: boolean;
  /**
   * Include info-severity findings ('hints'). Default true — pass false to
   * hide them. When true, the footer also lists passed rule ids compactly.
   */
  verbose?: boolean;
}

/** Render a single-page scan report to a string for stdout/file output. */
export function renderReport(
  report: ScanReport,
  format: ReportFormat,
  opts: RenderOptions = {},
): string {
  switch (format) {
    case 'json':
      return renderJson(report);
    case 'sarif':
      return renderSarif(report);
    case 'markdown':
      return renderMarkdown(report);
    case 'html':
      return renderHtmlReport(report, opts);
    case 'pretty':
      return renderPretty(report, opts);
  }
}

/** Render a multi-page (crawl) report. */
export function renderSiteReport(
  report: SiteReport,
  format: ReportFormat,
  opts: RenderOptions = {},
): string {
  switch (format) {
    case 'json':
      return renderJson(report);
    case 'sarif':
      return renderSiteSarif(report);
    case 'markdown':
      return renderSiteMarkdown(report);
    case 'html':
      return renderHtmlSiteReport(report, opts);
    case 'pretty':
      return renderSitePretty(report, opts);
  }
}

/** Side-by-side comparison of two scan reports (used by `check --compare`). */
export function renderCompare(a: ScanReport, b: ScanReport, opts: RenderOptions = {}): string {
  return renderCompareReport(a, b, opts);
}
