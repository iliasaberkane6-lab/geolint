import type { Rule } from '../../core/types.js';

const MIN_DESCRIPTION_LEN = 50;

export const metaDescriptionRule: Rule = {
  id: 'technical/meta-description',
  category: 'technical',
  title: 'Meta description present',
  description:
    'The meta description is a ready-made summary engines can quote. Absent or too short, they fall back to extracting an arbitrary passage.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const content = ctx.$('meta[name="description" i]').attr('content');
    if (content && content.trim().length >= MIN_DESCRIPTION_LEN) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: content
          ? `Meta description is very short (${content.trim().length} chars)`
          : 'No meta description',
        detail:
          'A 1–2 sentence description gives answer engines a clean, pre-written summary of the page.',
        fix: 'Write a meta[name=description] of ~50–160 characters summarizing the page.',
      },
    ];
  },
};
