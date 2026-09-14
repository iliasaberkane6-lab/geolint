import { extractJsonLd, jsonLdTypes } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

export const noFaqSchemaRule: Rule = {
  id: 'schema/no-faq-schema',
  category: 'schema',
  title: 'Question headings backed by FAQPage schema',
  description:
    'Question-shaped headings map 1:1 onto the questions users ask answer engines. Marking them up as FAQPage/QAPage makes the Q&A pairs trivially extractable — an easy citation win.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    let questionHeadings = 0;
    $('h2, h3').each((_, el) => {
      if ($(el).text().trim().endsWith('?')) {
        questionHeadings++;
      }
    });
    if (questionHeadings < 2) {
      return [];
    }
    const types = jsonLdTypes(extractJsonLd($));
    if (types.has('faqpage') || types.has('qapage')) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: `${questionHeadings} question headings present but no FAQPage schema — easy citation win`,
        detail:
          'Q&A content is exactly what answer engines quote. FAQPage markup makes those pairs machine-readable.',
        fix: 'Wrap the Q&A section in FAQPage (or QAPage) JSON-LD with Question/acceptedAnswer pairs.',
      },
    ];
  },
};
