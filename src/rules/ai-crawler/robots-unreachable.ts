import type { Rule } from '../../core/types.js';

export const robotsUnreachableRule: Rule = {
  id: 'ai-crawler/robots-unreachable',
  category: 'ai-crawler',
  title: 'robots.txt reachable',
  description:
    'If robots.txt cannot be fetched, crawler access cannot be audited — and some AI crawlers treat repeated robots.txt fetch failures as "fully disallowed" and stop crawling.',
  severity: 'warn',
  check(ctx) {
    const robots = ctx.robots;
    if (robots !== null && robots.status !== 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: 'robots.txt could not be fetched',
        detail:
          'The request for robots.txt failed at the network level. AI crawler access could not be evaluated; several engines treat an unreachable robots.txt conservatively.',
        fix: 'Make sure /robots.txt returns a 2xx (or a clean 404) quickly and reliably for crawlers.',
        evidence: robots ? `fetch failed for ${robots.url}` : 'robots data unavailable',
      },
    ];
  },
};
