import type { Rule } from '../../core/types.js';

export const httpErrorRule: Rule = {
  id: 'technical/http-error',
  category: 'technical',
  title: 'HTTP status healthy',
  description:
    'A 4xx/5xx response means AI crawlers get an error page instead of your content — nothing to read, nothing to cite.',
  severity: 'error',
  check(ctx) {
    if (!ctx.page) {
      return [];
    }
    if (ctx.page.status < 400) {
      return [];
    }
    return [
      {
        severity: 'error',
        message: `Page returned HTTP ${ctx.page.status}`,
        detail: 'Crawlers receive the error response, not your content.',
        fix: 'Return a 200 with real content; fix the underlying 4xx/5xx or the rules that trigger it.',
        evidence: `${ctx.finalUrl} → HTTP ${ctx.page.status}`,
      },
    ];
  },
};
