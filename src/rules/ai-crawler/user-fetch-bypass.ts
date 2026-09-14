import { AI_BOTS } from '../../core/bots.js';
import { isAllowed } from '../../core/robots.js';
import type { Rule, RuleFinding } from '../../core/types.js';

export const userFetchBypassRule: Rule = {
  id: 'ai-crawler/user-fetch-bypass',
  category: 'ai-crawler',
  title: 'User-triggered fetchers that ignore robots.txt',
  description:
    'OpenAI, Perplexity and Meta document that their user-initiated fetchers (ChatGPT-User, Perplexity-User, Meta-ExternalFetcher) may not honor robots.txt — a Disallow does not stop them, so blocking them only creates a false sense of control.',
  severity: 'info',
  check(ctx) {
    const robots = ctx.robots;
    if (!robots || robots.raw == null) {
      return [];
    }
    const findings: RuleFinding[] = [];
    for (const bot of AI_BOTS) {
      if (bot.robotsTxt !== 'bypass') {
        continue;
      }
      const verdict = isAllowed(robots.groups, bot.id, '/');
      if (verdict.allowed) {
        continue;
      }
      findings.push({
        severity: 'info',
        message: `${bot.name} is disallowed, but ${bot.company} documents that it may ignore robots.txt`,
        detail:
          'User-triggered fetchers act on behalf of a person, so vendors treat them more like a browser than a crawler.',
        fix: `If you need to block ${bot.name}, enforce it at the WAF/auth layer (IP ranges, signed requests), not via robots.txt.`,
        evidence: verdict.matchedRule
          ? `Disallow: ${verdict.matchedRule.path} (matched by ${bot.id})`
          : `User-agent: ${bot.id}`,
      });
    }
    return findings;
  },
};
