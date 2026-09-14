import { describe, expect, it } from 'vitest';
import { renderReport, renderSiteReport } from '../../src/reporters/index.js';
import { stripAnsi } from '../../src/reporters/table.js';
import { makeReport, makeSiteReport } from './fixtures.js';

/** true when the output contains zero ANSI escapes. */
const isPlain = (out: string) => stripAnsi(out) === out;

describe('pretty — ScanReport', () => {
  const report = makeReport();
  const out = renderReport(report, 'pretty');

  it('renders the header with tool name, version and url', () => {
    expect(out).toContain('geolint');
    expect(out).toContain('v0.1.0');
    expect(out).toContain('https://example.com/');
  });

  it('shows the final url when redirected', () => {
    const redirected = makeReport({
      finalUrl: 'https://www.example.com/',
      page: { status: 200, contentType: 'text/html', timingMs: 42, redirected: true },
    });
    const o = renderReport(redirected, 'pretty');
    expect(o).toContain('→');
    expect(o).toContain('https://www.example.com/');
  });

  it('renders score, grade and the 30-cell score bar', () => {
    expect(out).toContain('74/100');
    expect(out).toContain('Grade');
    expect(out).toContain('C');
    expect(out).toContain('█');
    expect(out).toContain('░');
    const barLine = out.split('\n').find((l) => l.includes('74/100'))!;
    expect(stripAnsi(barLine)).toMatch(/[█░]{30}/);
  });

  it('renders the category table with labels and issue summaries', () => {
    expect(out).toContain('CATEGORIES');
    for (const label of [
      'AI Crawler Access',
      'llms.txt',
      'Structured Data',
      'Citability',
      'Technical Foundation',
    ]) {
      expect(out).toContain(label);
    }
    expect(out).toContain('✓ clean');
    expect(out).toContain('1 error');
  });

  it('renders the AI crawler matrix grouped by company', () => {
    expect(out).toContain('AI CRAWLER ACCESS');
    expect(out).toContain('OpenAI');
    expect(out).toContain('Anthropic');
    expect(out).toContain('GPTBot');
    expect(out).toContain('PerplexityBot');
    expect(out).toContain('✓');
    expect(out).toContain('✗');
    expect(out).toContain('–'); // unknown
    expect(out).toContain('3/6 allowed');
    expect(out).toContain('2 blocked');
    expect(out).toContain('1 unknown');
    expect(out).toContain('training');
    expect(out).toContain('user-fetch');
  });

  it('omits the bot matrix when no bots were evaluated', () => {
    const o = renderReport(makeReport({ bots: [] }), 'pretty');
    expect(o).not.toContain('AI CRAWLER ACCESS');
  });

  it('groups findings by category with glyph, ruleId, fix and evidence', () => {
    expect(out).toContain('FINDINGS');
    expect(out).toContain('llms-txt/missing');
    expect(out).toContain('No llms.txt found at /llms.txt');
    expect(out).toContain('fix: Create /llms.txt');
    expect(out).toContain('evidence: HTTP 404');
    expect(out).toContain('⚠');
    expect(out).toContain('ℹ');
    // grouped under the category label
    const llmsIdx = out.indexOf('llms.txt\n');
    const findingIdx = out.indexOf('No llms.txt found');
    expect(llmsIdx).toBeGreaterThan(-1);
    expect(findingIdx).toBeGreaterThan(llmsIdx);
  });

  it('renders the footer severity counts', () => {
    expect(out).toContain('3 errors');
    expect(out).toContain('1 warning');
    expect(out).toContain('1 hint');
    expect(out).toContain('checks passed');
  });

  it('lists passed rules only when verbose', () => {
    expect(out).not.toContain('Passed:');
    const verbose = renderReport(report, 'pretty', { verbose: true });
    expect(verbose).toContain('Passed:');
    expect(verbose).toContain('ai-crawler/gptbot-blocked');
  });

  it('hides info findings when verbose is explicitly false', () => {
    const quiet = renderReport(report, 'pretty', { verbose: false });
    expect(quiet).not.toContain('No FAQ-style Q&A blocks detected');
    // errors/warnings still shown
    expect(quiet).toContain('No llms.txt found');
    // footer still reports the true totals
    expect(quiet).toContain('1 hint');
  });

  it('emits zero ANSI escapes when color === false', () => {
    const plain = renderReport(report, 'pretty', { color: false });
    expect(isPlain(plain)).toBe(true);
  });

  it('emits ANSI escapes when color === true', () => {
    const colored = renderReport(report, 'pretty', { color: true });
    expect(isPlain(colored)).toBe(false);
    // and stripping them yields the plain rendering
    expect(stripAnsi(colored)).toBe(renderReport(report, 'pretty', { color: false }));
  });

  it('keeps lines within ~100 chars', () => {
    for (const line of out.split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(100);
    }
  });
});

describe('pretty — SiteReport', () => {
  const site = makeSiteReport();
  const out = renderSiteReport(site, 'pretty');

  it('renders site header with page stats', () => {
    expect(out).toContain('site audit');
    expect(out).toContain('https://site.example/');
    expect(out).toContain('3 pages scanned');
    expect(out).toContain('1 failed');
    expect(out).toContain('64/100');
  });

  it('renders the PAGES table sorted worst-first', () => {
    expect(out).toContain('PAGES');
    const pricing = out.indexOf('/pricing');
    const root = out.indexOf('\n    /  ');
    const about = out.indexOf('/about');
    expect(pricing).toBeGreaterThan(-1);
    expect(about).toBeGreaterThan(-1);
    expect(pricing).toBeLessThan(about);
    expect(root).toBeGreaterThan(-1);
    expect(out).toMatch(/\/pricing\s+38\s+F/);
  });

  it('dedupes identical findings with a ×N pages suffix', () => {
    expect(out).toContain('×2 pages');
    // 'No llms.txt found' appears on 2 pages — rendered once
    const occurrences = out.split('No llms.txt found').length - 1;
    expect(occurrences).toBe(1);
  });

  it('still renders aggregate findings and footer', () => {
    expect(out).toContain('FINDINGS');
    expect(out).toContain('Identical <title> across multiple pages');
    expect(out).toContain('errors');
  });

  it('emits zero ANSI escapes when color === false', () => {
    expect(isPlain(renderSiteReport(site, 'pretty', { color: false }))).toBe(true);
  });
});
