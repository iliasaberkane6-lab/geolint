import type { Rule } from '../../core/types.js';

export const noQuestionHeadingsRule: Rule = {
  id: 'content/no-question-headings',
  category: 'content',
  title: 'Question-shaped headings',
  description:
    'Headings phrased as questions mirror how users prompt answer engines. A page whose h2/h3 literally ask the questions users ask is far easier to match and cite.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    let found = false;
    $('h2, h3').each((_, el) => {
      if ($(el).text().trim().endsWith('?')) {
        found = true;
      }
    });
    if (found) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'No question-shaped headings (h2/h3 ending in "?")',
        detail:
          'Question headings map directly onto user prompts and make sections self-contained citable answers.',
        fix: 'Rewrite a few section headings as the actual questions your audience asks.',
      },
    ];
  },
};
