import { extractJsonLd } from '../../core/schema.js';
import type { Rule, RuleFinding } from '../../core/types.js';

const ARTICLE_TYPES = new Set(['article', 'newsarticle', 'blogposting', 'techarticle']);

type JsonObject = Record<string, unknown>;

function typeNames(obj: JsonObject): string[] {
  const t = obj['@type'];
  if (typeof t === 'string') {
    return [t.toLowerCase()];
  }
  if (Array.isArray(t)) {
    return t.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase());
  }
  return [];
}

/** Collect every node whose @type is an article type, walking @graph and nested values. */
function collectArticles(node: unknown, out: JsonObject[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectArticles(item, out);
    }
    return;
  }
  const obj = node as JsonObject;
  if (typeNames(obj).some((t) => ARTICLE_TYPES.has(t))) {
    out.push(obj);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      collectArticles(value, out);
    }
  }
}

export const missingArticleFieldsRule: Rule = {
  id: 'schema/missing-article-fields',
  category: 'schema',
  title: 'Article schema has headline/date/author',
  description:
    'headline, datePublished and author are the fields answer engines read first from an Article — they feed the citation line. An Article without them wastes most of its citability.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const articles: JsonObject[] = [];
    for (const block of extractJsonLd(ctx.$)) {
      if (block.data) {
        collectArticles(block.data, articles);
      }
    }
    const findings: RuleFinding[] = [];
    for (const article of articles) {
      const missing: string[] = [];
      if (!('headline' in article)) {
        missing.push('headline');
      }
      if (!('datePublished' in article) && !('dateModified' in article)) {
        missing.push('datePublished or dateModified');
      }
      if (!('author' in article)) {
        missing.push('author');
      }
      if (missing.length === 0) {
        continue;
      }
      findings.push({
        severity: 'warn',
        message: `Article schema is missing recommended fields: ${missing.join(', ')}`,
        detail:
          'Engines use these fields for the citation title, freshness check and attribution — all top ranking signals for AI answers.',
        fix: `Add ${missing.join(', ')} to the ${typeNames(article).join('/')} JSON-LD node.`,
        evidence: `"@type": "${typeNames(article).join(', ')}"`,
      });
    }
    return findings;
  },
};
