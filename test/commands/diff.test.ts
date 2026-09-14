import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffReports, renderDiff, runDiff } from '../../src/commands/diff.js';
import type { Finding, ScanReport } from '../../src/core/types.js';

function fakeReport(url: string, score: number, findings: Finding[]): ScanReport {
  return {
    tool: { name: 'geolint', version: '0.1.0' },
    url,
    finalUrl: url,
    scannedAt: '2024-01-01T00:00:00.000Z',
    durationMs: 5,
    page: null,
    robots: null,
    llmsTxt: null,
    bots: [],
    findings,
    score,
    grade: 'C',
    categories: {} as ScanReport['categories'],
  };
}

const OLD = fakeReport('https://a.com/', 60, [
  { ruleId: 'r/one', severity: 'warn', message: 'old warn' },
  { ruleId: 'r/two', severity: 'error', message: 'kept' },
]);
const NEW = fakeReport('https://a.com/', 75, [
  { ruleId: 'r/two', severity: 'error', message: 'kept' },
  { ruleId: 'r/three', severity: 'warn', message: 'new warn' },
]);

describe('diffReports', () => {
  it('computes score delta, added and resolved findings', () => {
    const d = diffReports(OLD, NEW);
    expect(d.oldScore).toBe(60);
    expect(d.newScore).toBe(75);
    expect(d.delta).toBe(15);
    expect(d.added.map((f) => f.ruleId)).toEqual(['r/three']);
    expect(d.resolved.map((f) => f.ruleId)).toEqual(['r/one']);
  });

  it('reports zero delta for identical reports', () => {
    const d = diffReports(OLD, OLD);
    expect(d.delta).toBe(0);
    expect(d.added).toHaveLength(0);
    expect(d.resolved).toHaveLength(0);
  });
});

describe('renderDiff', () => {
  it('renders score arrow and findings grouped by ruleId', () => {
    const out = renderDiff(OLD, NEW, diffReports(OLD, NEW));
    expect(out).toContain('60');
    expect(out).toContain('75');
    expect(out).toContain('+15');
    expect(out).toContain('Added findings (1)');
    expect(out).toContain('Resolved findings (1)');
    expect(out).toContain('r/three');
    expect(out).toContain('new warn');
    expect(out).toContain('r/one');
    expect(out).toContain('old warn');
  });
});

describe('runDiff', () => {
  it('loads two report JSONs and renders the comparison', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
    const oldPath = join(dir, 'old.json');
    const newPath = join(dir, 'new.json');
    await writeFile(oldPath, JSON.stringify(OLD));
    await writeFile(newPath, JSON.stringify(NEW));
    const { diff, output } = await runDiff(oldPath, newPath);
    expect(diff.delta).toBe(15);
    expect(output).toContain('Added findings (1)');
    expect(output).toContain('↑');
  });

  it('rejects files that are not report JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
    const bad = join(dir, 'bad.json');
    await writeFile(bad, JSON.stringify({ nope: true }));
    await expect(runDiff(bad, bad)).rejects.toThrow(/not a geolint report JSON/);
    const good = join(dir, 'good.json');
    await writeFile(good, JSON.stringify(OLD));
    await expect(runDiff(join(dir, 'missing.json'), good)).rejects.toThrow(/cannot read/);
    await expect(runDiff(good, join(dir, 'missing2.json'))).rejects.toThrow(/cannot read/);
  });
});
