import { describe, expect, it } from 'vitest';
import { blocksRoot, isAllowed, matchGroup, parseRobots } from '../src/core/robots.js';

describe('parseRobots', () => {
  it('parses groups and sitemaps', () => {
    const { groups, sitemaps } = parseRobots(`
User-agent: *
Disallow: /admin
Allow: /admin/public

User-agent: GPTBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
`);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.agents).toEqual(['*']);
    expect(groups[1]!.agents).toEqual(['gptbot']);
    expect(sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('treats consecutive UA lines as one group', () => {
    const { groups } = parseRobots(`
User-agent: GPTBot
User-agent: ClaudeBot
Disallow: /
`);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.agents).toEqual(['gptbot', 'claudebot']);
  });
});

describe('isAllowed', () => {
  const { groups } = parseRobots(`
User-agent: *
Disallow: /private
Allow: /private/ok

User-agent: GPTBot
Disallow: /
`);

  it('blocks a fully disallowed bot', () => {
    expect(blocksRoot(groups, 'GPTBot')).toBe(true);
    expect(isAllowed(groups, 'GPTBot', '/anything').allowed).toBe(false);
  });

  it('falls back to the wildcard group', () => {
    expect(isAllowed(groups, 'ClaudeBot', '/private/x').allowed).toBe(false);
    expect(isAllowed(groups, 'ClaudeBot', '/public').allowed).toBe(true);
  });

  it('longest match wins and allow beats disallow on ties', () => {
    expect(isAllowed(groups, 'Googlebot', '/private/ok').allowed).toBe(true);
  });

  it('empty disallow means allow all', () => {
    const { groups: g } = parseRobots('User-agent: *\nDisallow:\n');
    expect(isAllowed(g, 'AnyBot', '/anything').allowed).toBe(true);
  });
});

describe('matchGroup', () => {
  it('prefers the longest matching token', () => {
    const { groups } = parseRobots(`
User-agent: GPT
Disallow: /a
User-agent: GPTBot
Disallow: /b
`);
    expect(matchGroup(groups, 'GPTBot')!.rules[0]!.path).toBe('/b');
  });

  it('combines equally-specific matching groups (RFC 9309 §2.2.1)', () => {
    const { groups } = parseRobots(`
User-agent: GPTBot
Disallow: /admin
User-agent: GPTBot
Disallow: /
`);
    // Both groups match 'gptbot' at length 6 — their rules merge, so the
    // bot is blocked at '/' even though group 1 alone would allow it.
    expect(isAllowed(groups, 'GPTBot', '/').allowed).toBe(false);
  });

  it('combines duplicate wildcard groups', () => {
    const { groups } = parseRobots(`
User-agent: *
Disallow: /a
User-agent: *
Disallow: /b
`);
    expect(isAllowed(groups, 'AnyBot', '/a').allowed).toBe(false);
    expect(isAllowed(groups, 'AnyBot', '/b').allowed).toBe(false);
  });

  it('normalizes version and wildcard suffixes in UA values', () => {
    const { groups } = parseRobots(`
User-agent: GPTBot/1.0
Disallow: /v
User-agent: ClaudeBot*
Disallow: /w
`);
    expect(isAllowed(groups, 'GPTBot', '/v').allowed).toBe(false);
    expect(isAllowed(groups, 'ClaudeBot', '/w').allowed).toBe(false);
  });
});

describe('path matching', () => {
  const g = (body: string) => parseRobots(`User-agent: *\n${body}\n`).groups;

  it('supports * wildcards', () => {
    const groups = g('Disallow: /*.pdf');
    expect(isAllowed(groups, 'B', '/docs/a.pdf').allowed).toBe(false);
    expect(isAllowed(groups, 'B', '/docs/a.txt').allowed).toBe(true);
  });

  it('supports the $ end anchor', () => {
    const groups = g('Disallow: /tmp$');
    expect(isAllowed(groups, 'B', '/tmp').allowed).toBe(false);
    expect(isAllowed(groups, 'B', '/tmp/x').allowed).toBe(true);
  });

  it('$ matches only at the very end of the pattern', () => {
    // 'a$b' — the $ is mid-pattern, so it is a literal character.
    const groups = g('Disallow: /a$b');
    expect(isAllowed(groups, 'B', '/a$b/xyz').allowed).toBe(false);
    expect(isAllowed(groups, 'B', '/ab').allowed).toBe(true);
  });

  it('anchored pattern must equal the path exactly (a$b is not ab)', () => {
    const groups = g('Disallow: /ab$');
    expect(isAllowed(groups, 'B', '/abab').allowed).toBe(true);
    expect(isAllowed(groups, 'B', '/ab').allowed).toBe(false);
  });

  it('decodes percent-encoded unreserved octets before matching', () => {
    const groups = g('Disallow: /admin');
    expect(isAllowed(groups, 'B', '/%61dmin/x').allowed).toBe(false);
  });

  it('keeps reserved percent-encodings encoded', () => {
    const groups = g('Disallow: /a%2Fb');
    expect(isAllowed(groups, 'B', '/a%2Fb').allowed).toBe(false);
    expect(isAllowed(groups, 'B', '/a/b').allowed).toBe(true);
  });

  it('handles many wildcards without regex backtracking', () => {
    const groups = g('Disallow: /*a*a*a*a*a*a*a*a*b');
    const path = `/a${'a'.repeat(500)}`;
    expect(isAllowed(groups, 'B', path).allowed).toBe(true);
  });
});
