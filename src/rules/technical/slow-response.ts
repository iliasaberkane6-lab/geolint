import type { Rule } from '../../core/types.js';

const WARN_MS = 2000;
const INFO_MS = 800;

export const slowResponseRule: Rule = {
  id: 'technical/slow-response',
  category: 'technical',
  title: 'Fast initial response',
  description:
    'AI crawlers operate under strict fetch budgets and timeouts. A slow TTFB means fewer pages crawled per visit — or timeouts that leave the site partially invisible.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.page) {
      return [];
    }
    const { timingMs } = ctx.page;
    if (timingMs > WARN_MS) {
      return [
        {
          severity: 'warn',
          message: `Slow response — ${timingMs}ms to fetch`,
          detail: 'Above ~2s, crawlers start skipping or timing out on pages.',
          fix: 'Reduce TTFB: caching, CDN, faster rendering — target under ~800ms.',
          evidence: `${timingMs}ms`,
        },
      ];
    }
    if (timingMs > INFO_MS) {
      return [
        {
          severity: 'info',
          message: `Response could be faster — ${timingMs}ms`,
          detail: 'Sub-second responses let crawlers cover more of your site per visit.',
          fix: 'Consider caching/CDN improvements to get under ~800ms.',
          evidence: `${timingMs}ms`,
        },
      ];
    }
    return [];
  },
};
