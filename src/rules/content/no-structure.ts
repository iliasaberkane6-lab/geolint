import type { Rule } from '../../core/types.js';
import { wordCount } from '../_text.js';

const MIN_WORDS = 500;

export const noStructureRule: Rule = {
  id: 'content/no-structure',
  category: 'content',
  title: 'Structured content (lists/tables)',
  description:
    'Lists, tables and definition lists are the easiest content for AI systems to lift verbatim into an answer. A long wall of prose with zero structure is harder to quote.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    if (wordCount($) <= MIN_WORDS) {
      return [];
    }
    if ($('body').find('ul, ol, table, dl').length > 0) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'Long page with no lists or tables',
        detail:
          'Bulleted lists and tables give answer engines pre-structured, quotable units of content.',
        fix: 'Convert enumerations and comparisons into <ul>/<ol> lists or <table> markup.',
      },
    ];
  },
};
