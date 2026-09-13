import type { ScanReport } from '../core/types.js';
import { paint } from '../utils/color.js';
import type { RenderOptions } from './index.js';

/** Minimal pretty renderer — the reporters work package replaces this. */
export function renderPretty(report: ScanReport, _opts: RenderOptions = {}): string {
  const lines: string[] = [];
  lines.push(`geolint — ${report.url}`);
  lines.push(`score: ${report.score}/100 (${report.grade})`);
  for (const f of report.findings) {
    const tag =
      f.severity === 'error'
        ? paint.error('ERROR')
        : f.severity === 'warn'
          ? paint.warn('WARN')
          : paint.info('INFO');
    lines.push(`${tag} [${f.ruleId}] ${f.message}`);
  }
  return lines.join('\n');
}
