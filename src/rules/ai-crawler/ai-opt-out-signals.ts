import type { Rule } from '../../core/types.js';

/** Meta names that explicitly opt content out of AI/ML use. */
const OPTOUT_META_NAMES = ['noai', 'noimageai', 'tdm-reservation'];

export const aiOptOutSignalsRule: Rule = {
  id: 'ai-crawler/ai-opt-out-signals',
  category: 'ai-crawler',
  title: 'Explicit AI opt-out signals',
  description:
    'Signals like <meta name="noai">, TDM-Reservation headers or ai.txt-style markers tell AI systems to stay out. That is a legitimate choice — but it is worth surfacing so it is never an accidental leftover.',
  severity: 'info',
  check(ctx) {
    if (!ctx.page || !ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const signals: string[] = [];

    for (const name of OPTOUT_META_NAMES) {
      $(`meta[name="${name}"]`).each((_, el) => {
        const content = $(el).attr('content');
        signals.push(`<meta name="${name}"${content ? ` content="${content}"` : ''}>`);
      });
    }
    const tdmHeader = ctx.page.headers['x-tdm-reservation'];
    if (tdmHeader) {
      signals.push(`X-TDM-Reservation: ${tdmHeader}`);
    }

    if (signals.length === 0) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'Explicit AI opt-out signals detected on this page',
        detail:
          'The page asks AI systems not to use its content. Remove these signals if you want AI engines to train on, summarize or cite it.',
        fix: 'Delete the opt-out meta tags/headers if AI visibility is intended.',
        evidence: signals.join('\n'),
      },
    ];
  },
};
