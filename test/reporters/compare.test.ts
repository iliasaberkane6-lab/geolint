import { describe, expect, it } from 'vitest';
import { renderCompare } from '../../src/reporters/index.js';
import { stripAnsi } from '../../src/reporters/table.js';
import { BOTS, makeCategories, makeReport } from './fixtures.js';

const isPlain = (out: string) => stripAnsi(out) === out;

function reports() {
  const a = makeReport({ url: 'https://aaa.example', score: 74, grade: 'C' });
  const b = makeReport({
    url: 'https://bbb.example',
    score: 90,
    grade: 'A',
    findings: [],
    bots: BOTS.map((bot) => ({ ...bot, allowed: true })),
    categories: makeCategories({
      'llms-txt': { score: 100, errors: 0, passed: ['llms-txt/missing'] },
      schema: { score: 100, errors: 0, passed: ['schema/jsonld-missing'] },
      content: { score: 100, errors: 0, warnings: 0, infos: 0, passed: ['content/thin-content'] },
      technical: { score: 100, errors: 0, passed: ['technical/https'] },
    }),
  });
  return { a, b };
}

describe('compare', () => {
  const { a, b } = reports();
  const out = renderCompare(a, b);

  it('renders the metric table with both hosts', () => {
    expect(out).toContain('geolint compare');
    expect(out).toContain('https://aaa.example');
    expect(out).toContain('https://bbb.example');
    expect(out).toContain('METRIC');
    expect(out).toContain('aaa.example');
    expect(out).toContain('bbb.example');
    expect(out).toContain('Δ');
  });

  it('shows the overall score and grade with positive delta', () => {
    expect(out).toContain('Overall score');
    expect(out).toMatch(/74 \(C\)\s+90 \(A\)/);
    expect(out).toContain('↑ +16');
    expect(out).toContain('↑ C → A');
  });

  it('shows per-category deltas including unchanged metrics', () => {
    expect(out).toContain('llms.txt');
    expect(out).toContain('↑ +30'); // llms-txt 70 → 100
    expect(out).toContain('→'); // ai-crawler unchanged at 100
  });

  it('treats fewer errors/warnings as improvement (negative delta)', () => {
    expect(out).toContain('Errors');
    expect(out).toContain('↓ -3'); // 3 → 0 errors
    expect(out).toContain('↓ -1'); // 1 → 0 warnings
  });

  it('shows AI bots allowed counts', () => {
    expect(out).toContain('AI bots allowed');
    expect(out).toContain('3/6');
    expect(out).toContain('6/6');
    expect(out).toContain('↑ +3');
  });

  it('declares the winner by score', () => {
    expect(out).toContain('Winner:');
    expect(out).toContain('https://bbb.example');
    expect(out).toContain('(+16 points)');
  });

  it('declares a tie on equal scores', () => {
    const tie = renderCompare(
      makeReport({ url: 'https://aaa.example', score: 80 }),
      makeReport({ url: 'https://bbb.example', score: 80 }),
    );
    expect(tie).toContain('Tie');
    expect(tie).not.toContain('Winner:');
  });

  it('emits zero ANSI escapes when color === false', () => {
    expect(isPlain(renderCompare(a, b, { color: false }))).toBe(true);
  });

  it('emits ANSI escapes when color === true', () => {
    expect(isPlain(renderCompare(a, b, { color: true }))).toBe(false);
  });
});
