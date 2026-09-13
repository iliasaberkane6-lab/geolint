import type { PageData, ResolvedScanOptions } from './types.js';
import { TOOL_NAME, VERSION } from './types.js';

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export const DEFAULT_UA = `Mozilla/5.0 (compatible; ${TOOL_NAME}/${VERSION}; +https://github.com/iliasaberkane/geolint)`;

/** Pattern used by rules when they simulate an AI crawler fetching the page. */
export function botUa(token: string): string {
  return `Mozilla/5.0 (compatible; ${token}/1.0; +https://example.com/bot)`;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/**
 * Fetch a URL and return a normalized PageData. Throws FetchError on network
 * errors and timeouts; non-2xx statuses still resolve (the page exists, it
 * just has a bad status — that's a finding, not an exception).
 */
export async function fetchPage(url: string, options: ResolvedScanOptions): Promise<PageData> {
  const start = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeout),
      headers: {
        'user-agent': options.userAgent || DEFAULT_UA,
        accept:
          'text/html,application/xhtml+xml,application/xml,text/plain,text/markdown;q=0.9,*/*;q=0.5',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
  } catch (err) {
    throw new FetchError(err instanceof Error ? err.message : 'fetch failed', url, err);
  }
  const timingMs = Math.round(performance.now() - start);
  const contentType = res.headers.get('content-type') ?? '';
  const html = await res.text();
  return {
    url,
    finalUrl: res.url || url,
    status: res.status,
    headers: headersToRecord(res.headers),
    html,
    timingMs,
    redirected: res.redirected || (res.url !== undefined && res.url !== url),
    contentType,
  };
}
