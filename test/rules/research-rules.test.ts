import { describe, expect, it } from 'vitest';
import { searchBotsBlockedRule } from '../../src/rules/ai-crawler/search-bots-blocked.js';
import { staleTokensRule } from '../../src/rules/ai-crawler/stale-tokens.js';
import { userFetchBypassRule } from '../../src/rules/ai-crawler/user-fetch-bypass.js';
import { multipleH1Rule } from '../../src/rules/llms-txt/multiple-h1.js';
import { optionalNotLastRule } from '../../src/rules/llms-txt/optional-not-last.js';
import { relativeLinksRule } from '../../src/rules/llms-txt/relative-links.js';
import { robotsDirectivesRule } from '../../src/rules/llms-txt/robots-directives.js';
import { makeCtx, makeLlmsTxt, makeRobots } from '../helpers.js';

describe('ai-crawler/user-fetch-bypass', () => {
  it('informs when a bypass-posture fetcher is disallowed', async () => {
    const ctx = makeCtx({
      robots: makeRobots('User-agent: ChatGPT-User\nDisallow: /\n'),
    });
    const findings = await userFetchBypassRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.message).toContain('ChatGPT-User');
  });

  it('passes when bypass fetchers are allowed', async () => {
    const ctx = makeCtx({ robots: makeRobots('User-agent: *\nAllow: /\n') });
    expect(await userFetchBypassRule.check(ctx)).toHaveLength(0);
  });
});

describe('ai-crawler/stale-tokens', () => {
  it('flags retired tokens with their replacement', async () => {
    const ctx = makeCtx({
      robots: makeRobots(
        'User-agent: anthropic-ai\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n',
      ),
    });
    const findings = await staleTokensRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.fix).toContain('ClaudeBot');
  });

  it('ignores current tokens', async () => {
    const ctx = makeCtx({ robots: makeRobots('User-agent: GPTBot\nDisallow: /\n') });
    expect(await staleTokensRule.check(ctx)).toHaveLength(0);
  });
});

describe('search-bots-blocked bypass handling', () => {
  it('does not double-report bypass fetchers as errors', async () => {
    const ctx = makeCtx({
      robots: makeRobots(
        'User-agent: ChatGPT-User\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n',
      ),
    });
    const findings = await searchBotsBlockedRule.check(ctx);
    const messages = findings.map((f) => f.message).join('\n');
    expect(messages).not.toContain('ChatGPT-User');
    expect(messages).toContain('OAI-SearchBot');
  });
});

describe('llms-txt/relative-links', () => {
  it('warns on relative link targets', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt('# Site\n> sum\n\n## Docs\n- [a](/docs/a)\n- [b](https://x.com/b)\n'),
    });
    const findings = await relativeLinksRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidence).toContain('/docs/a');
  });

  it('passes with absolute links only', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt('# Site\n> s\n\n## D\n- [a](https://x.com/a)\n'),
    });
    expect(await relativeLinksRule.check(ctx)).toHaveLength(0);
  });
});

describe('llms-txt/optional-not-last', () => {
  it('warns when Optional is not the final section', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt(
        '# S\n> x\n\n## Optional\n- [a](https://x.com/a)\n\n## Docs\n- [b](https://x.com/b)\n',
      ),
    });
    expect(await optionalNotLastRule.check(ctx)).toHaveLength(1);
  });

  it('passes when Optional is last', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt(
        '# S\n> x\n\n## Docs\n- [b](https://x.com/b)\n\n## Optional\n- [a](https://x.com/a)\n',
      ),
    });
    expect(await optionalNotLastRule.check(ctx)).toHaveLength(0);
  });
});

describe('llms-txt/robots-directives', () => {
  it('warns on robots directives inside llms.txt', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt(
        '# S\n> x\n\nUser-agent: *\nDisallow: /private\n\n## D\n- [a](https://x.com/a)\n',
      ),
    });
    const findings = await robotsDirectivesRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });
});

describe('llms-txt/multiple-h1', () => {
  it('flags more than one H1', async () => {
    const ctx = makeCtx({ llmsTxt: makeLlmsTxt('# One\n# Two\n> s\n') });
    const findings = await multipleH1Rule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('2');
  });

  it('passes with a single H1', async () => {
    const ctx = makeCtx({ llmsTxt: makeLlmsTxt('# One\n> s\n## D\n- [a](https://x.com/a)\n') });
    expect(await multipleH1Rule.check(ctx)).toHaveLength(0);
  });
});
