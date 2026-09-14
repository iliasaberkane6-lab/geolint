import { describe, expect, it } from 'vitest';
import { crawlPages, extractLinks, normalizeLink, runCrawl } from '../../src/commands/crawl.js';
import { parseRobots } from '../../src/core/robots.js';
import { DEFAULT_HTML, type FixtureRoute, withFixtureServer } from '../helpers.js';

const quiet = { status: () => {} };

const page = (title: string, links: string[] = []): string =>
  `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${links
    .map((l) => `<a href="${l}">x</a>`)
    .join('')}</body></html>`;

const ROBOTS = 'User-agent: *\nDisallow: /private\n';

const routes: FixtureRoute[] = [
  {
    path: '/',
    body: page('Home', [
      '/a',
      '/b',
      '/private/x',
      'https://external.example/y',
      'mailto:a@b.c',
      'tel:+123',
      'javascript:void(0)',
      '/style.css',
      '/img/logo.png?size=2',
      '#top',
      '/a/', // duplicate of /a modulo trailing slash
      '/b?x=1#frag', // query kept, hash stripped
    ]),
  },
  { path: '/a', body: page('A', ['/b', '/a/deep']) },
  { path: '/b', body: page('B') },
  { path: '/b?x=1', body: page('B1') },
  { path: '/a/deep', body: page('Deep') },
  { path: '/private/x', body: page('Secret') },
  { path: '/robots.txt', body: ROBOTS, headers: { 'content-type': 'text/plain' } },
  { path: '/llms.txt', status: 404 },
];

describe('crawlPages', () => {
  it('BFS-discovers same-origin pages in order and skips everything else', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await crawlPages(`${origin}/`);
      expect(res.failed).toHaveLength(0);
      expect(res.pages.map((p) => p.url)).toEqual([
        `${origin}/`,
        `${origin}/a`,
        `${origin}/b`,
        `${origin}/b?x=1`,
        `${origin}/a/deep`,
      ]);
      for (const p of res.pages) {
        expect(p.url.startsWith(origin)).toBe(true);
        expect(p.url).not.toContain('/private');
        expect(p.page?.status).toBe(200);
      }
    });
  });

  it('respects maxPages', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await crawlPages(`${origin}/`, { maxPages: 2 });
      expect(res.pages).toHaveLength(2);
      expect(res.pages[0]!.url).toBe(`${origin}/`);
    });
  });

  it('respects maxDepth', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await crawlPages(`${origin}/`, { maxDepth: 1 });
      // depth-2 page /a/deep is never reached
      expect(res.pages.map((p) => p.url)).not.toContain(`${origin}/a/deep`);
      expect(res.pages).toHaveLength(4);
    });
  });
});

describe('link normalization', () => {
  const base = new URL('https://ex.com/dir/page');
  const { groups } = parseRobots('User-agent: *\nDisallow: /blocked\n');

  it('resolves relative hrefs and strips hash + trailing slash', () => {
    expect(normalizeLink('../up', base, 'https://ex.com', groups)).toBe('https://ex.com/up');
    expect(normalizeLink('/a/#x', base, 'https://ex.com', groups)).toBe('https://ex.com/a');
    expect(normalizeLink('/a/', base, 'https://ex.com', groups)).toBe('https://ex.com/a');
  });

  it('rejects off-origin, non-http schemes and assets', () => {
    expect(normalizeLink('https://other.com/', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('mailto:a@b.c', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('tel:+1', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('javascript:x()', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('/app.js', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('/doc.pdf?v=3', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('#frag', base, 'https://ex.com', groups)).toBeNull();
  });

  it('skips robots-disallowed paths', () => {
    expect(normalizeLink('/blocked/x', base, 'https://ex.com', groups)).toBeNull();
    expect(normalizeLink('/ok', base, 'https://ex.com', groups)).toBe('https://ex.com/ok');
  });

  it('extractLinks pulls crawlable hrefs from HTML', () => {
    const links = extractLinks(
      page('t', ['/x', 'https://other.com/y', '/favicon.ico', '/x']),
      base,
      'https://ex.com',
      groups,
    );
    expect(links).toEqual(['https://ex.com/x']);
  });
});

describe('runCrawl', () => {
  it('builds a SiteReport covering every crawled page', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCrawl(`${origin}/`, quiet);
      expect(res.site.tool).toEqual({ name: 'geolint', version: expect.any(String) });
      expect(res.site.stats.pagesScanned).toBe(5);
      expect(res.site.stats.pagesFailed).toBe(0);
      expect(res.site.pages).toHaveLength(5);
      expect(res.site.pages[0]!.url).toBe(`${origin}/`);
      expect(res.site.findings.length).toBe(
        res.site.pages.reduce((n, p) => n + p.findings.length, 0),
      );
      expect(res.site.score).toBeGreaterThanOrEqual(0);
      expect(res.site.score).toBeLessThanOrEqual(100);
      expect(res.site.categories).toBe(res.site.pages[0]!.categories);
      expect(res.output.length).toBeGreaterThan(0);
      expect(res.exitCode).toBe(0);
    });
  });

  it('runs the full rule set only on the entry page', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCrawl(`${origin}/`, quiet);
      const [entry, ...rest] = res.site.pages;
      // site-level categories ran on the entry page…
      expect(entry!.categories['ai-crawler'].rulesRun.length).toBeGreaterThan(0);
      expect(entry!.categories['llms-txt'].rulesRun.length).toBeGreaterThan(0);
      // …but not on subsequent pages (schema/content/technical only)
      for (const p of rest) {
        expect(p.categories['ai-crawler'].rulesRun).toHaveLength(0);
        expect(p.categories['llms-txt'].rulesRun).toHaveLength(0);
        expect(p.categories.technical.rulesRun.length).toBeGreaterThan(0);
        expect(p.findings.every((f) => !f.ruleId.startsWith('llms-txt/'))).toBe(true);
      }
    });
  });

  it('renders parseable JSON for -f json', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCrawl(`${origin}/`, { format: 'json', ...quiet });
      const parsed = JSON.parse(res.output);
      expect(parsed.stats.pagesScanned).toBe(5);
      expect(Array.isArray(parsed.pages)).toBe(true);
    });
  });

  it('exits 1 when site score is below --fail-under', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCrawl(`${origin}/`, { failUnder: 100, ...quiet });
      expect(res.exitCode).toBe(1);
    });
  });

  it('handles an unreachable site without throwing', async () => {
    await withFixtureServer([{ path: '/', status: 500 }], async (origin) => {
      const res = await runCrawl(`${origin}/`, quiet);
      expect(res.site.stats.pagesScanned).toBe(1);
    });
  });
});

describe('DEFAULT_HTML sanity', () => {
  it('fixture helper serves pages', async () => {
    await withFixtureServer([{ path: '/', body: DEFAULT_HTML }], async (origin) => {
      const res = await crawlPages(`${origin}/`);
      expect(res.pages[0]!.page?.html).toBe(DEFAULT_HTML);
    });
  });
});
