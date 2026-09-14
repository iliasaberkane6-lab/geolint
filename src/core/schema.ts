import type { CheerioAPI } from 'cheerio';

export interface JsonLdBlock {
  /** Parsed JSON, or null when the block failed to parse. */
  data: unknown;
  parseError?: string;
  raw: string;
}

/** Extract every <script type="application/ld+json"> block (incl. charset variants). */
export function extractJsonLd($: CheerioAPI): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];
  $('script[type^="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) {
      return;
    }
    try {
      blocks.push({ data: JSON.parse(raw), raw });
    } catch (err) {
      blocks.push({
        data: null,
        raw,
        parseError: err instanceof Error ? err.message : 'invalid JSON',
      });
    }
  });
  return blocks;
}

/** Collect every @type value across blocks, @graph entries and arrays. */
export function jsonLdTypes(blocks: JsonLdBlock[]): Set<string> {
  const types = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    const obj = node as Record<string, unknown>;
    const t = obj['@type'];
    if (typeof t === 'string') {
      types.add(t.toLowerCase());
    } else if (Array.isArray(t)) {
      for (const x of t) {
        if (typeof x === 'string') {
          types.add(x.toLowerCase());
        }
      }
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };
  for (const block of blocks) {
    visit(block.data);
  }
  return types;
}

/** Types that make content machine-readable for AI answers. */
export const CITABILITY_SCHEMA_TYPES = [
  'article',
  'newsarticle',
  'blogposting',
  'techarticle',
  'faqpage',
  'qapage',
  'howto',
  'product',
  'organization',
  'person',
  'breadcrumblist',
  'webpage',
  'webpageelement',
  'speakable',
  'itemlist',
  'recipe',
  'event',
  'jobposting',
  'softwareapplication',
  'dataset',
  'review',
  'aggregateoffer',
] as const;
