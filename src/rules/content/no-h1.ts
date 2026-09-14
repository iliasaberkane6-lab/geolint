import type { Rule } from '../../core/types.js';

export const noH1Rule: Rule = {
  id: 'content/no-h1',
  category: 'content',
  title: 'Single descriptive H1',
  description:
    'The H1 is the strongest single "what is this page" signal in the document. AI systems lean on it when deciding whether the page answers a question — a missing or empty H1 leaves them guessing.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const h1s = $('h1');
    const nonEmpty = h1s.toArray().filter((el) => $(el).text().trim() !== '');
    if (nonEmpty.length > 1) {
      return [
        {
          severity: 'info',
          message: `${nonEmpty.length} <h1> elements on the page`,
          detail:
            'A single H1 anchors the page topic; several competing H1s dilute the signal machines use to understand it.',
          fix: 'Keep one descriptive <h1>; demote the others to <h2> or below.',
        },
      ];
    }
    if (nonEmpty.length === 1) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: h1s.length === 0 ? 'No <h1> on the page' : 'The <h1> is empty',
        detail: 'The H1 anchors how machines understand and index the page topic.',
        fix: 'Add one descriptive <h1> that states what the page is about.',
      },
    ];
  },
};
