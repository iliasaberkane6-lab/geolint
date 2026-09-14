import { describe, expect, it } from 'vitest';
import { renderReport, renderSiteReport } from '../../src/reporters/index.js';
import { makeReport, makeSiteReport } from './fixtures.js';

describe('markdown — ScanReport', () => {
  const report = makeReport();
  const out = renderReport(report, 'markdown');

  it('renders the headline with score and grade', () => {
    expect(out).toContain('## 🛰️ geolint — 74/100 (C)');
    expect(out).toContain('**https://example.com/**');
    expect(out).toContain('scanned 2025-06-01');
    expect(out).toContain('1234ms');
  });

  it('renders the category table', () => {
    expect(out).toContain('| Category | Score | Issues |');
    expect(out).toContain('| AI Crawler Access | 100 | ✅ clean |');
    expect(out).toContain('| llms.txt | 70 | 1 error |');
  });

  it('renders the findings table with severity emoji', () => {
    expect(out).toContain('| Severity | Rule | Finding | Fix |');
    expect(out).toContain('❌');
    expect(out).toContain('⚠️');
    expect(out).toContain('ℹ️');
    expect(out).toContain('`llms-txt/missing`');
    expect(out).toContain('| ❌ error | `llms-txt/missing` | No llms.txt found at /llms.txt |');
  });

  it('escapes pipes inside cell text', () => {
    // the schema finding fix contains ' | '
    expect(out).toContain('Add Organization/Article JSON-LD to <head> \\| keep it under 8KB.');
    // no raw pipe breaks the row: every table row has balanced cell separators
    const row = out.split('\n').find((l) => l.includes('Organization/Article'))!;
    expect(row.startsWith('|')).toBe(true);
    expect(row.endsWith('|')).toBe(true);
  });

  it('renders the collapsible improvement section with unique fixes', () => {
    expect(out).toContain('<details><summary>How to improve</summary>');
    expect(out).toContain('- Create /llms.txt with an H1 title');
    expect(out).toContain('</details>');
  });

  it('renders the AI crawler summary line', () => {
    expect(out).toContain('**AI crawler access:** 3/6 allowed · 2 blocked · 1 unknown');
  });

  it('omits the findings table when there are no findings', () => {
    const clean = renderReport(makeReport({ findings: [] }), 'markdown');
    expect(clean).not.toContain('### Findings');
    expect(clean).not.toContain('<details>');
  });
});

describe('markdown — SiteReport', () => {
  const site = makeSiteReport();
  const out = renderSiteReport(site, 'markdown');

  it('renders site headline and pages table', () => {
    expect(out).toContain('## 🛰️ geolint — 64/100 (C)');
    expect(out).toContain('| Page | Score | Grade | Top issue |');
    expect(out).toContain('| /pricing | 38 | F |');
    expect(out).toContain('3 pages (1 failed)');
  });

  it('renders aggregate findings deduped', () => {
    expect(out).toContain('### Findings');
    const occurrences = out.split('No llms.txt found').length - 1;
    expect(occurrences).toBe(1);
    expect(out).toContain('Identical <title> across multiple pages');
  });
});
