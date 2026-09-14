import type { Rule } from '../../core/types.js';

export const pageUnreachableRule: Rule = {
  id: 'technical/page-unreachable',
  category: 'technical',
  title: 'Page fetchable',
  description:
    'If we cannot fetch the page, neither can AI crawlers. Everything else in the audit depends on the page actually loading.',
  severity: 'error',
  check(ctx) {
    if (ctx.page !== null) {
      return [];
    }
    return [
      {
        severity: 'error',
        message: 'Page could not be fetched',
        detail:
          'The request failed at the network level (DNS, connection, TLS or timeout). AI crawlers hitting the same wall see nothing.',
        fix: 'Check the URL, DNS, TLS certificate and that the server responds to plain GET requests without requiring JS or auth.',
        evidence: ctx.url,
      },
    ];
  },
};
