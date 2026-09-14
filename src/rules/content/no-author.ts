import { extractJsonLd } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

const JSONLD_AUTHOR_RE = /"author"\s*:/;

export const noAuthorRule: Rule = {
  id: 'content/no-author',
  category: 'content',
  title: 'Author attribution',
  description:
    'E-E-A-T applies to AI search too: attributable content (named author, ideally with credentials) is more trustworthy and more citable than anonymous prose.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const hasMetaAuthor = $('meta[name="author"]').length > 0;
    const hasRelAuthor = $('[rel~="author" i]').length > 0;
    const hasAuthorMarkup =
      $('[class*="author" i], [id*="author" i], [class*="byline" i], [id*="byline" i]').length > 0;
    const hasJsonLdAuthor = extractJsonLd($).some((b) => JSONLD_AUTHOR_RE.test(b.raw));
    if (hasMetaAuthor || hasRelAuthor || hasAuthorMarkup || hasJsonLdAuthor) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'No author attribution found',
        detail:
          'No meta[name=author], rel=author, JSON-LD author or author/byline markup — the content looks anonymous.',
        fix: 'Attribute the content: an author byline, meta[name=author] or a Person in JSON-LD author.',
      },
    ];
  },
};
