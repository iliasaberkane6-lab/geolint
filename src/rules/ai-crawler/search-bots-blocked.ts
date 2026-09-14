import { AI_BOTS } from '../../core/bots.js';
import { isAllowed } from '../../core/robots.js';
import type { Rule, RuleFinding } from '../../core/types.js';

/** Blocking these bots removes the site from current AI answers. */
const CITATION_PURPOSES = new Set(['search', 'user-fetch', 'mixed']);

export const searchBotsBlockedRule: Rule = {
  id: 'ai-crawler/search-bots-blocked',
  category: 'ai-crawler',
  title: 'AI search and user-fetch bots allowed by robots.txt',
  description:
    'ChatGPT, Perplexity, Claude and other answer engines can only cite pages their crawlers are allowed to fetch. A Disallow for a search or user-fetch bot removes the site from current AI answers.',
  severity: 'error',
  check(ctx) {
    const robots = ctx.robots;
    if (!robots || robots.raw == null) {
      return [];
    }
    const findings: RuleFinding[] = [];
    for (const bot of AI_BOTS) {
      // Retired tokens never fetch; 'bypass' fetchers ignore Disallow anyway
      // (reported by ai-crawler/user-fetch-bypass instead).
      if (bot.retired || bot.robotsTxt === 'bypass' || !CITATION_PURPOSES.has(bot.purpose)) {
        continue;
      }
      const verdict = isAllowed(robots.groups, bot.id, '/');
      if (verdict.allowed) {
        continue;
      }
      findings.push({
        severity: 'error',
        message: `${bot.name} is blocked by robots.txt — ${bot.company} cannot use your pages as AI answer sources`,
        detail: `${bot.name} (${bot.purpose}) is disallowed from the site root, so ${bot.company} cannot read or cite this site.`,
        fix: `Remove the Disallow covering ${bot.id} in robots.txt, or add an explicit "Allow: /" for it.`,
        evidence: verdict.matchedRule
          ? `${verdict.matchedRule.type === 'disallow' ? 'Disallow' : 'Allow'}: ${verdict.matchedRule.path} (matched by ${bot.id})`
          : `User-agent: ${bot.id}`,
      });
    }
    return findings;
  },
};
