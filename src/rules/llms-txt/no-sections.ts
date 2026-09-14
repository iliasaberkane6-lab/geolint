import type { Rule } from '../../core/types.js';

export const noSectionsRule: Rule = {
  id: 'llms-txt/no-sections',
  category: 'llms-txt',
  title: 'llms.txt has link sections',
  description:
    'The point of llms.txt is its curated link lists under H2 sections — they are the map AI systems follow to your most citable pages. A file without sections or links is a dead end.',
  severity: 'warn',
  check(ctx) {
    const parsed = ctx.llmsTxt?.parsed;
    if (!parsed) {
      return [];
    }
    const missing: string[] = [];
    if (parsed.sections.length === 0) {
      missing.push('no ## sections');
    }
    if (parsed.linkCount === 0) {
      missing.push('no markdown links');
    }
    if (missing.length === 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: `llms.txt has ${missing.join(' and ')}`,
        detail:
          'Without H2 sections containing markdown link lists, AI consumers get no curated entry points into your content.',
        fix: 'Add "## Docs", "## Guides" etc. sections with bullet lists of [Title](url) links to key pages.',
      },
    ];
  },
};
