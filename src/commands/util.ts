import { writeFile } from 'node:fs/promises';
import { InvalidArgumentError } from 'commander';

/** Progress/status output always goes to stderr — stdout stays machine-clean. */
export const stderrStatus = (msg: string): void => {
  console.error(msg);
};

/** Drop status messages entirely (tests, non-pretty formats). */
export const noopStatus = (): void => {};

/**
 * Normalize a user-supplied URL: prepend https:// when the scheme is missing,
 * parse it, and reject anything that is not http(s). Accepts 'host:port' as
 * a bare hostname (a real URI scheme never starts with a digit).
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('URL is empty');
  }
  const isLocalHost = (host: string): boolean =>
    /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|.*\.localhost$|.*\.test$|.*\.local$)/i.test(host);
  let candidate = trimmed;
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) {
    candidate = `${isLocalHost(trimmed) ? 'http' : 'https'}://${trimmed}`;
  } else if (!trimmed.slice(schemeMatch[0].length).startsWith('//')) {
    const rest = trimmed.slice(schemeMatch[0].length);
    if (/^\d/.test(rest)) {
      // 'localhost:3000' style — a host:port, not a scheme.
      candidate = `${isLocalHost(trimmed.split(':')[0]!) ? 'http' : 'https'}://${trimmed}`;
    } else {
      throw new Error(
        `unsupported URL scheme "${schemeMatch[1]}:" — use http(s) or a bare hostname`,
      );
    }
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`invalid URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `unsupported URL scheme "${url.protocol}" — only http and https can be scanned`,
    );
  }
  return url.toString();
}

/**
 * Shared worker-pool: `concurrency` workers pull items off the front of
 * `queue` until it is drained. Workers may push more items onto the queue
 * (BFS-style); a lane only exits once the queue is empty AND no worker is
 * still busy — otherwise it would miss items enqueued after it went idle.
 */
export async function runPool<T>(
  queue: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let active = 0;
  const sleep = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
  const lanes = Array.from({ length: Math.max(1, Math.floor(concurrency)) }, async () => {
    for (;;) {
      if (next >= queue.length) {
        if (active === 0) {
          return;
        }
        await sleep();
        continue;
      }
      const item = queue[next++]!;
      active++;
      try {
        await worker(item);
      } finally {
        active--;
      }
    }
  });
  await Promise.all(lanes);
}

/** Machine output: written to `file` when set, stdout otherwise. */
export async function writeOutput(output: string, file?: string): Promise<void> {
  const text = output.endsWith('\n') ? output : `${output}\n`;
  if (file) {
    await writeFile(file, text, 'utf8');
    return;
  }
  process.stdout.write(text);
}

/** commander argParser: a positive integer (page counts, timeouts, depth…). */
export function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError(`expected a positive integer, got "${value}"`);
  }
  return n;
}

/** commander argParser: a 0–100 score threshold. */
export function parseScore(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new InvalidArgumentError(`expected a score between 0 and 100, got "${value}"`);
  }
  return n;
}

/** Plain-text table: padded columns with a unicode separator under the header. */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
  const row = (cells: string[]): string =>
    cells
      .map((cell, i) => cell.padEnd(widths[i] ?? cell.length))
      .join('  ')
      .trimEnd();
  const sep = widths.map((w) => '─'.repeat(w));
  return [row(headers), row(sep), ...rows.map(row)].join('\n');
}

/** Stable identity used to match findings across reports and baselines. */
export function findingKey(f: { ruleId: string; message: string }): string {
  return `${f.ruleId} :: ${f.message}`;
}
