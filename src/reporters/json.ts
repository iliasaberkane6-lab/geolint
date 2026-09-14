import type { ScanReport, SiteReport } from '../core/types.js';

/** Machine-readable renderer — the report verbatim as pretty-printed JSON. */
export function renderJson(report: ScanReport | SiteReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
