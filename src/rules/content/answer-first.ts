import type { Rule } from '../../core/types.js';

/** A citable lead paragraph needs enough substance to stand alone in an answer. */
const MIN_ANSWER_WORDS = 20;
/** Ancestors whose paragraphs are chrome/boilerplate, never the page's answer. */
const CHROME_ANCESTORS = 'nav, aside, form, blockquote';

export const answerFirstRule: Rule = {
  id: 'content/answer-first',
  category: 'content',
  title: 'Page leads with a direct answer',
  description:
    'Answer engines favor pages that state the answer up front: the first paragraph after the H1 is the most-quoted span on the page. Leading with navigation, a hero image or a one-line teaser gives extractors nothing to cite.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    if ($('h1').length === 0) {
      return []; // content/no-h1 owns the missing-H1 case
    }

    // First real paragraph in document order after the first H1, before the
    // next section heading — that slot is where the answer should live.
    let state: 'before-h1' | 'in-lead' | 'done' = 'before-h1';
    let leadText = '';
    $('h1, h2, h3, p').each((_, el) => {
      if (state === 'done') {
        return false;
      }
      const node = $(el);
      if (state === 'before-h1') {
        if (node.is('h1')) {
          state = 'in-lead';
        }
        return;
      }
      if (node.is('h2, h3')) {
        state = 'done';
        return false;
      }
      if (node.is('h1') || node.parents(CHROME_ANCESTORS).length > 0) {
        return; // boilerplate paragraph — keep scanning for a real one
      }
      leadText = node.text().replace(/\s+/g, ' ').trim();
      state = 'done';
      return false;
    });

    if (leadText === '') {
      return [
        {
          severity: 'info',
          message: 'No paragraph directly follows the H1',
          detail:
            'Whatever sits under the H1 — image, list, navigation — is what engines read first; a declarative lead paragraph is the easiest span to cite.',
          fix: 'Open the article with a 2–4 sentence paragraph that directly answers the question the H1 poses.',
        },
      ];
    }
    const words = leadText.split(/\s+/).length;
    if (words < MIN_ANSWER_WORDS) {
      return [
        {
          severity: 'info',
          message: `Lead paragraph after the H1 is thin (~${words} words)`,
          detail:
            'A teaser or caption-length opener is hard to quote verbatim; engines prefer a self-contained answer they can lift whole.',
          fix: 'Expand the opening paragraph into a direct, self-contained answer (roughly 40–80 words) before diving into details.',
          evidence: leadText.slice(0, 120),
        },
      ];
    }
    return [];
  },
};
