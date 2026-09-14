import type { Rule, RuleFinding } from '../../core/types.js';

export const canonicalRule: Rule = {
  id: 'technical/canonical',
  category: 'technical',
  title: 'Canonical link sanity',
  description:
    'The canonical URL tells engines which URL owns the content. Missing, it invites duplicate-content ambiguity; pointing at a different origin, it can hand your citability to another domain.',
  severity: 'info',
  check(ctx) {
    if (!ctx.page || !ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const href = $('link[rel="canonical" i]').first().attr('href');
    const findings: RuleFinding[] = [];

    if (!href || href.trim() === '') {
      findings.push({
        severity: 'info',
        message: 'No canonical link element',
        detail:
          'Without a canonical, engines pick one themselves — and may consolidate onto the wrong URL.',
        fix: 'Add <link rel="canonical" href="…"> pointing at the preferred URL for this page.',
      });
      return findings;
    }

    try {
      const canonical = new URL(href, ctx.finalUrl);
      const page = new URL(ctx.finalUrl);
      if (canonical.origin !== page.origin) {
        findings.push({
          severity: 'warn',
          message: 'Canonical points to a different origin',
          detail: `Canonical is ${canonical.origin} while the page was served from ${page.origin} — citations and ranking signals will consolidate there instead.`,
          fix: 'Point the canonical at the preferred URL on this origin, unless the cross-origin canonical is intentional.',
          evidence: `<link rel="canonical" href="${href}">`,
        });
      }
    } catch {
      findings.push({
        severity: 'info',
        message: 'Canonical href could not be parsed',
        fix: 'Use an absolute or correctly resolvable relative URL in the canonical link.',
        evidence: `<link rel="canonical" href="${href}">`,
      });
    }
    return findings;
  },
};
