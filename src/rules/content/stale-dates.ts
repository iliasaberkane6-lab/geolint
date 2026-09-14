import { extractJsonLd } from '../../core/schema.js';
import type { Rule } from '../../core/types.js';

const DATE_METAS =
  'meta[property="article:published_time"], meta[property="article:modified_time"], meta[name="date"], meta[name="datePublished"], meta[name="dateModified"], meta[itemprop="datePublished"], meta[itemprop="dateModified"]';
const JSONLD_DATE_KEYS = new Set(['datepublished', 'datemodified']);
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

/** Collect string values of datePublished/dateModified anywhere in a JSON-LD tree. */
function collectJsonLdDates(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectJsonLdDates(item, out);
    }
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (JSONLD_DATE_KEYS.has(key.toLowerCase()) && typeof value === 'string') {
      out.push(value);
    } else if (value && typeof value === 'object') {
      collectJsonLdDates(value, out);
    }
  }
}

export const staleDatesRule: Rule = {
  id: 'content/stale-dates',
  category: 'content',
  title: 'Dates look fresh to answer engines',
  description:
    'A visible date that is years old tells answer engines the content is stale — they preferentially cite recently dated pages for freshness-sensitive questions.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const raw: string[] = [];
    $('time[datetime]').each((_, el) => {
      const v = $(el).attr('datetime');
      if (v) {
        raw.push(v);
      }
    });
    $(DATE_METAS).each((_, el) => {
      const v = $(el).attr('content');
      if (v) {
        raw.push(v);
      }
    });
    for (const block of extractJsonLd($)) {
      if (block.data) {
        collectJsonLdDates(block.data, raw);
      }
    }

    const newest = Math.max(...raw.map((v) => Date.parse(v)).filter((t) => Number.isFinite(t)));
    if (!Number.isFinite(newest)) {
      return []; // content/missing-dates owns the no-date case
    }
    if (Date.now() - newest <= TWO_YEARS_MS) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'Newest machine-readable date is over 2 years old',
        detail:
          'Engines weigh declared freshness when choosing citations; an ancient datePublished/dateModified quietly deprioritizes the page even when the content is still accurate.',
        fix: 'If the content is current, update dateModified (and the visible date) to reflect the last real review; otherwise consider refreshing it.',
        evidence: `newest date found: ${new Date(newest).toISOString().slice(0, 10)}`,
      },
    ];
  },
};
