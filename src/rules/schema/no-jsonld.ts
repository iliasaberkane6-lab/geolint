import { extractJsonLd } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

export const noJsonLdRule: Rule = {
  id: 'schema/no-jsonld',
  category: 'schema',
  title: 'JSON-LD structured data present',
  description:
    'Structured data lets answer engines extract facts — what the page is, who wrote it, when — without guessing from prose. Pages with JSON-LD are significantly easier to cite correctly.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    if (extractJsonLd(ctx.$).length > 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: 'No JSON-LD structured data on the page',
        detail:
          'AI engines use schema.org markup to identify entities, dates, authors and page types. Without it they fall back to unreliable inference.',
        fix: 'Add JSON-LD blocks describing the page (Article, Organization, BreadcrumbList, FAQPage as appropriate).',
      },
    ];
  },
};
