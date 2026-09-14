import { load } from 'cheerio';
import { createScanner, resolveOptions } from '../core/engine.js';
import { fetchPage } from '../core/fetch.js';
import { fetchRobots, isAllowed } from '../core/robots.js';
import { gradeFor } from '../core/score.js';
import { RULE_CATEGORIES, TOOL_NAME, VERSION } from '../core/types.js';
import type {
  CategoryScore,
  PageData,
  RobotGroup,
  RuleCategory,
  ScanOptions,
  ScanReport,
  SiteReport,
} from '../core/types.js';
import { type ReportFormat, renderSiteReport } from '../reporters/index.js';
import { noopStatus, normalizeUrl, runPool, stderrStatus } from './util.js';

/** Binary/asset URLs that are never worth crawling for a GEO audit. */
const ASSET_RE = /\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|css|js|xml|json|txt|woff2?|ttf)(\?|$)/i;

/**
 * Rule categories run on non-entry pages during a crawl. Site-level checks
 * (ai-crawler, llms-txt) run once — on the entry page, with the full rule set.
 */
export const PAGE_CATEGORIES: RuleCategory[] = ['schema', 'content', 'technical'];

/** Strip hash + trailing slash so '…/a/' and '…/a' dedupe to one page. */
function normalizePageUrl(url: URL): string {
  const u = new URL(url.toString());
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

/**
 * Normalize a raw href into an absolute, crawlable URL — or null when it is
 * not worth visiting: non-http scheme (mailto:, tel:, javascript:…),
 * off-origin, binary asset, or disallowed by robots.txt.
 */
export function normalizeLink(
  href: string,
  base: URL,
  origin: string,
  robotsGroups: RobotGroup[],
): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  if (/^(mailto|tel|javascript|data|blob):/i.test(trimmed)) {
    return null;
  }
  let u: URL;
  try {
    u = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return null;
  }
  if (u.origin !== origin) {
    return null;
  }
  const path = u.pathname + u.search;
  if (ASSET_RE.test(path)) {
    return null;
  }
  if (!isAllowed(robotsGroups, '*', path).allowed) {
    return null;
  }
  return normalizePageUrl(u);
}

/** Pull every crawlable same-origin link out of a fetched HTML page. */
export function extractLinks(
  html: string,
  base: URL,
  origin: string,
  robotsGroups: RobotGroup[],
): string[] {
  const $ = load(html);
  const links = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) {
      return;
    }
    const link = normalizeLink(href, base, origin, robotsGroups);
    if (link) {
      links.add(link);
    }
  });
  return [...links];
}

export interface CrawledPage {
  url: string;
  page: PageData | null;
}

export interface CrawlPagesOptions {
  /** Max pages to visit. Default 25. */
  maxPages?: number;
  /** Max link depth from the entry page. Default 3. */
  maxDepth?: number;
  /** Parallel fetches. Default 4. */
  concurrency?: number;
  timeout?: number;
  userAgent?: string;
  /** Progress hook fired after each page fetch (verbose mode). */
  onPage?: (page: CrawledPage, fetched: number) => void;
}

export interface CrawlPagesResult {
  /** Crawled pages in BFS order — the entry page is always first. */
  pages: CrawledPage[];
  /** URLs whose fetch failed. */
  failed: { url: string; reason: string }[];
}

/**
 * BFS-crawl a site: same-origin links only, depth- and page-capped, polite
 * (robots.txt disallow rules are skipped at enqueue time) and pooled by
 * `concurrency`. Returns fetched PageData — callers decide what to do with
 * the pages (rule scans for `crawl`, metadata extraction for `init`).
 */
export async function crawlPages(
  startUrl: string,
  opts: CrawlPagesOptions = {},
): Promise<CrawlPagesResult> {
  const maxPages = opts.maxPages ?? 25;
  const maxDepth = opts.maxDepth ?? 3;
  const concurrency = opts.concurrency ?? 4;
  const resolved = resolveOptions({ timeout: opts.timeout, userAgent: opts.userAgent });
  const start = new URL(normalizeUrl(startUrl));
  // The effective origin is re-based on the entry page's finalUrl once it is
  // fetched — a common apex↔www or http→https redirect would otherwise make
  // every resolved link look cross-origin and truncate the crawl to 1 page.
  let origin = start.origin;
  let robots = await fetchRobots(origin, resolved);

  interface Item {
    url: string;
    depth: number;
    seq: number;
  }
  const seen = new Set<string>([normalizePageUrl(start)]);
  const queue: Item[] = [{ url: normalizePageUrl(start), depth: 0, seq: 0 }];
  let seq = 1;
  const results: { seq: number; page: CrawledPage }[] = [];
  const failed: { url: string; reason: string }[] = [];

  await runPool(queue, concurrency, async ({ url, depth, seq: s }) => {
    let page: PageData | null = null;
    try {
      page = await fetchPage(url, resolved);
    } catch (err) {
      failed.push({ url, reason: err instanceof Error ? err.message : String(err) });
    }
    const crawled: CrawledPage = { url, page };
    results.push({ seq: s, page: crawled });
    opts.onPage?.(crawled, results.length);
    if (!page || depth >= maxDepth) {
      return;
    }
    try {
      const base = new URL(page.finalUrl || url);
      // Entry page (seq 0) processed first: adopt its post-redirect origin.
      if (s === 0 && base.origin !== origin) {
        origin = base.origin;
        seen.add(normalizePageUrl(base));
        robots = await fetchRobots(origin, resolved);
      }
      for (const link of extractLinks(page.html, base, origin, robots.groups)) {
        if (seen.size >= maxPages) {
          break;
        }
        if (seen.has(link)) {
          continue;
        }
        seen.add(link);
        queue.push({ url: link, depth: depth + 1, seq: seq++ });
      }
    } catch {
      // A page whose final URL cannot be parsed simply contributes no links.
    }
  });

  results.sort((a, b) => a.seq - b.seq);
  return { pages: results.map((r) => r.page), failed };
}

function emptyCategories(): Record<RuleCategory, CategoryScore> {
  const categories = {} as Record<RuleCategory, CategoryScore>;
  for (const cat of RULE_CATEGORIES) {
    categories[cat] = { score: 100, errors: 0, warnings: 0, infos: 0, rulesRun: [], passed: [] };
  }
  return categories;
}

/**
 * Assemble the aggregate SiteReport from per-page ScanReports: score is the
 * rounded mean page score, categories come from the entry page (which ran
 * the full rule set).
 */
export function buildSiteReport(url: string, pages: ScanReport[], startedAt: number): SiteReport {
  const score =
    pages.length === 0 ? 0 : Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length);
  return {
    tool: { name: TOOL_NAME, version: VERSION },
    url,
    scannedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    pages,
    findings: pages.flatMap((p) => p.findings),
    score,
    grade: gradeFor(score),
    categories: pages[0]?.categories ?? emptyCategories(),
    stats: {
      pagesScanned: pages.length,
      pagesFailed: pages.filter((p) => p.page === null).length,
    },
  };
}

export interface RunCrawlOptions extends CrawlPagesOptions {
  format?: ReportFormat;
  failUnder?: number;
  /** Rule selection applied to page scans (entry page runs the full set minus ignores). */
  only?: string[];
  ignore?: string[];
  category?: RuleCategory[];
  verbose?: boolean;
  color?: boolean;
  /** Status sink for progress lines. Defaults to stderr for pretty, silent otherwise. */
  status?: (msg: string) => void;
}

export interface RunCrawlResult {
  site: SiteReport;
  output: string;
  exitCode: 0 | 1;
}

/**
 * `geolint crawl` — BFS the site, then audit every page. The entry page runs
 * the full rule set; all other pages run PAGE_CATEGORIES through one shared
 * scanner (robots.txt/llms.txt are cached per origin).
 */
export async function runCrawl(input: string, opts: RunCrawlOptions = {}): Promise<RunCrawlResult> {
  const url = normalizeUrl(input);
  const format = opts.format ?? 'pretty';
  const status = opts.status ?? (format === 'pretty' ? stderrStatus : noopStatus);
  const maxPages = opts.maxPages ?? 25;
  const maxDepth = opts.maxDepth ?? 3;
  status(`Crawling ${url} (max ${maxPages} pages, depth ${maxDepth})…`);

  const startedAt = Date.now();
  const { pages } = await crawlPages(url, {
    maxPages,
    maxDepth,
    concurrency: opts.concurrency,
    timeout: opts.timeout,
    userAgent: opts.userAgent,
    onPage: opts.verbose ? (p) => status(`fetched ${p.url}`) : undefined,
  });

  const scanOpts: ScanOptions = {
    timeout: opts.timeout,
    userAgent: opts.userAgent,
    only: opts.only,
    ignore: opts.ignore,
    categories: opts.category,
  };
  const reports: (ScanReport | undefined)[] = new Array(pages.length);
  const entry = pages[0];
  // Reuse the crawled PageData — each page was already fetched once for link
  // extraction; scanning must not fetch it a second time.
  if (entry) {
    status(`Scanning ${entry.url} (entry page, full rules)…`);
    try {
      reports[0] = await createScanner(scanOpts).scanPage(entry.url, entry.page);
    } catch (err) {
      status(`entry scan failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const pageScanner = createScanner({
    ...scanOpts,
    categories: opts.category ?? PAGE_CATEGORIES,
  });
  const rest = pages.slice(1).map((p, i) => ({ url: p.url, idx: i + 1, page: p.page }));
  await runPool(rest, opts.concurrency ?? 4, async ({ url: u, idx, page }) => {
    try {
      reports[idx] = await pageScanner.scanPage(u, page);
      if (opts.verbose) {
        status(`scanned ${u}`);
      }
    } catch (err) {
      status(`scan failed for ${u}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  const pageReports = reports.filter((r): r is ScanReport => r !== undefined);
  const site = buildSiteReport(url, pageReports, startedAt);
  status(
    `Crawl complete: ${site.stats.pagesScanned} page(s), score ${site.score}/100 (${site.grade})`,
  );

  const output = renderSiteReport(site, format, { color: opts.color, verbose: opts.verbose });
  const exitCode = opts.failUnder !== undefined && site.score < opts.failUnder ? 1 : 0;
  return { site, output, exitCode };
}
