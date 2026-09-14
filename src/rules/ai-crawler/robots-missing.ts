import type { Rule } from '../../core/types.js';

export const robotsMissingRule: Rule = {
  id: 'ai-crawler/robots-missing',
  category: 'ai-crawler',
  title: 'robots.txt present',
  description:
    'Without a robots.txt, AI crawler access is uncontrolled: every bot assumes it may crawl everything, and you cannot grant or deny access per bot. A robots.txt is the standard way to welcome AI search crawlers explicitly.',
  severity: 'warn',
  check(ctx) {
    const robots = ctx.robots;
    // null / status 0 = fetch failed → reported by ai-crawler/robots-unreachable.
    if (robots === null || robots.status === 0) {
      return [];
    }
    const missing = robots.raw === null || (robots.status >= 400 && robots.status < 500);
    if (!missing) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: 'No robots.txt — AI crawler access is uncontrolled',
        detail: `GET ${robots.url} returned HTTP ${robots.status}. Bots fall back to "everything allowed", and you have no way to welcome or restrict specific AI crawlers.`,
        fix: 'Publish a /robots.txt that explicitly Allows the AI search bots you want (e.g. OAI-SearchBot, PerplexityBot, Claude-SearchBot).',
        evidence: `HTTP ${robots.status} for ${robots.url}`,
      },
    ];
  },
};
