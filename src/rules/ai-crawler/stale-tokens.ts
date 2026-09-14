import { AI_BOTS } from '../../core/bots.js';
import type { Rule, RuleFinding } from '../../core/types.js';

export const staleTokensRule: Rule = {
  id: 'ai-crawler/stale-tokens',
  category: 'ai-crawler',
  title: 'Retired AI bot tokens in robots.txt',
  description:
    'Robots.txt entries for retired tokens (e.g. anthropic-ai, Claude-Web, FacebookBot, omgilibot) do nothing — the vendors moved to new user-agents. Stale rules are a maintenance smell and can mask that the intended bot is actually unrestricted.',
  severity: 'info',
  check(ctx) {
    const robots = ctx.robots;
    if (!robots || robots.raw == null) {
      return [];
    }
    const retired = AI_BOTS.filter((b) => b.retired);
    const findings: RuleFinding[] = [];
    const seen = new Set<string>();
    for (const group of robots.groups) {
      for (const agent of group.agents) {
        const bot = retired.find(
          (b) =>
            (agent === '*' ? false : b.id.toLowerCase().startsWith(agent)) ||
            agent === b.id.toLowerCase(),
        );
        if (!bot || seen.has(bot.id)) {
          continue;
        }
        seen.add(bot.id);
        findings.push({
          severity: 'info',
          message: `Stale token '${agent}' — ${bot.company} now uses '${bot.replacedBy ?? 'a different token'}'`,
          detail: `'${agent}' matched retired token ${bot.id}; this rule has no effect on current ${bot.company} crawlers.`,
          fix: bot.replacedBy
            ? `Replace 'User-agent: ${agent}' with 'User-agent: ${bot.replacedBy}' (or delete the stale block).`
            : `Remove 'User-agent: ${agent}' — the token is retired.`,
          evidence: `User-agent: ${agent}`,
        });
      }
    }
    return findings;
  },
};
