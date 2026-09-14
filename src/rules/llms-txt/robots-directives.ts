import type { Rule, RuleFinding } from '../../core/types.js';

export const robotsDirectivesRule: Rule = {
  id: 'llms-txt/robots-directives',
  category: 'llms-txt',
  title: 'No robots.txt directives inside llms.txt',
  description:
    'llms.txt is a curated link index, not a control file — User-agent/Disallow lines have no effect there and usually mean the two files were confused.',
  severity: 'warn',
  check(ctx) {
    const raw = ctx.llmsTxt?.raw;
    if (!raw) {
      return [];
    }
    const hits = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^(user-agent|disallow|allow|crawl-delay|sitemap)\s*:/i.test(l));
    if (hits.length === 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: 'llms.txt contains robots.txt-style directives — they are meaningless here',
        fix: 'Remove User-agent/Disallow/Allow lines; keep llms.txt to an H1, summary and link sections.',
        evidence: hits.slice(0, 3).join(' | '),
      },
    ];
  },
};
