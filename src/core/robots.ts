import { fetchPage } from './fetch.js';
import type { PageData, ResolvedScanOptions, RobotGroup, RobotsData } from './types.js';

/**
 * Parse robots.txt into groups following RFC 9309 semantics:
 * - groups are separated by record boundaries; a group = consecutive
 *   User-agent lines followed by member lines (allow/disallow/crawl-delay)
 * - matching uses longest-prefix wins, '*' wildcard, '$' end anchor
 * - for equal-length allow/disallow matches, allow wins (least restrictive)
 */
export function parseRobots(raw: string): { groups: RobotGroup[]; sitemaps: string[] } {
  const groups: RobotGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotGroup | null = null;
  let seenMemberLine = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    // Strip comments and trim.
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) {
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) {
      continue;
    }
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      // A new UA line after member lines starts a new group.
      if (current === null || seenMemberLine) {
        current = { agents: [], rules: [] };
        groups.push(current);
        seenMemberLine = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (field === 'allow' || field === 'disallow') {
      if (current) {
        current.rules.push({ type: field, path: value });
        seenMemberLine = true;
      }
    } else if (field === 'crawl-delay') {
      if (current) {
        const n = Number(value);
        if (Number.isFinite(n)) {
          current.crawlDelay = n;
        }
        seenMemberLine = true;
      }
    } else if (field === 'sitemap') {
      if (value) {
        sitemaps.push(value);
      }
    }
  }
  return { groups, sitemaps };
}

/**
 * Pick the group whose agent token most specifically matches `token`.
 * Longest matching prefix wins; '*' matches anything. Returns undefined
 * when no group matches.
 */
export function matchGroup(groups: RobotGroup[], token: string): RobotGroup | undefined {
  const t = token.toLowerCase();
  let best: RobotGroup | undefined;
  let bestLen = -1;
  for (const g of groups) {
    for (const agent of g.agents) {
      if (agent === '*') {
        if (bestLen < 0) {
          best = g;
          bestLen = 0;
        }
        continue;
      }
      if (t.startsWith(agent) && agent.length > bestLen) {
        best = g;
        bestLen = agent.length;
      }
    }
  }
  return best;
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern === '') {
    return false;
  }
  const anchored = pattern.endsWith('$');
  const pat = anchored ? pattern.slice(0, -1) : pattern;
  // Escape regex chars except '*', then translate '*' → '.*'
  const body = pat
    .split('*')
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${body}${anchored ? '$' : ''}`);
  return regex.test(path);
}

/**
 * Decide whether `token` may fetch `path` under these groups.
 * Longest path match wins; allow beats disallow on ties. When no group
 * matches, everything is allowed.
 */
export function isAllowed(
  groups: RobotGroup[],
  token: string,
  path: string,
): { allowed: boolean; matchedRule: { type: 'allow' | 'disallow'; path: string } | null } {
  const group = matchGroup(groups, token);
  if (!group) {
    return { allowed: true, matchedRule: null };
  }
  let best: { type: 'allow' | 'disallow'; path: string } | null = null;
  for (const rule of group.rules) {
    if (rule.path === '' && rule.type === 'disallow') {
      continue; // empty disallow = allow all, not a match
    }
    if (pathMatches(rule.path, path)) {
      if (
        !best ||
        rule.path.length > best.path.length ||
        (rule.path.length === best.path.length && rule.type === 'allow')
      ) {
        best = rule;
      }
    }
  }
  if (!best) {
    return { allowed: true, matchedRule: null };
  }
  return { allowed: best.type === 'allow', matchedRule: best };
}

/** Convenience: is `token` blocked from the entire site root ('/')? */
export function blocksRoot(groups: RobotGroup[], token: string): boolean {
  return !isAllowed(groups, token, '/').allowed;
}

export async function fetchRobots(
  origin: string,
  options: ResolvedScanOptions,
  fetchImpl?: (url: string, options: ResolvedScanOptions) => Promise<PageData>,
): Promise<RobotsData> {
  const url = `${origin}/robots.txt`;
  const doFetch = fetchImpl ?? fetchPage;
  try {
    const page = await doFetch(url, options);
    if (page.status >= 200 && page.status < 300) {
      const { groups, sitemaps } = parseRobots(page.html);
      return { url, status: page.status, raw: page.html, groups, sitemaps };
    }
    // 4xx = no robots.txt = everything allowed. 5xx/others = unknown.
    return { url, status: page.status, raw: null, groups: [], sitemaps: [] };
  } catch {
    return { url, status: 0, raw: null, groups: [], sitemaps: [] };
  }
}
