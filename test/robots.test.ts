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
});
