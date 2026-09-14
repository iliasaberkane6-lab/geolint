import { AI_BOTS } from '../../core/bots.js';
import { matchGroup } from '../../core/robots.js';
import type { RobotGroup, Rule, RuleFinding } from '../../core/types.js';

export const crawlDelayRule: Rule = {
  id: 'ai-crawler/crawl-delay',
  category: 'ai-crawler',
  title: 'No crawl-delay slowing AI crawlers',
  description:
    'A Crawl-delay that applies to AI bots throttles how fast they can ingest your site. That slows down indexing and can make fresh content invisible to AI answers for longer.',
  severity: 'info',
  check(ctx) {
    const robots = ctx.robots;
    if (!robots || robots.raw == null || robots.groups.length === 0) {
      return [];
    }
    // One finding per group (a wildcard delay would otherwise report ~30 bots).
    const byGroup = new Map<RobotGroup, string[]>();
    for (const bot of AI_BOTS) {
      const group = matchGroup(robots.groups, bot.id);
      if (group && group.crawlDelay !== undefined) {
        const list = byGroup.get(group) ?? [];
        list.push(bot.name);
        byGroup.set(group, list);
      }
    }
    const findings: RuleFinding[] = [];
    for (const [group, bots] of byGroup) {
      const wildcard = group.agents.includes('*');
      findings.push({
        severity: 'info',
        message: wildcard
          ? `Crawl-delay of ${group.crawlDelay}s applies to every AI crawler`
          : `Crawl-delay of ${group.crawlDelay}s applies to ${bots.join(', ')}`,
        detail: wildcard
          ? 'The delay is set on the "User-agent: *" group, so it throttles all AI bots without a more specific group.'
          : `Affected AI bots: ${bots.join(', ')}.`,
        fix: 'Remove the Crawl-delay or exempt AI search bots with their own groups if you want your content indexed promptly.',
        evidence: `User-agent: ${group.agents.join(', ')}\nCrawl-delay: ${group.crawlDelay}`,
      });
    }
    return findings;
  },
};
