import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffBaseline, loadBaseline, runCheck } from '../../src/commands/check.js';
import { DEFAULT_HTML, type FixtureRoute, withFixtureServer } from '../helpers.js';

const quiet = { status: () => {} };

const routes: FixtureRoute[] = [
  { path: '/', body: DEFAULT_HTML },
  { path: '/robots.txt', status: 404 },
  { path: '/llms.txt', status: 404 },
];

describe('runCheck', () => {
  it('returns a scan report and rendered output', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCheck(origin, quiet);
      expect(res.url).toBe(`${origin}/`);
      expect(res.report.url).toBe(`${origin}/`);
      expect(res.report.score).toBeGreaterThanOrEqual(0);
      expect(res.report.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(res.report.findings)).toBe(true);
      expect(res.output.length).toBeGreaterThan(0);
      expect(res.exitCode).toBe(0);
    });
  });

  it('normalizes bare hostnames and host:port inputs', async () => {
    await withFixtureServer(routes, async (origin) => {
      const bare = origin.replace(/^http:\/\//, '');
      // bare loopback host:port is normalized to http:// and works end-to-end
      const res = await runCheck(bare, { format: 'json', ...quiet });
      expect(res.url).toBe(`http://${bare}/`);
      expect(res.report?.page?.status).toBe(200);
      // full http URL works end-to-end
      const ok = await runCheck(origin, { format: 'json', ...quiet });
      expect(ok.report.finalUrl).toBe(`${origin}/`);
      expect(ok.report.page?.status).toBe(200);
    });
  });

  it('respects --only: only the requested rule runs', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCheck(origin, { only: ['technical/https'], ...quiet });
      expect(res.report.categories.technical.rulesRun).toEqual(['technical/https']);
      for (const cat of Object.values(res.report.categories)) {
        for (const id of cat.rulesRun) {
          expect(id).toBe('technical/https');
        }
      }
      // http fixture → the https rule must fire.
      expect(
        res.report.findings.some((f) => f.ruleId === 'technical/https' && f.severity === 'error'),
      ).toBe(true);
      expect(res.report.findings.every((f) => f.ruleId === 'technical/https')).toBe(true);
    });
  });

  it('respects --ignore: the ignored rule does not run', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCheck(origin, { ignore: ['technical/https'], ...quiet });
      expect(res.report.findings.every((f) => f.ruleId !== 'technical/https')).toBe(true);
    });
  });

  it('produces parseable JSON for -f json', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCheck(origin, { format: 'json', ...quiet });
      const parsed = JSON.parse(res.output);
      expect(parsed.score).toBe(res.report.score);
      expect(Array.isArray(parsed.findings)).toBe(true);
    });
  });

  it('exits 1 when score is below --fail-under, else 0', async () => {
    await withFixtureServer(routes, async (origin) => {
      const failing = await runCheck(origin, { failUnder: 100, ...quiet });
      expect(failing.report.score).toBeLessThan(100);
      expect(failing.exitCode).toBe(1);
      const passing = await runCheck(origin, { failUnder: 0, ...quiet });
      expect(passing.exitCode).toBe(0);
    });
  });

  it('--save-baseline writes a baseline file with ruleId/severity/message', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const file = join(dir, 'baseline.json');
      await runCheck(origin, { saveBaseline: file, ...quiet });
      const saved = JSON.parse(await readFile(file, 'utf8'));
      expect(saved.url).toBe(`${origin}/`);
      expect(typeof saved.score).toBe('number');
      expect(Array.isArray(saved.findings)).toBe(true);
      for (const f of saved.findings) {
        expect(typeof f.ruleId).toBe('string');
        expect(['error', 'warn', 'info']).toContain(f.severity);
        expect(typeof f.message).toBe('string');
      }
    });
  });

  it('--baseline reports no regressions against its own baseline', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const file = join(dir, 'baseline.json');
      await runCheck(origin, { saveBaseline: file, ...quiet });
      const res = await runCheck(origin, { baseline: file, ...quiet });
      expect(res.regressions).toHaveLength(0);
      expect(res.resolved).toHaveLength(0);
      expect(res.exitCode).toBe(0);
    });
  });

  it('--baseline detects regressions (new error/warn findings) and resolved ones', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const file = join(dir, 'baseline.json');
      await writeFile(
        file,
        JSON.stringify({
          url: origin,
          scannedAt: '2024-01-01T00:00:00.000Z',
          score: 100,
          findings: [{ ruleId: 'old/rule', severity: 'warn', message: 'gone now' }],
        }),
      );
      const res = await runCheck(origin, { baseline: file, ...quiet });
      // every current error/warn finding is a regression (baseline knows none)
      const expected = res.report.findings.filter(
        (f) => f.severity === 'error' || f.severity === 'warn',
      );
      expect(res.regressions.length).toBe(expected.length);
      expect(res.regressions.length).toBeGreaterThan(0);
      expect(res.resolved.map((f) => f.ruleId)).toContain('old/rule');
      expect(res.exitCode).toBe(1);
    });
  });

  it('loadBaseline rejects missing files, bad JSON and wrong shapes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
    await expect(loadBaseline(join(dir, 'missing.json'))).rejects.toThrow(/cannot read/);
    const bad = join(dir, 'bad.json');
    await writeFile(bad, 'not json {');
    await expect(loadBaseline(bad)).rejects.toThrow(/not valid JSON/);
    const wrong = join(dir, 'wrong.json');
    await writeFile(wrong, JSON.stringify({ hello: 'world' }));
    await expect(loadBaseline(wrong)).rejects.toThrow(/unexpected shape/);
  });

  it('diffBaseline matches findings on ruleId+message', async () => {
    await withFixtureServer(routes, async (origin) => {
      const res = await runCheck(origin, quiet);
      const baseline = {
        url: res.url,
        scannedAt: '',
        score: 100,
        findings: res.report.findings.map(({ ruleId, severity, message }) => ({
          ruleId,
          severity,
          message,
        })),
      };
      const { regressions, resolved } = diffBaseline(res.report, baseline);
      expect(regressions).toHaveLength(0);
      expect(resolved).toHaveLength(0);
      // a baseline entry with a different message is treated as resolved
      const drifted = {
        ...baseline,
        findings: [{ ruleId: 'technical/https', severity: 'error' as const, message: 'other' }],
      };
      expect(diffBaseline(res.report, drifted).resolved).toHaveLength(1);
    });
  });
});
