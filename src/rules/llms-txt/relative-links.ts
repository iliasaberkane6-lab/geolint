import type { Rule, RuleFinding } from '../../core/types.js';

export const relativeLinksRule: Rule = {
  id: 'llms-txt/relative-links',
  category: 'llms-txt',
  title: 'llms.txt links are absolute URLs',
  description:
    'The llms.txt spec expects absolute URLs in link items — an LLM reading the file has no base URL to resolve relative paths against.',
  severity: 'warn',
  check(ctx) {
    const parsed = ctx.llmsTxt?.parsed;
    if (!parsed) {
      return [];
    }
    const relative: string[] = [];
    for (const section of parsed.sections) {
      for (const link of section.links) {
        if (!/^https?:\/\//i.test(link.url)) {
          relative.push(link.url);
        }
      }
    }
    if (relative.length === 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: `${relative.length} relative link(s) in llms.txt — links must be absolute URLs`,
        fix: 'Rewrite link targets as absolute URLs including https:// scheme.',
        evidence: relative.slice(0, 5).join(', ') + (relative.length > 5 ? '…' : ''),
      },
    ];
  },
};
