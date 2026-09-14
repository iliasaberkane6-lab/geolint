import type { Rule } from '../../core/types.js';

const MAX_LINKS_TO_CHECK = 5;
const ABSOLUTE_HTTP_RE = /^https?:\/\//i;

export const brokenLinksRule: Rule = {
  id: 'llms-txt/broken-links',
  category: 'llms-txt',
  title: 'llms.txt links resolve',
  description:
    'llms.txt is a curated map for AI consumers — links that 404 or fail to load send crawlers into dead ends and waste their fetch budget.',
  severity: 'warn',
  async check(ctx) {
    const parsed = ctx.llmsTxt?.parsed;
    if (!parsed) {
      return [];
    }
    const urls = parsed.sections
      .flatMap((s) => s.links.map((l) => l.url))
      .filter((u) => ABSOLUTE_HTTP_RE.test(u))
      .slice(0, MAX_LINKS_TO_CHECK);
    if (urls.length === 0) {
      return [];
    }

    const broken: string[] = [];
    for (const url of urls) {
      try {
        const res = await ctx.fetchPage(url);
        if (res.status >= 400) {
          broken.push(`${url} (HTTP ${res.status})`);
        }
      } catch {
        // A throw means timeout/network/budget — not evidence the link is
        // broken. Stop sampling rather than report a false positive.
        break;
      }
    }

    if (broken.length === 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: `${broken.length} of ${urls.length} sampled llms.txt links are broken`,
        detail:
          'Links in llms.txt should point to pages that actually load — broken entries undermine the whole file.',
        fix: 'Update or remove the dead links in /llms.txt.',
        evidence: broken.join('\n'),
      },
    ];
  },
};
