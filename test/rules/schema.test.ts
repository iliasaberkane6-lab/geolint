import { describe, expect, it } from 'vitest';
import { invalidJsonLdRule } from '../../src/rules/schema/invalid-jsonld.js';
import { missingArticleFieldsRule } from '../../src/rules/schema/missing-article-fields.js';
import { noBreadcrumbRule } from '../../src/rules/schema/no-breadcrumb.js';
import { noFaqSchemaRule } from '../../src/rules/schema/no-faq-schema.js';
import { noJsonLdRule } from '../../src/rules/schema/no-jsonld.js';
import { noOrganizationRule } from '../../src/rules/schema/no-organization.js';
import { makeCtx, makePage } from '../helpers.js';

const htmlWith = (body: string, head = '') =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe('schema/no-jsonld', () => {
  it('warns when no JSON-LD blocks exist', async () => {
    const findings = await noJsonLdRule.check(makeCtx());
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.fix).toBeTruthy();
  });

  it('passes when a JSON-LD block exists', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', jsonLd({ '@type': 'WebPage', name: 'x' })),
    });
    expect(await noJsonLdRule.check(makeCtx({ page }))).toEqual([]);
  });

  it('returns [] when the page is unreachable', async () => {
    expect(await noJsonLdRule.check(makeCtx({ page: null }))).toEqual([]);
  });
});

describe('schema/invalid-jsonld', () => {
  it('errors on malformed JSON-LD with evidence', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', '<script type="application/ld+json">{ "broken": , }</script>'),
    });
    const findings = await invalidJsonLdRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.evidence).toContain('"broken"');
  });

  it('passes on valid JSON-LD', async () => {
    const page = makePage({ html: htmlWith('<p>x</p>', jsonLd({ '@type': 'WebPage' })) });
    expect(await invalidJsonLdRule.check(makeCtx({ page }))).toEqual([]);
  });
});

describe('schema/missing-article-fields', () => {
  const article = (extra: Record<string, unknown> = {}) => ({
    '@type': 'Article',
    headline: 'A headline',
    datePublished: '2024-01-01',
    author: { '@type': 'Person', name: 'Jane' },
    ...extra,
  });

  it('warns listing the missing fields', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', jsonLd({ '@type': 'Article', headline: 'Only a headline' })),
    });
    const findings = await missingArticleFieldsRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.message).toContain('author');
    expect(findings[0]!.message).toContain('datePublished or dateModified');
  });

  it('walks @graph to find article nodes', async () => {
    const page = makePage({
      html: htmlWith(
        '<p>x</p>',
        jsonLd({ '@graph': [{ '@type': 'WebPage' }, { '@type': 'BlogPosting', author: {} }] }),
      ),
    });
    const findings = await missingArticleFieldsRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('headline');
  });

  it('passes on a complete article and on non-article pages', async () => {
    const ok = makePage({ html: htmlWith('<p>x</p>', jsonLd(article())) });
    expect(await missingArticleFieldsRule.check(makeCtx({ page: ok }))).toEqual([]);
    const other = makePage({ html: htmlWith('<p>x</p>', jsonLd({ '@type': 'Organization' })) });
    expect(await missingArticleFieldsRule.check(makeCtx({ page: other }))).toEqual([]);
  });
});

describe('schema/no-faq-schema', () => {
  const questions = '<h2>What is geolint?</h2><h3>How does it work?</h3>';

  it('informs when question headings lack FAQPage markup', async () => {
    const page = makePage({ html: htmlWith(questions) });
    const findings = await noFaqSchemaRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.message).toMatch(/FAQPage/i);
  });

  it('passes when FAQPage schema exists', async () => {
    const page = makePage({ html: htmlWith(questions, jsonLd({ '@type': 'FAQPage' })) });
    expect(await noFaqSchemaRule.check(makeCtx({ page }))).toEqual([]);
  });

  it('ignores pages with fewer than two question headings', async () => {
    const page = makePage({ html: htmlWith('<h2>Only one?</h2>') });
    expect(await noFaqSchemaRule.check(makeCtx({ page }))).toEqual([]);
  });
});

describe('schema/no-organization', () => {
  it('informs when Organization schema is absent', async () => {
    const findings = await noOrganizationRule.check(makeCtx());
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when Organization schema exists', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', jsonLd({ '@type': 'Organization', name: 'Acme' })),
    });
    expect(await noOrganizationRule.check(makeCtx({ page }))).toEqual([]);
  });
});

describe('schema/no-breadcrumb', () => {
  it('informs when BreadcrumbList schema is absent', async () => {
    const findings = await noBreadcrumbRule.check(makeCtx());
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
  });

  it('passes when BreadcrumbList schema exists', async () => {
    const page = makePage({
      html: htmlWith('<p>x</p>', jsonLd({ '@type': 'BreadcrumbList' })),
    });
    expect(await noBreadcrumbRule.check(makeCtx({ page }))).toEqual([]);
  });
});
