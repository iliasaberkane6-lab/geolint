import { describe, expect, it } from 'vitest';
import type { RobotsData } from '../../src/core/types.js';
import { aiOptOutSignalsRule } from '../../src/rules/ai-crawler/ai-opt-out-signals.js';
import { crawlDelayRule } from '../../src/rules/ai-crawler/crawl-delay.js';
import { metaRobotsBlockingRule } from '../../src/rules/ai-crawler/meta-robots-blocking.js';
import { robotsMissingRule } from '../../src/rules/ai-crawler/robots-missing.js';
import { robotsUnreachableRule } from '../../src/rules/ai-crawler/robots-unreachable.js';
import { searchBotsBlockedRule } from '../../src/rules/ai-crawler/search-bots-blocked.js';
import { trainingBotsBlockedRule } from '../../src/rules/ai-crawler/training-bots-blocked.js';
import { wildcardBlockAllRule } from '../../src/rules/ai-crawler/wildcard-block-all.js';
import { makeCtx, makePage, makeRobots } from '../helpers.js';

const BLOCK_ALL = `User-agent: *
Disallow: /
`;

const OPEN = `User-agent: *
Allow: /
`;

const unreachableRobots: RobotsData = {
  url: 'https://example.com/robots.txt',
  status: 0,
  raw: null,
  groups: [],
  sitemaps: [],
};

describe('ai-crawler/search-bots-blocked', () => {
  it('reports every blocked search/user-fetch/mixed bot', async () => {
    const findings = await searchBotsBlockedRule.check(makeCtx({ robots: makeRobots(BLOCK_ALL) }));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
    const messages = findings.map((f) => f.message).join('\n');
    expect(messages).toContain('OAI-SearchBot');
    expect(messages).toContain('PerplexityBot');
    // bypass-posture fetchers are reported by ai-crawler/user-fetch-bypass instead
    expect(messages).not.toContain('ChatGPT-User');
    expect(messages).not.toContain('Perplexity-User');
    // training-only bots are covered by the other rule
    expect(messages).not.toContain('GPTBot');
    expect(messages).not.toContain('ClaudeBot');
  });

  it('reports a bot blocked by its own group', async () => {
    const robots = makeRobots(`${OPEN}\nUser-agent: OAI-SearchBot\nDisallow: /\n`);
    const findings = await searchBotsBlockedRule.check(makeCtx({ robots }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('OAI-SearchBot');
    expect(findings[0]!.evidence).toContain('Disallow: /');
    expect(findings[0]!.fix).toBeTruthy();
  });

  it('passes when robots.txt allows everything', async () => {
    expect(await searchBotsBlockedRule.check(makeCtx({ robots: makeRobots(OPEN) }))).toEqual([]);
  });

  it('returns [] when there is no usable robots data', async () => {
    expect(await searchBotsBlockedRule.check(makeCtx({ robots: makeRobots(null) }))).toEqual([]);
    expect(await searchBotsBlockedRule.check(makeCtx({ robots: null }))).toEqual([]);
  });
});

describe('ai-crawler/training-bots-blocked', () => {
  it('warns about blocked training bots', async () => {
    const robots = makeRobots('User-agent: GPTBot\nDisallow: /\n');
    const findings = await trainingBotsBlockedRule.check(makeCtx({ robots }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.message).toContain('GPTBot');
    expect(findings[0]!.detail).toMatch(/training/i);
  });

  it('passes when training bots are allowed', async () => {
    expect(await trainingBotsBlockedRule.check(makeCtx({ robots: makeRobots(OPEN) }))).toEqual([]);
  });

  it('returns [] without robots data', async () => {
    expect(await trainingBotsBlockedRule.check(makeCtx({ robots: null }))).toEqual([]);
  });
});

describe('ai-crawler/wildcard-block-all', () => {
  it('flags a wildcard group disallowing the root', async () => {
    const findings = await wildcardBlockAllRule.check(makeCtx({ robots: makeRobots(BLOCK_ALL) }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.evidence).toContain('User-agent: *');
    expect(findings[0]!.evidence).toContain('Disallow: /');
  });

  it('ignores a wildcard group that only disallows a subpath', async () => {
    const robots = makeRobots('User-agent: *\nDisallow: /admin\n');
    expect(await wildcardBlockAllRule.check(makeCtx({ robots }))).toEqual([]);
  });

  it('passes for open robots', async () => {
    expect(await wildcardBlockAllRule.check(makeCtx({ robots: makeRobots(OPEN) }))).toEqual([]);
  });
});

describe('ai-crawler/robots-missing', () => {
  it('warns when robots.txt returns 404', async () => {
    const findings = await robotsMissingRule.check(makeCtx({ robots: makeRobots(null) }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.message).toMatch(/no robots\.txt/i);
  });

  it('passes when robots.txt exists', async () => {
    expect(await robotsMissingRule.check(makeCtx({ robots: makeRobots(OPEN) }))).toEqual([]);
  });

  it('defers to robots-unreachable when the fetch failed', async () => {
    expect(await robotsMissingRule.check(makeCtx({ robots: null }))).toEqual([]);
    expect(await robotsMissingRule.check(makeCtx({ robots: unreachableRobots }))).toEqual([]);
  });
});

describe('ai-crawler/robots-unreachable', () => {
  it('warns when robots data is missing entirely', async () => {
    const findings = await robotsUnreachableRule.check(makeCtx({ robots: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('warns when the robots fetch failed (status 0)', async () => {
    const findings = await robotsUnreachableRule.check(makeCtx({ robots: unreachableRobots }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('passes on 200 and on a clean 404', async () => {
    expect(await robotsUnreachableRule.check(makeCtx({ robots: makeRobots(OPEN) }))).toEqual([]);
    expect(await robotsUnreachableRule.check(makeCtx({ robots: makeRobots(null) }))).toEqual([]);
  });
});

describe('ai-crawler/meta-robots-blocking', () => {
  const pageWith = (html: string, headers: Record<string, string> = {}) =>
    makeCtx({ page: makePage({ html, headers }) });

  it('flags noindex in the X-Robots-Tag header as error', async () => {
    const findings = await metaRobotsBlockingRule.check(
      pageWith('<html><body>x</body></html>', { 'x-robots-tag': 'noindex' }),
    );
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.evidence).toContain('X-Robots-Tag');
  });

  it('flags noindex in a robots meta tag as error', async () => {
    const findings = await metaRobotsBlockingRule.check(
      pageWith(
        '<html><head><meta name="robots" content="noindex, nofollow"></head><body>x</body></html>',
      ),
    );
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.message).toMatch(/noindex/i);
  });

  it('warns on nosnippet and max-snippet:0', async () => {
    const nosnippet = await metaRobotsBlockingRule.check(
      pageWith('<html><head><meta name="robots" content="nosnippet"></head><body>x</body></html>'),
    );
    expect(nosnippet[0]!.severity).toBe('warn');
    const maxSnippet = await metaRobotsBlockingRule.check(
      pageWith('<html><body>x</body></html>', { 'x-robots-tag': 'max-snippet:0' }),
    );
    expect(maxSnippet[0]!.severity).toBe('warn');
    expect(maxSnippet[0]!.message).toMatch(/snippet/i);
  });

  it('warns on explicit AI opt-out directives', async () => {
    const findings = await metaRobotsBlockingRule.check(
      pageWith('<html><head><meta name="robots" content="noai"></head><body>x</body></html>'),
    );
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.message).toMatch(/opt-out/i);
  });

  it('passes on a clean page and on null page', async () => {
    expect(await metaRobotsBlockingRule.check(makeCtx())).toEqual([]);
    expect(await metaRobotsBlockingRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});

describe('ai-crawler/crawl-delay', () => {
  it('reports a wildcard crawl-delay as one info finding', async () => {
    const robots = makeRobots('User-agent: *\nCrawl-delay: 10\nAllow: /\n');
    const findings = await crawlDelayRule.check(makeCtx({ robots }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.message).toContain('10');
  });

  it('reports a bot-specific crawl-delay', async () => {
    const robots = makeRobots('User-agent: GPTBot\nCrawl-delay: 5\nDisallow: /tmp\n');
    const findings = await crawlDelayRule.check(makeCtx({ robots }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('GPTBot');
  });

  it('passes when no delay is set', async () => {
    expect(await crawlDelayRule.check(makeCtx({ robots: makeRobots(OPEN) }))).toEqual([]);
  });
});

describe('ai-crawler/ai-opt-out-signals', () => {
  it('detects a noai meta tag', async () => {
    const page = makePage({
      html: '<html><head><meta name="noai" content="all"></head><body>x</body></html>',
    });
    const findings = await aiOptOutSignalsRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.evidence).toContain('noai');
  });

  it('detects the X-TDM-Reservation header', async () => {
    const page = makePage({ headers: { 'x-tdm-reservation': '1' } });
    const findings = await aiOptOutSignalsRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidence).toContain('X-TDM-Reservation');
  });

  it('passes on a clean page and null page', async () => {
    expect(await aiOptOutSignalsRule.check(makeCtx())).toEqual([]);
    expect(await aiOptOutSignalsRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});
