import type { Rule } from '../../core/types.js';

export const redirectRule: Rule = {
  id: 'technical/redirect',
  category: 'technical',
  title: 'No unexpected redirect',
  description:
    'Redirects are fine, but they cost crawl budget and can mask canonical problems. Knowing where a URL actually lands matters for how engines index it.',
  severity: 'info',
  check(ctx) {
    if (!ctx.page) {
      return [];
    }
    if (!ctx.page.redirected) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'The URL redirected to a different final URL',
        detail: `Requested ${ctx.url}, ended at ${ctx.finalUrl}.`,
        fix: 'Make sure redirects are intentional, single-hop and point at the canonical destination.',
        evidence: `${ctx.url} → ${ctx.finalUrl}`,
      },
    ];
  },
};
