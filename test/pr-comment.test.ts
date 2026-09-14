import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/pr-comment.mjs', import.meta.url));
const execFileP = promisify(execFile);

interface RecordedRequest {
  method: string;
  url: string;
  body?: { body?: string };
}

type Respond = (req: RecordedRequest) => { status?: number; json?: unknown };

/** Mock of the GitHub REST API: records every request, answers via `respond`. */
async function withMockGitHub(
  respond: Respond,
  fn: (apiUrl: string, requests: RecordedRequest[]) => Promise<void>,
): Promise<void> {
  const requests: RecordedRequest[] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const record: RecordedRequest = {
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        body: raw ? JSON.parse(raw) : undefined,
      };
      requests.push(record);
      const { status = 200, json = {} } = respond(record);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = (server.address() as AddressInfo) ?? { port: 0 };
  try {
    await fn(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const workspaces: string[] = [];

/** Temp dir with a pull_request event payload and, optionally, a report file. */
function makeWorkspace(report: string | null): { eventPath: string; mdPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'geolint-pr-comment-'));
  workspaces.push(dir);
  const eventPath = join(dir, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 42 } }));
  const mdPath = join(dir, 'geolint.md');
  if (report !== null) writeFileSync(mdPath, report);
  return { eventPath, mdPath };
}

function baseEnv(apiUrl: string, ws: { eventPath: string; mdPath: string }) {
  return {
    GH_TOKEN: 'test-token',
    GEOLINT_COMMENT: 'true',
    GEOLINT_MD_FILE: ws.mdPath,
    GEOLINT_URL: 'https://example.com',
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_EVENT_PATH: ws.eventPath,
    GITHUB_REPOSITORY: 'octo/repo',
    GITHUB_API_URL: apiUrl,
    GITHUB_SERVER_URL: 'https://github.example',
    GITHUB_RUN_ID: '1234',
  };
}

function runScript(env: Record<string, string | undefined>) {
  // The script must always exit 0, so a rejection here means a real bug.
  return execFileP(process.execPath, [SCRIPT], {
    env: { PATH: process.env.PATH, ...env },
  });
}

afterEach(() => {
  while (workspaces.length) rmSync(workspaces.pop()!, { recursive: true, force: true });
});

describe('scripts/pr-comment.mjs', () => {
  it('posts a new comment when the PR has no marker comment yet', async () => {
    const ws = makeWorkspace('# geolint report\n\nAll good.');
    await withMockGitHub(
      (req) => (req.method === 'GET' ? { json: [] } : { json: { id: 1 } }),
      async (apiUrl, requests) => {
        const { stdout } = await runScript(baseEnv(apiUrl, ws));
        expect(stdout).toContain('::notice::');
        expect(requests.map((r) => r.method)).toEqual(['GET', 'POST']);
        expect(requests[0]!.url).toBe('/repos/octo/repo/issues/42/comments?per_page=100&page=1');
        expect(requests[1]!.url).toBe('/repos/octo/repo/issues/42/comments');
        const body = requests[1]!.body?.body ?? '';
        expect(body.startsWith('<!-- geolint-report -->')).toBe(true);
        expect(body).toContain('## geolint — AI-search audit');
        expect(body).toContain('https://example.com');
        expect(body).toContain('# geolint report');
      },
    );
  });

  it('patches the existing marker comment instead of posting a new one', async () => {
    const ws = makeWorkspace('updated report');
    const existing = [
      { id: 7, user: { login: 'github-actions[bot]' }, body: 'old\n<!-- geolint-report -->' },
      { id: 8, user: { login: 'human-user' }, body: 'unrelated' },
    ];
    await withMockGitHub(
      (req) => (req.method === 'GET' ? { json: existing } : { json: { id: 7 } }),
      async (apiUrl, requests) => {
        await runScript(baseEnv(apiUrl, ws));
        expect(requests.map((r) => r.method)).toEqual(['GET', 'PATCH']);
        expect(requests[1]!.url).toBe('/repos/octo/repo/issues/comments/7');
        expect(requests[1]!.body?.body).toContain('updated report');
      },
    );
  });

  it("does not treat another user's marker comment as ours", async () => {
    const ws = makeWorkspace('report');
    const foreign = [{ id: 9, user: { login: 'copycat' }, body: '<!-- geolint-report -->' }];
    await withMockGitHub(
      (req) => (req.method === 'GET' ? { json: foreign } : { json: { id: 10 } }),
      async (apiUrl, requests) => {
        await runScript(baseEnv(apiUrl, ws));
        expect(requests.map((r) => r.method)).toEqual(['GET', 'POST']);
      },
    );
  });

  it('comments a failure note when the report file is missing', async () => {
    const ws = makeWorkspace(null);
    await withMockGitHub(
      (req) => (req.method === 'GET' ? { json: [] } : { json: { id: 1 } }),
      async (apiUrl, requests) => {
        await runScript(baseEnv(apiUrl, ws));
        expect(requests[1]!.method).toBe('POST');
        expect(requests[1]!.body?.body).toContain('did not produce a report');
      },
    );
  });

  it('warns and still exits 0 when the API answers 403', async () => {
    const ws = makeWorkspace('report');
    await withMockGitHub(
      () => ({ status: 403, json: { message: 'Resource not accessible by integration' } }),
      async (apiUrl, requests) => {
        const { stdout } = await runScript(baseEnv(apiUrl, ws));
        expect(stdout).toContain('::warning::');
        expect(stdout).toContain('pull-requests: write');
        expect(requests.every((r) => r.method === 'GET')).toBe(true);
      },
    );
  });

  it('no-ops on non-pull_request events without touching the API', async () => {
    const ws = makeWorkspace('report');
    await withMockGitHub(
      () => ({ json: {} }),
      async (apiUrl, requests) => {
        const env = { ...baseEnv(apiUrl, ws), GITHUB_EVENT_NAME: 'push' };
        const { stdout } = await runScript(env);
        expect(stdout).toContain('::notice::');
        expect(requests).toEqual([]);
      },
    );
  });
});
