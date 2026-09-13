import type { Rule } from '../../core/types.js';

/**
 * TEMPLATE RULE — copy this pattern for every new rule:
 * - id: '<category>/<kebab-name>'
 * - handle ctx.page === null gracefully (target unreachable)
 * - return [] when the check passes
 * - always provide actionable `fix` text on failures
 */
export const httpsRule: Rule = {
  id: 'technical/https',
  category: 'technical',
  title: 'Site served over HTTPS',
  description:
    'AI crawlers and answer engines prefer secure origins; several decline to index or cite plain-HTTP pages.',
  severity: 'error',
  check(ctx) {
    if (ctx.page === null) {
      return [];
    }
    if (!ctx.finalUrl.startsWith('https://')) {
      return [
        {
          severity: 'error',
          message: 'Page is not served over HTTPS',
          detail: `Final URL is ${ctx.finalUrl}`,
          fix: 'Serve the site over HTTPS and redirect http:// to https://.',
          evidence: ctx.finalUrl,
        },
      ];
    }
    return [];
  },
};
