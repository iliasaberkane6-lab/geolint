import type { Rule, RuleFinding } from '../../core/types.js';

export const multipleH1Rule: Rule = {
  id: 'llms-txt/multiple-h1',
  category: 'llms-txt',
  title: 'Exactly one H1 in llms.txt',
  description:
    'The spec requires exactly one H1 (the project name) as the first element — multiple H1s make the file ambiguous to parse.',
  severity: 'info',
  check(ctx) {
    const raw = ctx.llmsTxt?.raw;
    if (!raw) {
      return [];
    }
    const h1Count = raw.split(/\r?\n/).filter((l) => /^#\s/.test(l.trim())).length;
    if (h1Count > 1) {
      return [
        {
          severity: 'info',
          message: `llms.txt has ${h1Count} H1 headings — exactly one is expected`,
          fix: 'Keep a single "# Site Name" H1; demote others to H2 sections or plain text.',
        },
      ];
    }
    return [];
  },
};
