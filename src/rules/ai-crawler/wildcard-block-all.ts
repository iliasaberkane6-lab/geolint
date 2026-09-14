import { isAllowed } from '../../core/robots.js';
import type { Rule, RuleFinding } from '../../core/types.js';

export const wildcardBlockAllRule: Rule = {
  id: 'ai-crawler/wildcard-block-all',
  category: 'ai-crawler',
  title: 'No wildcard "Disallow: /" in robots.txt',
  description:
    'A "User-agent: *" group that disallows the site root blocks every crawler without a more specific group — including AI crawlers you have never heard of and future answer engines.',
  severity: 'error',
  check(ctx) {
    const robots = ctx.robots;
    if (!robots || robots.raw == null) {
      return [];
    }
    const findings: RuleFinding[] = [];
    for (const group of robots.groups) {
      if (!group.agents.includes('*')) {
        continue;
      }
      // Evaluate the wildcard group on its own: does it disallow '/'?
      if (isAllowed([group], '*', '/').allowed) {
        continue;
      }
      const disallowLines = group.rules
        .filter((r) => r.type === 'disallow' && r.path !== '')
        .map((r) => `Disallow: ${r.path}`);
      findings.push({
        severity: 'error',
        message:
          'A "User-agent: *" group disallows the entire site — every AI crawler without its own group is blocked',
        detail:
          'The wildcard group is the fallback for every bot, so unknown and future AI crawlers are locked out unless they have a dedicated group with an Allow.',
        fix: 'Remove the site-wide "Disallow: /" from the wildcard group, or add explicit Allow groups for the AI bots you want to welcome.',
        evidence: ['User-agent: *', ...disallowLines].join('\n'),
      });
    }
    return findings;
  },
};
