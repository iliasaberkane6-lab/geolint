import { extractJsonLd, jsonLdTypes } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

export const noOrganizationRule: Rule = {
  id: 'schema/no-organization',
  category: 'schema',
  title: 'Organization schema present',
  description:
    'Organization markup grounds your site to a real-world entity. Answer engines use it for knowledge-graph disambiguation — to know *who* is speaking before deciding whether to trust and cite them.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const types = jsonLdTypes(extractJsonLd(ctx.$));
    if (types.has('organization')) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'No Organization schema found',
        detail:
          'Without entity grounding, engines cannot connect this site to a known organization — weaker trust signals for citation.',
        fix: 'Add an Organization JSON-LD block (name, url, logo, sameAs links) at least on the homepage.',
      },
    ];
  },
};
