import type { Rule } from '../../core/types.js';

export const llmsTxtMissingRule: Rule = {
  id: 'llms-txt/missing',
  category: 'llms-txt',
  title: 'llms.txt present',
  description:
    'llms.txt (llmstxt.org) is the emerging standard for telling AI systems what your site is about and where its most citable content lives. Without it, answer engines have no curated map of your site.',
  severity: 'warn',
  check(ctx) {
    const lt = ctx.llmsTxt;
    if (lt !== null && lt.status < 400 && lt.parsed !== null) {
      return [];
    }
    const detail =
      lt === null || lt.status === 0
        ? 'llms.txt could not be fetched at all.'
        : `GET ${lt.url} returned HTTP ${lt.status}.`;
    return [
      {
        severity: 'warn',
        message: 'No llms.txt found',
        detail,
        fix: 'Create /llms.txt at the site root: an H1 title, a short blockquote summary, and ## sections linking to your key content.',
        evidence: lt ? `${lt.url} → HTTP ${lt.status}` : 'llms.txt data unavailable',
      },
    ];
  },
};
