import type { Rule, RuleFinding } from '../../core/types.js';

/** Matches a <urlset> or <sitemapindex> root element, namespace-prefix tolerant. */
const URLSET_RE = /<\s*(?:\w+:)?urlset\b/i;
const SITEMAPINDEX_RE = /<\s*(?:\w+:)?sitemapindex\b/i;
const URL_ENTRY_RE = /<\s*(?:\w+:)?url\b/gi;
const LASTMOD_RE = /<\s*(?:\w+:)?lastmod\b[^>]*>\s*([^<]+)/gi;
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;
const MIN_LASTMOD_COVERAGE = 0.5;

export const sitemapQualityRule: Rule = {
  id: 'technical/sitemap-quality',
  category: 'technical',
  title: 'Sitemap is usable XML with fresh lastmod hints',
  description:
    'A sitemap that returns HTML, fails to parse or carries stale lastmod dates wastes crawler budget and can mislead freshness judgments — AI crawlers use it to prioritize what to ingest.',
  severity: 'warn',
  async check(ctx) {
    let origin: string;
    try {
      origin = new URL(ctx.finalUrl).origin;
    } catch {
      return [];
    }
    // Only audit a declared sitemap on this origin — ctx.fetchPage is a
    // same-origin mechanism, and a cross-origin Sitemap entry is unverifiable
    // here rather than broken.
    const declared = ctx.robots?.sitemaps.find((s) => {
      try {
        return new URL(s).origin === origin;
      } catch {
        return false;
      }
    });
    const sitemapUrl = declared ?? `${origin}/sitemap.xml`;

    let body: string;
    let status: number;
    try {
      const res = await ctx.fetchPage(sitemapUrl);
      body = res.html;
      status = res.status;
    } catch {
      // A failed fetch (timeout, exhausted budget) is not evidence about the sitemap.
      return [];
    }

    if (status >= 400) {
      if (!declared) {
        // Absence of a convention-path sitemap is sitemap-missing's finding.
        return [];
      }
      return [
        {
          severity: 'warn',
          message: 'robots.txt declares a sitemap that does not resolve',
          detail: `GET ${sitemapUrl} returned HTTP ${status}.`,
          fix: 'Fix the Sitemap URL in robots.txt or publish the file at the declared location.',
          evidence: `${sitemapUrl} → HTTP ${status}`,
        },
      ];
    }

    // A sitemap index delegates to child sitemaps — presence is healthy;
    // auditing each child is a crawl, not a check.
    if (SITEMAPINDEX_RE.test(body)) {
      return [];
    }
    const findings: RuleFinding[] = [];

    if (!URLSET_RE.test(body)) {
      findings.push({
        severity: 'warn',
        message: 'Sitemap did not parse as XML',
        detail:
          'The sitemap response contains no <urlset> root — it is probably an HTML error page or a broken template.',
        fix: 'Serve a valid XML sitemap (<urlset> with <url>/<loc> entries) at the sitemap URL.',
        evidence: body.trim().slice(0, 120),
      });
      return findings;
    }

    const urlCount = body.match(URL_ENTRY_RE)?.length ?? 0;
    if (urlCount === 0) {
      findings.push({
        severity: 'warn',
        message: 'Sitemap contains no <url> entries',
        detail: 'An empty sitemap gives crawlers nothing to discover.',
        fix: 'Populate the sitemap with the canonical URLs of your indexable pages.',
      });
      return findings;
    }

    const lastmods: string[] = [];
    for (const m of body.matchAll(LASTMOD_RE)) {
      if (m[1]) {
        lastmods.push(m[1].trim());
      }
    }

    if (lastmods.length / urlCount < MIN_LASTMOD_COVERAGE) {
      findings.push({
        severity: 'warn',
        message: `${urlCount - lastmods.length} of ${urlCount} sitemap URLs lack a <lastmod>`,
        detail:
          'Without lastmod, crawlers cannot tell which pages changed — they either re-fetch everything or trust nothing.',
        fix: 'Emit an accurate <lastmod> for every <url> in the sitemap.',
        evidence: `${lastmods.length}/${urlCount} URLs carry <lastmod>`,
      });
    } else {
      // Coverage is fine — judge freshness by the newest lastmod.
      const newest = Math.max(
        ...lastmods.map((v) => Date.parse(v)).filter((t) => Number.isFinite(t)),
      );
      if (Number.isFinite(newest) && Date.now() - newest > TWO_YEARS_MS) {
        findings.push({
          severity: 'info',
          message: 'Newest sitemap <lastmod> is over 2 years old',
          detail:
            'Ancient lastmod dates tell crawlers the whole site is stale — bad for freshness-based citation decisions. Often it means lastmod is never updated.',
          fix: 'Update <lastmod> whenever the page content actually changes.',
          evidence: `newest lastmod: ${new Date(newest).toISOString().slice(0, 10)}`,
        });
      }
    }

    return findings;
  },
};
