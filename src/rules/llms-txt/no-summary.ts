import type { Rule } from '../../core/types.js';

export const noSummaryRule: Rule = {
  id: 'llms-txt/no-summary',
  category: 'llms-txt',
  title: 'llms.txt has a summary',
  description:
    'The blockquote right after the H1 is the short, self-contained description AI systems quote when they need to explain what a site is. Missing it means engines guess.',
  severity: 'info',
  check(ctx) {
    const parsed = ctx.llmsTxt?.parsed;
    if (!parsed) {
      return [];
    }
    if (parsed.summary !== null) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'llms.txt has no blockquote summary',
        detail:
          'Per the spec, a "> ..." blockquote after the H1 carries the short description AI systems read first.',
        fix: 'Add a one-paragraph blockquote ("> ...") under the H1 summarizing what the site offers.',
      },
    ];
  },
};
