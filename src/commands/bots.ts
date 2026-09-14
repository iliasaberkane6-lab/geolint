import { AI_BOTS, type AiBot } from '../core/bots.js';
import { formatTable } from './util.js';

export type BotsFormat = 'table' | 'json';

/**
 * What blocking a bot costs the site, derived from its purpose: search and
 * user-fetch bots gate current citations; training bots gate future models.
 */
export function impactFor(purpose: AiBot['purpose']): string {
  switch (purpose) {
    case 'search':
    case 'user-fetch':
      return 'invisible in AI answers now';
    case 'training':
      return 'absent from future training data';
    case 'mixed':
      return 'invisible in AI answers now + absent from future training data';
  }
}

/** Print the AI crawler matrix: token, company, purpose, impact-if-blocked. */
export function listBots(opts: { format?: BotsFormat } = {}): string {
  const rows = AI_BOTS.map((b) => ({
    token: b.id,
    company: b.company,
    purpose: b.purpose,
    impact: impactFor(b.purpose),
  }));
  if (opts.format === 'json') {
    return JSON.stringify(rows, null, 2);
  }
  return formatTable(
    ['TOKEN', 'COMPANY', 'PURPOSE', 'IMPACT IF BLOCKED'],
    rows.map((r) => [r.token, r.company, r.purpose, r.impact]),
  );
}
