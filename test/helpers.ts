import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { load } from 'cheerio';
import { resolveOptions } from '../src/core/engine.js';
import { parseLlmsTxt } from '../src/core/llmstxt.js';
import { parseRobots } from '../src/core/robots.js';
import type { LlmsTxtData, PageData, RobotsData, RuleContext } from '../src/core/types.js';

export const DEFAULT_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Example Page</title>
  <meta name="description" content="An example page for tests.">
  <link rel="canonical" href="https://example.com/">
</head>
<body>
  <h1>Example heading</h1>
  <p>Some example body content that is long enough to count as real text on the page.</p>
</body>
</html>`;

/** Build a PageData with sane defaults; override any field. */
export function makePage(overrides: Partial<PageData> = {}): PageData {
  const html = overrides.html ?? DEFAULT_HTML;
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    html,
    timingMs: 42,
    redirected: false,
    contentType: 'text/html; charset=utf-8',
    ...overrides,
  };
}

/** Build RobotsData from a raw robots.txt body (null = 404, no file). */
export function makeRobots(raw: string | null): RobotsData {
  const { groups, sitemaps } = raw === null ? { groups: [], sitemaps: [] } : parseRobots(raw);
  return {
    url: 'https://example.com/robots.txt',
    status: raw === null ? 404 : 200,
    raw,
    groups,
    sitemaps,
  };
}

/** Build LlmsTxtData from a raw llms.txt body (null = 404). */
export function makeLlmsTxt(raw: string | null): LlmsTxtData {
  return {
    url: 'https://example.com/llms.txt',
    status: raw === null ? 404 : 200,
    raw,
    parsed: raw === null ? null : parseLlmsTxt(raw),
  };
}

/**
 * Build a RuleContext with sane defaults. Pass `page: null` explicitly to
 * simulate an unreachable target.
 */
export function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  const page = overrides.page === undefined ? makePage() : overrides.page;
  const base: RuleContext = {
    url: page?.url ?? 'https://example.com/',
    finalUrl: page?.finalUrl ?? 'https://example.com/',
    page,
    $: page ? load(page.html) : null,
    robots: makeRobots(null),
    llmsTxt: makeLlmsTxt(null),
    options: resolveOptions({}),
    fetchPage: async (u: string) => makePage({ url: u, finalUrl: u }),
  };
  return { ...base, ...overrides };
}

export interface FixtureRoute {
  /** Exact path ('/robots.txt') or RegExp tested against req.url. */
  path: string | RegExp;
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Spin up a local HTTP fixture server, run `fn(origin)` against it, and
 * always close the server afterwards. Routes are matched in order; a
 * request matching nothing gets a 404.
 */
export async function withFixtureServer(
  routes: FixtureRoute[],
  fn: (origin: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    const route = routes.find((r) =>
      typeof r.path === 'string' ? r.path === url : r.path.test(url),
    );
    if (!route) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(route.status ?? 200, { 'content-type': 'text/html', ...route.headers });
    res.end(route.body ?? '');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
