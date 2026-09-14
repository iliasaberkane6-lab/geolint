import type { Rule } from '../../core/types.js';
import { wordCount } from '../_text.js';

const MIN_WORDS = 200;

export const thinContentRule: Rule = {
  id: 'content/thin-content',
  category: 'content',
  title: 'Substantive visible text',
  description:
    'Answer engines cite pages with real substance. Under ~200 words there is rarely enough self-contained, quotable material for an AI answer — thin pages get skipped.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const words = wordCount(ctx.$);
    if (words >= MIN_WORDS) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: `Thin content — only ~${words} words of visible text`,
        detail:
          'Pages with very little extractable text give AI engines nothing to quote; they also correlate with client-rendered shells.',
        fix: 'Expand the page with substantive, answerable content — explanations, specifics, Q&A.',
        evidence: `${words} words`,
      },
    ];
  },
};
