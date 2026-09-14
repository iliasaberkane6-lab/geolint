import { describe, expect, it } from 'vitest';
import { canonicalRule } from '../../src/rules/technical/canonical.js';
import { clientRenderedRule } from '../../src/rules/technical/client-rendered.js';
import { httpErrorRule } from '../../src/rules/technical/http-error.js';
import { httpsRule } from '../../src/rules/technical/https.js';
import { metaDescriptionRule } from '../../src/rules/technical/meta-description.js';
import { pageUnreachableRule } from '../../src/rules/technical/page-unreachable.js';
import { redirectRule } from '../../src/rules/technical/redirect.js';
import { sitemapMissingRule } from '../../src/rules/technical/sitemap-missing.js';
import { slowResponseRule } from '../../src/rules/technical/slow-response.js';
import { titleMissingRule } from '../../src/rules/technical/title-missing.js';
import { makeCtx, makePage, makeRobots } from '../helpers.js';

const htmlWith = (body: string, head = '<title>t</title>') =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('technical/page-unreachable', () => {
  it('errors when the page could not be fetched', async () => {
    const findings = await pageUnreachableRule.check(makeCtx({ page: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.evidence).toBe('https://example.com/');
  });

  it('passes when the page loaded', async () => {
    expect(await pageUnreachableRule.check(makeCtx())).toEqual([]);
  });
});

describe('technical/http-error', () => {
  it('errors on 4xx and 5xx statuses', async () => {
    for (const status of [404, 500]) {
      const findings = await httpErrorRule.check(makeCtx({ page: makePage({ status }) }));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
      expect(findings[0]!.message).toContain(String(status));
    }
  });

  it('passes on 200 and on null page', async () => {
    expect(await httpErrorRule.check(makeCtx())).toEqual([]);
    expect(await httpErrorRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});

describe('technical/client-rendered', () => {
  it('errors when almost no text ships in the HTML', async () => {
    const page = makePage({ html: htmlWith('<h1>Hi</h1><p>tiny</p>') });
    const findings = await clientRenderedRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.message).toMatch(/client-rendered/i);
  });

  it('errors on an SPA shell with little content', async () => {
    const page = makePage({ html: htmlWith(`<div id="root"></div><p>${words(60)}</p>`) });
    const findings = await clientRenderedRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
  });

  it('passes on a content-rich page even with a mount point', async () => {
    const page = makePage({ html: htmlWith(`<div id="root"></div><p>${words(150)}</p>`) });
    expect(await clientRenderedRule.check(makeCtx({ page }))).toEqual([]);
  });

  it('returns [] when the page is unreachable', async () => {
    expect(await clientRenderedRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});

describe('technical/sitemap-missing', () => {
  it('passes when robots.txt declares a sitemap', async () => {
    const robots = makeRobots('User-agent: *\nAllow: /\n\nSitemap: https://example.com/sm.xml\n');
    const ctx = makeCtx({ robots });
    expect(await sitemapMissingRule.check(ctx)).toEqual([]);
  });

  it('warns when /sitemap.xml does not resolve', async () => {
    const ctx = makeCtx({
      robots: makeRobots('User-agent: *\nAllow: /\n'),
      fetchPage: async (u: string) => makePage({ url: u, finalUrl: u, status: 404 }),
    });
    const findings = await sitemapMissingRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.evidence).toContain('/sitemap.xml');
  });

  it('does not warn when the sitemap fetch throws', async () => {
    // A failed fetch is not evidence that the sitemap is missing.
    const ctx = makeCtx({
      fetchPage: async () => {
        throw new Error('budget exhausted');
      },
    });
    expect(await sitemapMissingRule.check(ctx)).toEqual([]);
  });

  it('passes when /sitemap.xml resolves', async () => {
    const ctx = makeCtx({ fetchPage: async (u: string) => makePage({ url: u, finalUrl: u }) });
    expect(await sitemapMissingRule.check(ctx)).toEqual([]);
  });
});

describe('technical/canonical', () => {
  it('informs when no canonical link exists', async () => {
    const page = makePage({ html: htmlWith('<p>x</p>') });
    const findings = await canonicalRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('warns when the canonical points at a different origin', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', '<link rel="canonical" href="https://other.com/page">'),
    });
    const findings = await canonicalRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('passes with a same-origin canonical', async () => {
    expect(await canonicalRule.check(makeCtx())).toEqual([]);
  });
});

describe('technical/title-missing', () => {
  it('warns on a missing or empty title', async () => {
    const noTitle = await titleMissingRule.check(
      makeCtx({ page: makePage({ html: htmlWith('<p>x</p>', '') }) }),
    );
    expect(noTitle[0]!.severity).toBe('warn');
    const emptyTitle = await titleMissingRule.check(
      makeCtx({ page: makePage({ html: htmlWith('<p>x</p>', '<title>  </title>') }) }),
    );
    expect(emptyTitle[0]!.severity).toBe('warn');
  });

  it('passes with a title', async () => {
    expect(await titleMissingRule.check(makeCtx())).toEqual([]);
  });
});

describe('technical/meta-description', () => {
  it('informs when the meta description is missing', async () => {
    const page = makePage({ html: htmlWith('<p>x</p>') });
    const findings = await metaDescriptionRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('informs when the description is too short', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', '<meta name="description" content="short">'),
    });
    const findings = await metaDescriptionRule.check(makeCtx({ page }));
    expect(findings[0]!.message).toMatch(/short/i);
  });

  it('passes with a decent description', async () => {
    const page = makePage({
      html: htmlWith(
        '<p>x</p>',
        '<meta name="description" content="A sufficiently long meta description for the page.">',
      ),
    });
    expect(await metaDescriptionRule.check(makeCtx({ page }))).toEqual([]);
  });
});

describe('technical/slow-response', () => {
  it('warns above 2000ms', async () => {
    const findings = await slowResponseRule.check(makeCtx({ page: makePage({ timingMs: 2500 }) }));
    expect(findings[0]!.severity).toBe('warn');
  });

  it('informs above 800ms', async () => {
    const findings = await slowResponseRule.check(makeCtx({ page: makePage({ timingMs: 1000 }) }));
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes on a fast page and on null page', async () => {
    expect(await slowResponseRule.check(makeCtx())).toEqual([]);
    expect(await slowResponseRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});

describe('technical/redirect', () => {
  it('informs when the URL redirected', async () => {
    const page = makePage({ redirected: true, finalUrl: 'https://example.com/final' });
    const ctx = makeCtx({ page });
    const findings = await redirectRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.evidence).toContain('final');
  });

  it('passes without a redirect', async () => {
    expect(await redirectRule.check(makeCtx())).toEqual([]);
  });
});

describe('technical/https (existing template rule)', () => {
  it('errors on plain http', async () => {
    const page = makePage({ url: 'http://example.com/', finalUrl: 'http://example.com/' });
    const findings = await httpsRule.check(makeCtx({ page }));
    expect(findings[0]!.severity).toBe('error');
  });

  it('passes on https and null page', async () => {
    expect(await httpsRule.check(makeCtx())).toEqual([]);
    expect(await httpsRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});
