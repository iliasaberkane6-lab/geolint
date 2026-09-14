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
      // Ignore malformed 'User-agent:' lines (empty value, or nothing left
      // after stripping a version suffix like 'User-agent: /1.0').
      const agent = normalizeAgent(value);
      if (agent) {
        current.agents.push(agent);
      }
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
 * Normalize a User-agent value per RFC 9309 / Google's spec: version and
 * non-token suffixes are ignored — 'googlebot/1.2' and 'googlebot*' are
 * equivalent to 'googlebot'.
 */
function normalizeAgent(value: string): string {
  let v = value.toLowerCase().trim();
  if (v === '*') {
    return v;
  }
  v = v.replace(/\/[^\s]*$/, '');
  v = v.replace(/\*+$/, '');
  return v;
}

/**
 * All groups whose agent token matches `token` at the longest matching
 * prefix. RFC 9309 §2.2.1: when more than one group matches, their rules
 * are combined — so this returns every group tied at the best match
 * length ('*' matches at length 0).
 */
export function matchGroups(groups: RobotGroup[], token: string): RobotGroup[] {
  const t = token.toLowerCase();
  let bestLen = -1;
  const best: RobotGroup[] = [];
  for (const g of groups) {
    for (const agent of g.agents) {
      const len = agent === '*' ? 0 : t.startsWith(agent) ? agent.length : -1;
      if (len < 0 || len < bestLen) {
        continue;
      }
      if (len > bestLen) {
        bestLen = len;
        best.length = 0;
      }
      if (!best.includes(g)) {
        best.push(g);
      }
    }
  }
  return best;
}

/**
 * The single merged group RFC 9309 produces for `token`: rules of all
 * equally-specific matching groups combined, crawl-delay of the last one
 * that sets it. Returns undefined when no group matches.
 */
export function matchGroup(groups: RobotGroup[], token: string): RobotGroup | undefined {
  const matched = matchGroups(groups, token);
  if (matched.length === 0) {
    return undefined;
  }
  const merged: RobotGroup = { agents: [], rules: [] };
  for (const g of matched) {
    merged.agents.push(...g.agents);
    merged.rules.push(...g.rules);
    if (g.crawlDelay !== undefined) {
      merged.crawlDelay = g.crawlDelay;
    }
  }
  return merged;
}

/**
 * Decode percent-encoded octets that represent unreserved characters
 * (RFC 9309 §2.2.2 requires this before comparison). Reserved chars like
 * %2F stay encoded.
 */
const UNRESERVED_RE = /^[A-Za-z0-9\-._~]$/;
function decodePath(p: string): string {
  return p.replace(/%([0-9A-Fa-f]{2})/g, (m, hex) => {
    const ch = String.fromCharCode(Number.parseInt(hex, 16));
    return UNRESERVED_RE.test(ch) ? ch : m;
  });
}

/**
 * Wildcard path matcher without regex: segments split on '*' must appear
 * in order, the first must be a prefix, '$' anchors the last to the end.
 * Linear in path length — no backtracking on hostile patterns.
 */
function pathMatches(pattern: string, path: string): boolean {
  if (pattern === '') {
    return false;
  }
  const anchored = pattern.endsWith('$');
  const pat = decodePath(anchored ? pattern.slice(0, -1) : pattern);
  const target = decodePath(path);
  const parts = pat.split('*');
  if (parts.length === 1) {
    return anchored ? target === pat : target.startsWith(pat);
  }
  const first = parts[0] ?? '';
  if (first !== '' && !target.startsWith(first)) {
    return false;
  }
  let pos = first.length;
  // Middle segments (and the last when unanchored) must occur in order.
  const middle = anchored ? parts.slice(1, -1) : parts.slice(1);
  for (const part of middle) {
    if (part === '') {
      continue;
    }
    const idx = target.indexOf(part, pos);
    if (idx === -1) {
      return false;
    }
    pos = idx + part.length;
  }
  if (!anchored) {
    return true;
  }
  const last = parts[parts.length - 1] ?? '';
  // The trailing segment must end the path without overlapping consumed parts.
  return last === '' || (target.endsWith(last) && target.length - last.length >= pos);
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
