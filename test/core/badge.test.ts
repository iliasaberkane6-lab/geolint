import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../../src/commands/check.js';
import { badgeMarkdown, badgeSvg, shieldsEndpointJson } from '../../src/core/badge.js';
import { DEFAULT_HTML, type FixtureRoute, withFixtureServer } from '../helpers.js';

const quiet = { status: () => {} };

const routes: FixtureRoute[] = [
  { path: '/', body: DEFAULT_HTML },
  { path: '/robots.txt', status: 404 },
  { path: '/llms.txt', status: 404 },
];

describe('badgeSvg', () => {
  it('renders a shields-style flat SVG containing the score and grade', () => {
    const svg = badgeSvg(87, 'B');
    expect(svg).toMatch(/^<svg[^>]*width="\d+" height="20"/);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('aria-label="geolint: 87/100 · B"');
    expect(svg).toContain('>geolint</text>');
    expect(svg).toContain('>87/100 · B</text>');
    expect(svg).toContain('fill="#555"');
  });

  it('colors the value segment by grade', () => {
    expect(badgeSvg(95, 'A')).toContain('fill="#4c1"');
    expect(badgeSvg(87, 'B')).toContain('fill="#97ca00"');
    expect(badgeSvg(60, 'C')).toContain('fill="#dfb317"');
    expect(badgeSvg(45, 'D')).toContain('fill="#fe7d37"');
    expect(badgeSvg(12, 'F')).toContain('fill="#e05d44"');
  });

  it('honors a custom label', () => {
    const svg = badgeSvg(50, 'D', 'ai readiness');
    expect(svg).toContain('>ai readiness</text>');
  });

  it('XML-escapes a hostile label', () => {
    const svg = badgeSvg(50, 'D', '<script>alert("x")</script>');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&quot;');
  });
});

describe('shieldsEndpointJson', () => {
  it('parses to the exact shields endpoint schema', () => {
    const parsed = JSON.parse(shieldsEndpointJson(87, 'B'));
    expect(parsed).toEqual({
      schemaVersion: 1,
      label: 'geolint',
      message: '87/100 · B',
      color: 'green',
    });
  });

  it('maps every grade to a shields named color', () => {
    const colors = (['A', 'B', 'C', 'D', 'F'] as const).map(
      (g) => JSON.parse(shieldsEndpointJson(50, g)).color,
    );
    expect(colors).toEqual(['brightgreen', 'green', 'yellow', 'orange', 'red']);
  });
});

describe('badgeMarkdown', () => {
  it('defaults to a shields static badge URL with the message encoded', () => {
    const md = badgeMarkdown(87, 'B');
    expect(md).toBe(
      '[![geolint](https://img.shields.io/badge/geolint-87%2F100_%C2%B7_B-green)]' +
        '(https://github.com/iliasabk/geolint)',
    );
  });

  it('honors a custom imageUrl and linkUrl', () => {
    const md = badgeMarkdown(87, 'B', {
      imageUrl: 'geolint-badge.svg',
      linkUrl: 'https://example.com',
    });
    expect(md).toBe('[![geolint](geolint-badge.svg)](https://example.com)');
  });
});

describe('runCheck badge options', () => {
  it('--badge <path> writes the SVG, populates badgeFiles and keeps stdout clean', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const file = join(dir, 'badge.svg');
      const status: string[] = [];
      const res = await runCheck(origin, {
        badge: file,
        status: (m) => status.push(m),
      });
      expect(res.badgeFiles).toEqual([file]);
      const svg = await readFile(file, 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain(`${res.report.score}/100 · ${res.report.grade}`);
      // absolute path → markdown falls back to the shields static URL
      const md = status.find((m) => m.includes('badge markdown'));
      expect(md).toContain('img.shields.io/badge/geolint-');
      expect(status.some((m) => m.includes('docs/badges.md'))).toBe(true);
      // stdout payload is untouched by badge generation
      expect(res.output).not.toContain('<svg');
      expect(res.output).not.toContain('badge markdown');
    });
  });

  it('badge: true writes geolint-badge.svg into the cwd and uses it in the markdown', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
    const prev = process.cwd();
    process.chdir(dir);
    try {
      await withFixtureServer(routes, async (origin) => {
        const status: string[] = [];
        const res = await runCheck(origin, { badge: true, status: (m) => status.push(m) });
        expect(res.badgeFiles).toEqual(['geolint-badge.svg']);
        const svg = await readFile(join(dir, 'geolint-badge.svg'), 'utf8');
        expect(svg).toContain('<svg');
        const md = status.find((m) => m.includes('badge markdown'));
        expect(md).toContain('[![geolint](geolint-badge.svg)]');
      });
    } finally {
      process.chdir(prev);
    }
  });

  it('a relative --badge path becomes the markdown image', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
    await mkdir(join(dir, 'docs'));
    const prev = process.cwd();
    process.chdir(dir);
    try {
      await withFixtureServer(routes, async (origin) => {
        const status: string[] = [];
        const res = await runCheck(origin, {
          badge: 'docs/score.svg',
          status: (m) => status.push(m),
        });
        expect(res.badgeFiles).toEqual(['docs/score.svg']);
        const svg = await readFile(join(dir, 'docs', 'score.svg'), 'utf8');
        expect(svg).toContain('<svg');
        const md = status.find((m) => m.includes('badge markdown'));
        expect(md).toContain('[![geolint](docs/score.svg)]');
      });
    } finally {
      process.chdir(prev);
    }
  });

  it('--badge-endpoint writes shields endpoint JSON alongside the SVG', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const svgFile = join(dir, 'badge.svg');
      const jsonFile = join(dir, 'badge.json');
      const res = await runCheck(origin, {
        badge: svgFile,
        badgeEndpoint: jsonFile,
        ...quiet,
      });
      expect(res.badgeFiles).toEqual([svgFile, jsonFile]);
      const parsed = JSON.parse(await readFile(jsonFile, 'utf8'));
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.label).toBe('geolint');
      expect(parsed.message).toBe(`${res.report.score}/100 · ${res.report.grade}`);
    });
  });

  it('badge generation does not change exitCode semantics', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const res = await runCheck(origin, {
        badge: join(dir, 'badge.svg'),
        failUnder: 100,
        ...quiet,
      });
      expect(res.exitCode).toBe(1);
      expect(res.badgeFiles).toHaveLength(1);
    });
  });

  it('reflects the primary URL report when --compare is used', async () => {
    await withFixtureServer(routes, async (origin) => {
      const dir = await mkdtemp(join(tmpdir(), 'geolint-'));
      const file = join(dir, 'badge.svg');
      const res = await runCheck(origin, { compare: origin, badge: file, ...quiet });
      const svg = await readFile(file, 'utf8');
      expect(svg).toContain(`${res.report.score}/100 · ${res.report.grade}`);
      expect(res.badgeFiles).toEqual([file]);
    });
  });

  it('throws a clear error when the badge path is not writable', async () => {
    await withFixtureServer(routes, async (origin) => {
      await expect(
        runCheck(origin, { badge: join(tmpdir(), 'geolint-no-such-dir', 'b.svg'), ...quiet }),
      ).rejects.toThrow(/cannot write badge file/);
    });
  });
});
