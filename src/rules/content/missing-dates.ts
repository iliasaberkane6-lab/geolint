import { extractJsonLd } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

const DATE_METAS =
  'meta[property="article:published_time"], meta[property="article:modified_time"], meta[name="date"], meta[name="datePublished"], meta[name="dateModified"], meta[itemprop="datePublished"], meta[itemprop="dateModified"]';
const JSONLD_DATE_RE = /"datePublished|dateModified"\s*:/;

export const missingDatesRule: Rule = {
  id: 'content/missing-dates',
  category: 'content',
  title: 'Visible publication/modified date',
  description:
    'Freshness is one of the top citation signals: answer engines strongly prefer pages they can date. No machine-readable date means no freshness credit.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const hasTime = $('time[datetime]').length > 0;
    const hasMeta = $(DATE_METAS).length > 0;
    const hasJsonLd = extractJsonLd($).some((b) => JSONLD_DATE_RE.test(b.raw));
    if (hasTime || hasMeta || hasJsonLd) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: 'No machine-readable publication or modified date found',
        detail:
          'Checked <time datetime>, article:* meta tags and JSON-LD datePublished/dateModified — none present.',
        fix: 'Expose a date via <time datetime="…">, article:published_time meta or JSON-LD datePublished/dateModified.',
      },
    ];
  },
};
