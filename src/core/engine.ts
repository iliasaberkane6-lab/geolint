import { load } from 'cheerio';
import { allRules } from '../rules/index.js';
import { AI_BOTS } from './bots.js';
import { fetchPage } from './fetch.js';
import { DEFAULT_UA } from './fetch.js';
import { fetchLlmsTxt } from './llmstxt.js';
import { fetchRobots, isAllowed } from './robots.js';
import { computeScore } from './score.js';
import type {
  Finding,
  PageData,
  ResolvedScanOptions,
  Rule,
  RuleContext,
  ScanOptions,
  ScanReport,
} from './types.js';
import { TOOL_NAME, VERSION } from './types.js';

export function resolveOptions(options: ScanOptions = {}): ResolvedScanOptions {
  return {
    timeout: options.timeout ?? 15_000,
    userAgent: options.userAgent ?? DEFAULT_UA,
    only: options.only ?? [],
    ignore: options.ignore ?? [],
    categories: options.categories ?? null,
    maxExtraFetches: options.maxExtraFetches ?? 10,
  };
}

export function selectRules(options: ScanOptions, registry: Rule[] = allRules): Rule[] {
  let rules = registry;
  if (options.categories && options.categories.length > 0) {
    rules = rules.filter((r) => options.categories!.includes(r.category));
  }
  if (options.only && options.only.length > 0) {
    rules = rules.filter((r) => options.only!.includes(r.id));
  }
  if (options.ignore && options.ignore.length > 0) {
    rules = rules.filter((r) => !options.ignore!.includes(r.id));
  }
  return rules;
}

/**
 * A scanner caches origin-level data (robots.txt, llms.txt) so crawling
 * multiple pages on the same origin does not re-fetch them.
 */
export function createScanner(options: ScanOptions = {}) {
  const resolved = resolveOptions(options);
  let extraFetches = 0;
  const robotsCache = new Map<string, Awaited<ReturnType<typeof fetchRobots>>>();
  const llmsCache = new Map<string, Awaited<ReturnType<typeof fetchLlmsTxt>>>();

  const budgetedFetch = async (url: string): Promise<PageData> => {
    if (extraFetches >= resolved.maxExtraFetches) {
      throw new Error(`extra fetch budget exhausted (${resolved.maxExtraFetches})`);
    }
    extraFetches++;
    return fetchPage(url, resolved);
  };

  async function scanPage(url: string): Promise<ScanReport> {
    const startedAt = Date.now();
    let page: PageData | null = null;
    try {
      page = await fetchPage(url, resolved);
    } catch {
      page = null;
    }
    const origin = new URL(page?.finalUrl ?? url).origin;

    if (!robotsCache.has(origin)) {
      robotsCache.set(origin, await fetchRobots(origin, resolved));
    }
    if (!llmsCache.has(origin)) {
      llmsCache.set(origin, await fetchLlmsTxt(origin, resolved));
    }
    const robots = robotsCache.get(origin)!;
    const llmsTxt = llmsCache.get(origin)!;

    const ctx: RuleContext = {
      url,
      finalUrl: page?.finalUrl ?? url,
      page,
      $: page ? load(page.html) : null,
      robots,
      llmsTxt,
      options: resolved,
      fetchPage: budgetedFetch,
    };

    const rules = selectRules(options);
    const settled = await Promise.all(
      rules.map(async (rule) => {
        try {
          const found = await rule.check(ctx);
          return found.map((f): Finding => ({ ...f, ruleId: rule.id }));
        } catch (err) {
          return [
            {
              ruleId: rule.id,
              severity: 'info' as const,
              message: `rule failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ];
        }
      }),
    );
    const findings = settled.flat();
    const { score, grade, categories } = computeScore(rules, findings);

    const bots = robots.raw
      ? AI_BOTS.map((b) => ({
          id: b.id,
          name: b.name,
          company: b.company,
          purpose: b.purpose,
          allowed: isAllowed(robots.groups, b.id, '/').allowed,
        }))
      : [];

    return {
      tool: { name: TOOL_NAME, version: VERSION },
      url,
      finalUrl: page?.finalUrl ?? url,
      scannedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      page: page
        ? {
            status: page.status,
            contentType: page.contentType,
            timingMs: page.timingMs,
            redirected: page.redirected,
          }
        : null,
      robots: robots.raw
        ? {
            url: robots.url,
            status: robots.status,
            groupCount: robots.groups.length,
            sitemaps: robots.sitemaps,
          }
        : robots.status === 0
          ? null
          : { url: robots.url, status: robots.status, groupCount: 0, sitemaps: robots.sitemaps },
      llmsTxt:
        llmsTxt.status === 0
          ? null
          : {
              url: llmsTxt.url,
              status: llmsTxt.status,
              title: llmsTxt.parsed?.title ?? null,
              linkCount: llmsTxt.parsed?.linkCount ?? 0,
            },
      findings,
      score,
      grade,
      categories,
      bots,
    };
  }

  return { scanPage, resolved };
}

export async function scan(url: string, options: ScanOptions = {}): Promise<ScanReport> {
  return createScanner(options).scanPage(url);
}
