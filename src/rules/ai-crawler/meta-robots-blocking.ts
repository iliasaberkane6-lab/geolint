import type { Rule, RuleFinding } from '../../core/types.js';

const NOINDEX_RE = /\bnoindex\b|\bnone\b/;
const NOSNIPPET_RE = /\bnosnippet\b|max-snippet\s*[:=]\s*0(?!\d)/;
const AI_OPTOUT_RE = /\bnoai\b|\bnoimageai\b|\bunavailable_after\b/;

export const metaRobotsBlockingRule: Rule = {
  id: 'ai-crawler/meta-robots-blocking',
  category: 'ai-crawler',
  title: 'No noindex/nosnippet directives blocking AI use',
  description:
    'X-Robots-Tag headers and robots meta tags apply to AI crawlers too: noindex keeps the page out of AI answers entirely, while nosnippet or max-snippet:0 makes it impossible for engines to quote you.',
  severity: 'error',
  check(ctx) {
    if (!ctx.page || !ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const sources: { origin: string; value: string }[] = [];

    const header = ctx.page.headers['x-robots-tag'];
    if (header) {
      sources.push({ origin: 'X-Robots-Tag header', value: header });
    }
    $('meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content) {
        sources.push({ origin: `<meta name="${$(el).attr('name')}">`, value: content });
      }
    });

    const findings: RuleFinding[] = [];
    for (const { origin, value } of sources) {
      const v = value.toLowerCase();
      const evidence = `${origin}: ${value.trim()}`;
      if (NOINDEX_RE.test(v)) {
        findings.push({
          severity: 'error',
          message: 'Page is marked noindex — AI engines will not index or cite it',
          detail:
            'noindex/none removes the page from search indexes, and answer engines that rely on those indexes will never cite it.',
          fix: 'Remove the noindex/none directive from the meta tag or X-Robots-Tag header.',
          evidence,
        });
      } else if (NOSNIPPET_RE.test(v)) {
        findings.push({
          severity: 'warn',
          message: 'Snippet generation is disabled — AI engines cannot quote this page',
          detail:
            'nosnippet or max-snippet:0 forbids text extracts, which prevents answer engines from citing your content even when they can read it.',
          fix: 'Remove nosnippet / max-snippet:0, or raise max-snippet to a useful length.',
          evidence,
        });
      } else if (AI_OPTOUT_RE.test(v)) {
        findings.push({
          severity: 'warn',
          message: 'Explicit AI opt-out directive found',
          detail:
            'noai/noimageai/unavailable_after signals that AI systems should not use this content.',
          fix: 'Remove the opt-out directive if you want AI engines to use and cite this page.',
          evidence,
        });
      }
    }
    return findings;
  },
};
