import { describe, expect, it } from 'vitest';
import { brokenLinksRule } from '../../src/rules/llms-txt/broken-links.js';
import { invalidStructureRule } from '../../src/rules/llms-txt/invalid-structure.js';
import { llmsFullMissingRule } from '../../src/rules/llms-txt/llms-full-missing.js';
import { llmsTxtMissingRule } from '../../src/rules/llms-txt/missing.js';
import { noSectionsRule } from '../../src/rules/llms-txt/no-sections.js';
import { noSummaryRule } from '../../src/rules/llms-txt/no-summary.js';
import { makeCtx, makeLlmsTxt, makePage } from '../helpers.js';

const VALID = `# Example Site
> An example site used in tests.

## Docs
- [Getting Started](https://example.com/docs/start): How to start
- [API](https://example.com/docs/api): API reference
`;

describe('llms-txt/missing', () => {
  it('warns when llms.txt is absent (404)', async () => {
    const findings = await llmsTxtMissingRule.check(makeCtx({ llmsTxt: makeLlmsTxt(null) }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.fix).toMatch(/llms\.txt/);
  });

  it('warns when llms.txt data is unavailable', async () => {
    const findings = await llmsTxtMissingRule.check(makeCtx({ llmsTxt: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('passes with a valid file', async () => {
    expect(await llmsTxtMissingRule.check(makeCtx({ llmsTxt: makeLlmsTxt(VALID) }))).toEqual([]);
  });
});

describe('llms-txt/invalid-structure', () => {
  it('warns when the H1 title is missing', async () => {
    const raw = 'Just some text\n\n- [a](https://example.com/a)\n';
    const findings = await invalidStructureRule.check(makeCtx({ llmsTxt: makeLlmsTxt(raw) }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toMatch(/H1/i);
  });

  it('warns when HTML is served instead of markdown', async () => {
    const findings = await invalidStructureRule.check(
      makeCtx({ llmsTxt: makeLlmsTxt('<!DOCTYPE html><html><body>app</body></html>') }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toMatch(/HTML/i);
  });

  it('warns on an empty file', async () => {
    const findings = await invalidStructureRule.check(makeCtx({ llmsTxt: makeLlmsTxt('   \n  ') }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toMatch(/empty/i);
  });

  it('passes on a valid file and when no file exists', async () => {
    expect(await invalidStructureRule.check(makeCtx({ llmsTxt: makeLlmsTxt(VALID) }))).toEqual([]);
    expect(await invalidStructureRule.check(makeCtx({ llmsTxt: makeLlmsTxt(null) }))).toEqual([]);
  });
});

describe('llms-txt/no-summary', () => {
  it('informs when the blockquote summary is missing', async () => {
    const raw = '# T\n\n## Docs\n- [a](https://example.com/a)\n';
    const findings = await noSummaryRule.check(makeCtx({ llmsTxt: makeLlmsTxt(raw) }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when a summary exists', async () => {
    expect(await noSummaryRule.check(makeCtx({ llmsTxt: makeLlmsTxt(VALID) }))).toEqual([]);
  });
});

describe('llms-txt/no-sections', () => {
  it('warns when there are no sections or links', async () => {
    const findings = await noSectionsRule.check(
      makeCtx({ llmsTxt: makeLlmsTxt('# T\n> summary only\n') }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('warns when sections exist but hold no links', async () => {
    const findings = await noSectionsRule.check(
      makeCtx({ llmsTxt: makeLlmsTxt('# T\n> s\n## Docs\nno links here\n') }),
    );
    expect(findings).toHaveLength(1);
  });

  it('passes on a valid file', async () => {
    expect(await noSectionsRule.check(makeCtx({ llmsTxt: makeLlmsTxt(VALID) }))).toEqual([]);
  });
});

describe('llms-txt/broken-links', () => {
  const raw = `# T
> s
## Docs
- [ok](https://example.com/ok)
- [bad](https://example.com/bad)
- [relative](/docs/rel)
`;

  it('warns listing links that return >= 400', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt(raw),
      fetchPage: async (u: string) =>
        makePage({ url: u, finalUrl: u, status: u.includes('bad') ? 404 : 200 }),
    });
    const findings = await brokenLinksRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidence).toContain('https://example.com/bad');
    expect(findings[0]!.evidence).not.toContain('https://example.com/ok');
  });

  it('passes when all sampled links resolve', async () => {
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt(raw),
      fetchPage: async (u: string) => makePage({ url: u, finalUrl: u }),
    });
    expect(await brokenLinksRule.check(ctx)).toEqual([]);
  });

  it('does not count a throwing fetch as a broken link', async () => {
    // Timeout / budget exhaustion is not evidence that the link is broken.
    const ctx = makeCtx({
      llmsTxt: makeLlmsTxt(raw),
      fetchPage: async () => {
        throw new Error('budget exhausted');
      },
    });
    expect(await brokenLinksRule.check(ctx)).toEqual([]);
  });
});

describe('llms-txt/llms-full-missing', () => {
  it('informs when /llms-full.txt returns >= 400', async () => {
    const ctx = makeCtx({
      fetchPage: async (u: string) => makePage({ url: u, finalUrl: u, status: 404 }),
    });
    const findings = await llmsFullMissingRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.evidence).toContain('/llms-full.txt');
  });

  it('passes when the file exists', async () => {
    const ctx = makeCtx({ fetchPage: async (u: string) => makePage({ url: u, finalUrl: u }) });
    expect(await llmsFullMissingRule.check(ctx)).toEqual([]);
  });

  it('returns [] when the fetch throws', async () => {
    const ctx = makeCtx({
      fetchPage: async () => {
        throw new Error('nope');
      },
    });
    expect(await llmsFullMissingRule.check(ctx)).toEqual([]);
  });
});
