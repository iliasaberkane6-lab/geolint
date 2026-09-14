import { AI_BOTS } from '../../core/bots.js';
import { isAllowed } from '../../core/robots.js';
import type { Rule, RuleFinding } from '../../core/types.js';

export const trainingBotsBlockedRule: Rule = {
  id: 'ai-crawler/training-bots-blocked',
  category: 'ai-crawler',
  title: 'AI training bots allowed by robots.txt',
  description:
    'Training crawlers collect the corpus future models learn from. Blocking them does not affect citations today, but it keeps your content out of the training data of the next model generation.',
  severity: 'warn',
  check(ctx) {
    const robots = ctx.robots;
    if (!robots || robots.raw == null) {
      return [];
    }
    const findings: RuleFinding[] = [];
    for (const bot of AI_BOTS) {
      if (bot.purpose !== 'training') {
        continue;
      }
      const verdict = isAllowed(robots.groups, bot.id, '/');
      if (verdict.allowed) {
        continue;
      }
      findings.push({
        severity: 'warn',
        message: `${bot.name} is blocked by robots.txt`,
        detail: `${bot.name} collects training data for ${bot.company}. Blocking it does not hurt current citations, but future models may not know your content.`,
        fix: `If you want ${bot.company} models to learn from your content, remove the Disallow covering ${bot.id} or add an explicit "Allow: /".`,
        evidence: verdict.matchedRule
          ? `${verdict.matchedRule.type === 'disallow' ? 'Disallow' : 'Allow'}: ${verdict.matchedRule.path} (matched by ${bot.id})`
          : `User-agent: ${bot.id}`,
      });
    }
    return findings;
  },
};
