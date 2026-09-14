import type { Rule } from '../../core/types.js';

export const titleMissingRule: Rule = {
  id: 'technical/title-missing',
  category: 'technical',
  title: 'Page title present',
  description:
    'The title is the default label answer engines attach to a citation. No title means an engine either invents one or cites a bare URL.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const title = ctx.$('title').first().text().trim();
    if (title !== '') {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: 'Missing or empty <title>',
        detail: 'The title is the primary human-readable label attached to the page in AI answers.',
        fix: 'Add a descriptive <title> that names the page and its purpose.',
      },
    ];
  },
};
