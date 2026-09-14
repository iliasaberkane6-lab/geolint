import { describe, expect, it } from 'vitest';
import { scan } from '../src/core/engine.js';
import { RULE_CATEGORIES } from '../src/core/types.js';
import { DEFAULT_HTML, withFixtureServer } from './helpers.js';

const BLOCK_ALL_ROBOTS = `User-agent: *
Disallow: /

User-agent: GPTBot
Disallow: /
`;

const OPEN_ROBOTS = `User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
`;

const VALID_LLMS = `# Example Site
> An example site used in tests.

## Docs
- [Getting Started](https://example.com/docs/start): How to start
- [API](https://example.com/docs/api): API reference
`;

describe('e2e: scan() against a fixture server', () => {
  it('produces a well-formed report for a healthy site', async () => {
    await withFixtureServer(
      [
        { path: '/', body: DEFAULT_HTML },
        { path: '/robots.txt', body: OPEN_ROBOTS, headers: { 'content-type': 'text/plain' } },
        { path: '/llms.txt', body: VALID_LLMS, headers: { 'content-type': 'text/plain' } },
        { path: '/sitemap.xml', body: '<urlset></urlset>', headers: { 'content-type': 'text/xml' } },
      ],
      async (origin) => {
        const report = await scan(`${origin}/`);
        expect(report.tool.name).toBe('geolint');
        expect(report.page?.status).toBe(200);
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
        expect(['A', 'B', 'C', 'D', 'F']).toContain(report.grade);
        for (const cat of RULE_CATEGORIES) {
          expect(report.categories[cat]).toBeDefined();
        }
        expect(report.llmsTxt?.title).toBe('Example Site');
        // every finding carries a stamped ruleId + severity
        for (const f of report.findings) {
          expect(f.ruleId).toMatch(/^[a-z-]+\/[a-z-]+$/);
          expect(['error', 'warn', 'info']).toContain(f.severity);
        }
      },
    );
  });

  it('flags a site that blocks AI search bots', async () => {
    await withFixtureServer(
      [
        { path: '/', body: DEFAULT_HTML },
        { path: '/robots.txt', body: BLOCK_ALL_ROBOTS, headers: { 'content-type': 'text/plain' } },
      ],
      async (origin) => {
        const report = await scan(`${origin}/`);
        const ruleIds = new Set(report.findings.map((f) => f.ruleId));
        expect(ruleIds.has('ai-crawler/wildcard-block-all')).toBe(true);
        expect(ruleIds.has('ai-crawler/search-bots-blocked')).toBe(true);
        expect(report.bots.find((b) => b.id === 'GPTBot')?.allowed).toBe(false);
        expect(report.categories['ai-crawler'].errors).toBeGreaterThan(0);
        expect(report.score).toBeLessThan(100);
      },
    );
  });

  it('reports unreachable pages as errors', async () => {
    const report = await scan('http://127.0.0.1:1/'); // nothing listens there
    expect(report.page).toBeNull();
    expect(report.findings.some((f) => f.severity === 'error')).toBe(true);
  });

  it('flags missing llms.txt', async () => {
    await withFixtureServer(
      [
        { path: '/', body: DEFAULT_HTML },
        { path: '/robots.txt', body: OPEN_ROBOTS, headers: { 'content-type': 'text/plain' } },
      ],
      async (origin) => {
        const report = await scan(`${origin}/`);
        expect(report.findings.some((f) => f.ruleId === 'llms-txt/missing')).toBe(true);
      },
    );
  });

  it('respects --only rule selection', async () => {
    await withFixtureServer(
      [
        { path: '/', body: DEFAULT_HTML },
        { path: '/robots.txt', body: OPEN_ROBOTS, headers: { 'content-type': 'text/plain' } },
      ],
      async (origin) => {
        const report = await scan(`${origin}/`, { only: ['technical/https'] });
        const ruleIds = new Set(report.findings.map((f) => f.ruleId));
        for (const id of ruleIds) {
          expect(id).toBe('technical/https');
        }
      },
    );
  });
});
