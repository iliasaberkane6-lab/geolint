import { AI_BOTS } from '../../core/bots.js';
import type { Rule, RuleFinding } from '../../core/types.js';

const NOINDEX_RE = /\bnoindex\b|\bnone\b/;
const NOSNIPPET_RE = /\bnosnippet\b|max-snippet\s*[:=]\s*0(?!\d)/;
const AI_OPTOUT_RE = /\bnoai\b|\bnoimageai\b/;
const UNAVAILABLE_AFTER_RE = /\bunavailable_after\b/;
const GATEKEEPER_UAS = new Set(['googlebot', 'bingbot', 'applebot', 'duckduckbot']);

/**
 * X-Robots-Tag may carry UA-scoped segments ('googlebot: noindex').
 * Split them: scoped directives only count when they target every bot or
 * a crawler whose index/answers this audit cares about.
 */
const KNOWN_DIRECTIVES = new Set([
  'all',
  'index',
  'noindex',
  'follow',
  'nofollow',
  'none',
  'noarchive',
  'nosnippet',
  'notranslate',
  'noimageindex',
  'unavailable_after',
  'indexifembedded',
  'nositelinkssearchbox',
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
]);

function scopedHeaderValues(header: string): string[] {
  const out: string[] = [];
  for (const part of header.split(',')) {
    const seg = part.trim();
    const m = seg.match(/^([a-zA-Z0-9_*-]+)\s*:\s*(.+)$/);
    if (!m || KNOWN_DIRECTIVES.has(m[1]!.toLowerCase())) {
      out.push(seg); // unscoped directive (possibly with an argument)
      continue;
    }
    const scope = m[1]!.toLowerCase();
    const relevant =
      scope === '*' ||
      GATEKEEPER_UAS.has(scope) ||
      AI_BOTS.some(
        (b) => scope.startsWith(b.id.toLowerCase()) || b.id.toLowerCase().startsWith(scope),
      );
    if (relevant) {
      out.push(m[2]!);
    }
    // Directives scoped to unrelated bots (e.g. 'mybot: noindex') don't
    // govern AI crawlers — skip rather than false-positive.
  }
  return out;
}

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
      for (const value of scopedHeaderValues(header)) {
        sources.push({ origin: 'X-Robots-Tag header', value });
      }
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
          detail: 'noai/noimageai signals that AI systems should not use this content.',
          fix: 'Remove the opt-out directive if you want AI engines to use and cite this page.',
          evidence,
        });
      } else if (UNAVAILABLE_AFTER_RE.test(v)) {
        findings.push({
          severity: 'info',
          message: 'Page is scheduled for index removal (unavailable_after)',
          detail:
            'unavailable_after asks engines to drop the page from their index after a date — it will also disappear from AI answers then. It is not an AI opt-out, but it is worth knowing about.',
          fix: 'Check the unavailable_after date is intentional.',
          evidence,
        });
      }
    }
    return findings;
  },
};
