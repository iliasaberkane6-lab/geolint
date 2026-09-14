import { describe, expect, it } from 'vitest';
import { imagesNoAltRule } from '../../src/rules/content/images-no-alt.js';
import { langMissingRule } from '../../src/rules/content/lang-missing.js';
import { missingDatesRule } from '../../src/rules/content/missing-dates.js';
import { noAuthorRule } from '../../src/rules/content/no-author.js';
import { noDataPointsRule } from '../../src/rules/content/no-data-points.js';
import { noH1Rule } from '../../src/rules/content/no-h1.js';
import { noQuestionHeadingsRule } from '../../src/rules/content/no-question-headings.js';
import { noStructureRule } from '../../src/rules/content/no-structure.js';
import { thinContentRule } from '../../src/rules/content/thin-content.js';
import { makeCtx, makePage } from '../helpers.js';

const htmlWith = (body: string, head = '', htmlAttrs = 'lang="en"') =>
  `<!doctype html><html ${htmlAttrs}><head>${head}</head><body>${body}</body></html>`;

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

const pageOf = (body: string, head = '') =>
  makeCtx({ page: makePage({ html: htmlWith(body, head) }) });

describe('content/thin-content', () => {
  it('warns under 200 words of visible text', async () => {
    const findings = await thinContentRule.check(pageOf(`<h1>t</h1><p>${words(80)}</p>`));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('passes with 200+ words', async () => {
    expect(await thinContentRule.check(pageOf(`<h1>t</h1><p>${words(250)}</p>`))).toEqual([]);
  });
});

describe('content/no-h1', () => {
  it('warns when there is no h1', async () => {
    const findings = await noH1Rule.check(pageOf('<p>text</p>'));
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.message).toMatch(/no <h1>/i);
  });

  it('warns when the h1 is empty', async () => {
    const findings = await noH1Rule.check(pageOf('<h1>   </h1><p>text</p>'));
    expect(findings[0]!.message).toMatch(/empty/i);
  });

  it('passes with a non-empty h1', async () => {
    expect(await noH1Rule.check(pageOf('<h1>Hello</h1>'))).toEqual([]);
  });
});

describe('content/no-question-headings', () => {
  it('informs when no h2/h3 ends with a question mark', async () => {
    const findings = await noQuestionHeadingsRule.check(
      pageOf('<h2>Overview</h2><h3>Details</h3>'),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when a question heading exists', async () => {
    expect(await noQuestionHeadingsRule.check(pageOf('<h2>What is this?</h2>'))).toEqual([]);
  });
});

describe('content/missing-dates', () => {
  it('warns when no machine-readable date exists', async () => {
    const findings = await missingDatesRule.check(pageOf('<p>undated content</p>'));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
  });

  it('passes with a <time datetime> element', async () => {
    expect(
      await missingDatesRule.check(pageOf('<time datetime="2024-01-01">Jan 1</time>')),
    ).toEqual([]);
  });

  it('passes with article:published_time meta', async () => {
    const ctx = makeCtx({
      page: makePage({
        html: htmlWith('<p>x</p>', '<meta property="article:published_time" content="2024-01-01">'),
      }),
    });
    expect(await missingDatesRule.check(ctx)).toEqual([]);
  });

  it('passes with a JSON-LD datePublished', async () => {
    const ld = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Article',
      datePublished: '2024-01-01',
    })}</script>`;
    expect(await missingDatesRule.check(pageOf('<p>x</p>', ld))).toEqual([]);
  });
});

describe('content/no-author', () => {
  it('informs when no attribution exists', async () => {
    const findings = await noAuthorRule.check(pageOf('<p>anonymous</p>'));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes with meta[name=author]', async () => {
    const ctx = makeCtx({
      page: makePage({ html: htmlWith('<p>x</p>', '<meta name="author" content="Jane">') }),
    });
    expect(await noAuthorRule.check(ctx)).toEqual([]);
  });

  it('passes with a visible author/byline element', async () => {
    expect(await noAuthorRule.check(pageOf('<span class="byline">By Jane</span>'))).toEqual([]);
    expect(await noAuthorRule.check(pageOf('<span class="post-author">Jane</span>'))).toEqual([]);
  });

  it('passes with a JSON-LD author key', async () => {
    const ld = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Article',
      author: { '@type': 'Person', name: 'Jane' },
    })}</script>`;
    expect(await noAuthorRule.check(pageOf('<p>x</p>', ld))).toEqual([]);
  });
});

describe('content/no-data-points', () => {
  it('informs when fewer than 3 stats appear', async () => {
    const findings = await noDataPointsRule.check(pageOf('<p>sales grew 20% last year</p>'));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes with 3+ data points', async () => {
    const body = '<p>Grew 20%, reached 5 million users, a 3x increase and $0 costs.</p>';
    // note: $0 is not counted; 20%, 5 million, 3x = 3 matches
    expect(await noDataPointsRule.check(pageOf(body))).toEqual([]);
  });
});

describe('content/images-no-alt', () => {
  it('informs when >50% of 4+ images lack alt', async () => {
    const body = '<img src="a.png"><img src="b.png"><img src="c.png"><img src="d.png" alt="chart">';
    const findings = await imagesNoAltRule.check(pageOf(body));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when most images have alt text', async () => {
    const body =
      '<img src="a.png" alt="a"><img src="b.png" alt="b"><img src="c.png" alt="c"><img src="d.png">';
    expect(await imagesNoAltRule.check(pageOf(body))).toEqual([]);
  });

  it('ignores pages with fewer than 4 images', async () => {
    expect(await imagesNoAltRule.check(pageOf('<img src="a.png"><img src="b.png">'))).toEqual([]);
  });
});

describe('content/no-structure', () => {
  it('informs on a long page with no lists or tables', async () => {
    const findings = await noStructureRule.check(pageOf(`<p>${words(600)}</p>`));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when the page has a list', async () => {
    const body = `<p>${words(600)}</p><ul><li>one</li></ul>`;
    expect(await noStructureRule.check(pageOf(body))).toEqual([]);
  });

  it('ignores short pages', async () => {
    expect(await noStructureRule.check(pageOf('<p>short</p>'))).toEqual([]);
  });
});

describe('content/lang-missing', () => {
  it('informs when <html> has no lang', async () => {
    const ctx = makeCtx({
      page: makePage({ html: '<!doctype html><html><body><p>x</p></body></html>' }),
    });
    const findings = await langMissingRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when lang is set', async () => {
    expect(await langMissingRule.check(makeCtx())).toEqual([]);
  });
});
