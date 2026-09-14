import type { Rule } from '../../core/types.js';
import { visibleText } from '../_text.js';

/** Numbers with a unit/magnitude — the kind of stats engines love to quote. */
const DATA_POINT_RE = /\b\d+(?:[.,]\d+)?\s*(?:%|percent|million|billion|bn|x|k|m)(?!\w)/gi;
const MIN_DATA_POINTS = 3;

export const noDataPointsRule: Rule = {
  id: 'content/no-data-points',
  category: 'content',
  title: 'Concrete data points',
  description:
    'Statistics and concrete numbers are among the most-cited sentence shapes in AI answers ("X grew 34%"). Pages without any quotable data are harder to cite than pages with stats.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const matches = visibleText(ctx.$).match(DATA_POINT_RE) ?? [];
    if (matches.length >= MIN_DATA_POINTS) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: `Few concrete data points found (${matches.length} numeric stats)`,
        detail:
          'Percentages, growth figures and quantities give AI engines precise, attributable claims to quote.',
        fix: 'Add verifiable numbers — percentages, counts, benchmarks — near the claims they support.',
      },
    ];
  },
};
