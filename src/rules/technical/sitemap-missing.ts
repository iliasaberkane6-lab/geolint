import type { Rule } from '../../core/types.js';

export const sitemapMissingRule: Rule = {
  id: 'technical/sitemap-missing',
  category: 'technical',
  title: 'XML sitemap discoverable',
  description:
    'A sitemap is how crawlers — AI ones included — discover your full set of pages efficiently. No sitemap and no Sitemap directive in robots.txt makes discovery depend on fragile link-following.',
  severity: 'warn',
  async check(ctx) {
    if (ctx.robots && ctx.robots.sitemaps.length > 0) {
      return [];
    }
    let origin: string;
    try {
      origin = new URL(ctx.finalUrl).origin;
    } catch {
      return [];
    }
    try {
      const res = await ctx.fetchPage(`${origin}/sitemap.xml`);
      if (res.status < 400) {
        return [];
      }
      return [warning(`${origin}/sitemap.xml → HTTP ${res.status}`)];
    } catch {
      // A failed fetch (timeout, exhausted budget) is not evidence of absence.
      return [];
    }
  },
};

function warning(evidence: string) {
  return {
    severity: 'warn' as const,
    message: 'No sitemap discoverable',
    detail: 'No Sitemap directive in robots.txt and /sitemap.xml does not resolve.',
    fix: 'Publish an XML sitemap at /sitemap.xml and declare it in robots.txt ("Sitemap: https://…/sitemap.xml").',
    evidence,
  };
}
