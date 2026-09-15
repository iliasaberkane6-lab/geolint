import { AI_BOTS } from '../../core/bots.js';
import { isAllowed } from '../../core/robots.js';
import type { Rule } from '../../core/types.js';

const ABSOLUTE_HTTP_RE = /^https?:\/\//i;
const MAX_LINKS = 10;
const MAX_BOTS_LISTED = 4;

/**
 * Bots whose access matters for being cited *now*: answer engines and
 * user-initiated fetchers. Training crawlers are excluded — blocking them
 * is a legitimate opt-out that does not hurt current visibility.
 */
const CITATION_BOTS = AI_BOTS.filter(
  (b) => !b.retired && !b.controlOnly && b.purpose !== 'training',
);

export const linksBlockedByRobotsRule: Rule = {
  id: 'llms-txt/links-blocked-by-robots',
  category: 'llms-txt',
  title: 'llms.txt links are crawlable by AI bots',
  description:
    'llms.txt is a curated map handed to AI consumers — when robots.txt disallows the very pages it recommends, crawlers follow the map into a wall and the file backfires.',
  severity: 'warn',
  check(ctx) {
    const parsed = ctx.llmsTxt?.parsed;
    if (!parsed || !ctx.robots?.groups.length) {
      return [];
    }

    let origin: string;
    try {
      origin = new URL(ctx.finalUrl).origin;
    } catch {
      return [];
    }

    const blocked: string[] = [];
    const seen = new Set<string>();
    for (const link of parsed.sections.flatMap((s) => s.links)) {
      if (blocked.length >= MAX_LINKS) {
        break;
      }
      if (!ABSOLUTE_HTTP_RE.test(link.url)) {
        continue; // relative-links rule owns that case
      }
      let path: string;
      try {
        const u = new URL(link.url);
        if (u.origin !== origin) {
          continue; // cross-origin robots.txt is a different file — out of scope
        }
        path = u.pathname + u.search;
      } catch {
        continue;
      }
      if (seen.has(path)) {
        continue;
      }
      seen.add(path);

      const denied = CITATION_BOTS.filter(
        (b) => !isAllowed(ctx.robots!.groups, b.id, path).allowed,
      );
      if (denied.length > 0) {
        const names = denied
          .slice(0, MAX_BOTS_LISTED)
          .map((b) => b.id)
          .join(', ');
        const more =
          denied.length > MAX_BOTS_LISTED ? ` +${denied.length - MAX_BOTS_LISTED} more` : '';
        blocked.push(`${link.url} — blocked for ${names}${more}`);
      }
    }

    if (blocked.length === 0) {
      return [];
    }
    return [
      {
        severity: 'warn',
        message: `${blocked.length} llms.txt link(s) point to pages robots.txt disallows for AI bots`,
        detail:
          'The file recommends these pages to AI consumers while robots.txt tells their crawlers to stay away — the contradiction makes the curated list useless for exactly the audience it was written for.',
        fix: 'Allow the recommended paths for AI crawler tokens in robots.txt, or remove those links from llms.txt.',
        evidence: blocked.join('\n'),
      },
    ];
  },
};
