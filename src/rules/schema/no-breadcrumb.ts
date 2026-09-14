import { extractJsonLd, jsonLdTypes } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

export const noBreadcrumbRule: Rule = {
  id: 'schema/no-breadcrumb',
  category: 'schema',
  title: 'BreadcrumbList schema present',
  description:
    'BreadcrumbList tells crawlers where a page sits in the site hierarchy, giving AI systems context about topic relationships — useful when they decide which page of yours to cite.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const types = jsonLdTypes(extractJsonLd(ctx.$));
    if (types.has('breadcrumblist')) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'No BreadcrumbList schema found',
        detail:
          'Breadcrumbs expose site structure to machines; without them a page floats without context.',
        fix: 'Add BreadcrumbList JSON-LD matching the visible breadcrumb trail.',
      },
    ];
  },
};
