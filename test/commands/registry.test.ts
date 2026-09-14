import { describe, expect, it } from 'vitest';
import { impactFor, listBots } from '../../src/commands/bots.js';
import { listRules } from '../../src/commands/rules.js';
import { AI_BOTS } from '../../src/core/bots.js';
import { allRules } from '../../src/rules/index.js';

describe('listRules', () => {
  it('table output lists rule ids with severity and title columns', () => {
    const out = listRules();
    expect(out).toContain('ID');
    expect(out).toContain('SEVERITY');
    expect(out).toContain('TITLE');
    expect(out).toContain('technical/https');
  });

  it('json output parses to the full registry', () => {
    const arr = JSON.parse(listRules({ format: 'json' }));
    expect(arr).toHaveLength(allRules.length);
    expect(arr.some((r: { id: string }) => r.id === 'technical/https')).toBe(true);
    expect(arr[0]).toHaveProperty('severity');
    expect(arr[0]).toHaveProperty('title');
  });

  it('markdown output renders a table', () => {
    const out = listRules({ format: 'markdown' });
    expect(out).toContain('| id | severity | title |');
    expect(out).toContain('| technical/https |');
  });

  it('filters by category', () => {
    const out = listRules({ category: 'technical' });
    expect(out).toContain('technical/https');
    const json = JSON.parse(listRules({ category: 'technical', format: 'json' }));
    expect(json.length).toBeGreaterThan(0);
    expect(json.every((r: { category: string }) => r.category === 'technical')).toBe(true);
  });
});

describe('listBots', () => {
  it('table output lists tokens, companies and impact', () => {
    const out = listBots();
    expect(out).toContain('TOKEN');
    expect(out).toContain('COMPANY');
    expect(out).toContain('IMPACT IF BLOCKED');
    expect(out).toContain('GPTBot');
    expect(out).toContain('OpenAI');
  });

  it('json output covers every registered bot', () => {
    const arr = JSON.parse(listBots({ format: 'json' }));
    expect(arr).toHaveLength(AI_BOTS.length);
    for (const row of arr) {
      expect(typeof row.token).toBe('string');
      expect(typeof row.impact).toBe('string');
      expect(row.impact.length).toBeGreaterThan(0);
    }
  });
});

describe('impactFor', () => {
  it('maps purposes to blocking impact', () => {
    expect(impactFor('search')).toBe('invisible in AI answers now');
    expect(impactFor('user-fetch')).toBe('invisible in AI answers now');
    expect(impactFor('training')).toBe('absent from future training data');
    expect(impactFor('mixed')).toContain('invisible in AI answers now');
    expect(impactFor('mixed')).toContain('absent from future training data');
  });
});
