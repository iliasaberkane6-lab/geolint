import type { Rule } from '../../core/types.js';

export const llmsFullMissingRule: Rule = {
  id: 'llms-txt/llms-full-missing',
  category: 'llms-txt',
  title: 'llms-full.txt companion file',
  description:
    'llms-full.txt is the optional companion that inlines full documentation/content in one file, so an AI system can ingest everything in a single request. Sites serious about AI readability publish it.',
  severity: 'info',
  async check(ctx) {
    try {
      const origin = new URL(ctx.finalUrl).origin;
      const res = await ctx.fetchPage(`${origin}/llms-full.txt`);
      if (res.status < 400) {
        return [];
      }
      return [
        {
          severity: 'info',
          message: 'No llms-full.txt found',
          detail: `GET ${origin}/llms-full.txt returned HTTP ${res.status}. The optional full-content companion is absent.`,
          fix: 'Consider publishing /llms-full.txt with your key documentation inlined as markdown.',
          evidence: `${origin}/llms-full.txt → HTTP ${res.status}`,
        },
      ];
    } catch {
      // Fetch budget exhausted or URL unparseable — nothing to report.
      return [];
    }
  },
};
