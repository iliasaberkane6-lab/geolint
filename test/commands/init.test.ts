import { describe, expect, it } from 'vitest';
import { buildLlmsTxt, runInit } from '../../src/commands/init.js';
import { parseLlmsTxt } from '../../src/core/llmstxt.js';
import { type FixtureRoute, withFixtureServer } from '../helpers.js';

const quiet = { status: () => {} };

const page = (title: string, desc: string | null, links: string[] = []): string =>
  `<!doctype html><html><head><title>${title}</title>${
    desc === null ? '' : `<meta name="description" content="${desc}">`
  }</head><body>${links.map((l) => `<a href="${l}">x</a>`).join('')}</body></html>`;

const routes: FixtureRoute[] = [
  {
    path: '/',
    body: page('My Site', 'A test site.', ['/docs/a', '/docs/b', '/about', '/docs/api/ref']),
  },
  { path: '/docs/a', body: page('Doc A', 'First doc') },
  { path: '/docs/b', body: page('Doc B', null) },
  { path: '/docs/api/ref', body: page('API Ref', 'Reference') },
  { path: '/about', body: page('About', 'About us') },
  { path: '/robots.txt', status: 404 },
  { path: '/llms.txt', status: 404 },
];

describe('runInit', () => {
  it('emits a spec-parseable llms.txt grouped by first path segment', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runInit(`${origin}/`, quiet);
      expect(res.pagesScanned).toBe(5);

      const parsed = parseLlmsTxt(res.markdown);
      expect(parsed.title).toBe('My Site');
      expect(parsed.summary).toBe('A test site.');
      const headings = parsed.sections.map((s) => s.heading);
      expect(headings).toEqual(['Main', 'Docs', 'About']);
      // every crawled page is linked exactly once
      expect(parsed.linkCount).toBe(5);
      const docs = parsed.sections.find((s) => s.heading === 'Docs');
      expect(docs?.links.map((l) => l.url)).toEqual([
        `${origin}/docs/a`,
        `${origin}/docs/b`,
        `${origin}/docs/api/ref`,
      ]);
    });
  });

  it('respects --max-pages', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runInit(`${origin}/`, { maxPages: 2, ...quiet });
      expect(res.pagesScanned).toBe(2);
      expect(parseLlmsTxt(res.markdown).linkCount).toBe(2);
    });
  });
});

describe('buildLlmsTxt', () => {
  it('falls back to hostname and generated summary without entry metadata', () => {
    const md = buildLlmsTxt('https://docs.example.com/', []);
    const parsed = parseLlmsTxt(md);
    expect(parsed.title).toBe('docs.example.com');
    expect(parsed.summary).toContain('docs.example.com');
  });

  it('sanitizes markdown-breaking characters in titles', () => {
    const md = buildLlmsTxt('https://x.com/', [
      { url: 'https://x.com/', pathname: '/', title: 'A [weird] (title)', description: 'd' },
    ]);
    expect(md).toContain('[A weird title](https://x.com/)');
    expect(parseLlmsTxt(md).linkCount).toBe(1);
  });
});
