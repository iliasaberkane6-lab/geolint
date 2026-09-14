// Upserts the sticky geolint report comment on a pull request.
// Invoked by the composite action (action.yml, "Comment on PR" step) via
// `node "${{ github.action_path }}/scripts/pr-comment.mjs"` — plain Node 22,
// zero dependencies, talks to the REST API with global fetch.
//
// Env in:
//   GEOLINT_COMMENT    'true' to enable (mirrors the action input; the step
//                      `if` already gates, this is belt & braces)
//   GEOLINT_MD_FILE    path of the markdown report to post
//   GEOLINT_URL        audited URL, shown in the comment header
//   GH_TOKEN           token used for the API calls (usually github.token)
//   GITHUB_EVENT_NAME  must be 'pull_request', otherwise we no-op
//   GITHUB_EVENT_PATH  event payload JSON; pull_request.number is read from it
//   GITHUB_REPOSITORY  'owner/repo'
//   GITHUB_API_URL     REST base URL (default https://api.github.com)
//   GITHUB_SERVER_URL  used for the optional workflow-run link in the header
//   GITHUB_RUN_ID      same
//
// This script never fails the build: every comment error is demoted to a
// ::warning:: (403 gets a permissions hint) and the exit code stays 0.

import { existsSync, readFileSync } from 'node:fs';

const MARKER = '<!-- geolint-report -->';
const BOT_LOGIN = 'github-actions[bot]';
// GitHub rejects bodies over 65536 chars; stay under with a safety margin.
const MAX_BODY = 65_000;
const TRUNCATED_NOTE = '\n\n_…truncated — full report in the job summary._';
const MAX_COMMENT_PAGES = 10;

// Workflow-command messages must escape %, CR and LF.
const escapeCmd = (msg) => msg.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const notice = (msg) => console.log(`::notice::${escapeCmd(msg)}`);
const warning = (msg) => console.log(`::warning::${escapeCmd(msg)}`);

const env = process.env;
const API_URL = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');

/** Minimal REST helper: throws an Error carrying status + body on !ok. */
async function api(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'geolint-action',
      'x-github-api-version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** Number of the pull request that triggered this run, or null. */
function pullRequestNumber() {
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;
  try {
    const payload = JSON.parse(readFileSync(eventPath, 'utf8'));
    return payload?.pull_request?.number ?? payload?.issue?.number ?? payload?.number ?? null;
  } catch {
    return null;
  }
}

/** Comment body: hidden marker, a small header, then the report. */
function buildBody() {
  const url = env.GEOLINT_URL || '(unknown URL)';
  const when = new Date().toISOString();
  const server = (env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/+$/, '');
  const runLink =
    env.GITHUB_RUN_ID && env.GITHUB_REPOSITORY
      ? ` · [workflow run](${server}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID})`
      : '';

  const mdFile = env.GEOLINT_MD_FILE;
  const report =
    mdFile && existsSync(mdFile)
      ? readFileSync(mdFile, 'utf8').trim()
      : '_geolint did not produce a report — see the step log for details._';

  const header = `${MARKER}\n## geolint — AI-search audit\n\n**Audited:** ${url} — ${when}${runLink}\n\n`;
  let body = `${header}${report}`;
  if (body.length > MAX_BODY) {
    body = body.slice(0, MAX_BODY - TRUNCATED_NOTE.length) + TRUNCATED_NOTE;
  }
  return body;
}

/** Existing sticky comment by the Actions bot, walking comment pages. */
async function findMarkerComment(owner, repo, prNumber) {
  for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
    const comments = await api(
      'GET',
      `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
    );
    if (!Array.isArray(comments)) return null;
    const hit = comments.find(
      (c) => c.user?.login === BOT_LOGIN && typeof c.body === 'string' && c.body.includes(MARKER),
    );
    if (hit) return hit;
    if (comments.length < 100) return null;
  }
  return null;
}

async function main() {
  if (env.GITHUB_EVENT_NAME !== 'pull_request') {
    notice(
      `geolint: not a pull_request event (${env.GITHUB_EVENT_NAME || 'unset'}) — skipping PR comment.`,
    );
    return;
  }
  if (env.GEOLINT_COMMENT !== 'true') {
    notice('geolint: comment input is not enabled — skipping PR comment.');
    return;
  }
  if (!env.GH_TOKEN) {
    warning('geolint: GH_TOKEN is empty — cannot post the PR comment.');
    return;
  }
  const repoSlug = env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repoSlug.split('/');
  if (!owner || !repo) {
    warning(`geolint: GITHUB_REPOSITORY "${repoSlug}" is not "owner/repo" — skipping PR comment.`);
    return;
  }
  const prNumber = pullRequestNumber();
  if (!prNumber) {
    warning('geolint: could not read the PR number from the event payload — skipping PR comment.');
    return;
  }

  const body = buildBody();
  try {
    const existing = await findMarkerComment(owner, repo, prNumber);
    if (existing) {
      await api('PATCH', `/repos/${owner}/${repo}/issues/comments/${existing.id}`, { body });
      notice(`geolint: updated report comment on PR #${prNumber}.`);
    } else {
      await api('POST', `/repos/${owner}/${repo}/issues/${prNumber}/comments`, { body });
      notice(`geolint: posted report comment on PR #${prNumber}.`);
    }
  } catch (err) {
    if (err.status === 403) {
      warning(
        'geolint: PR comment was rejected (403). Grant the job `pull-requests: write` ' +
          'permission — on PRs from forks GITHUB_TOKEN is read-only and commenting is ' +
          'not possible.',
      );
    } else {
      warning(`geolint: PR comment failed: ${err.message}`);
    }
  }
}

main().catch((err) => {
  // Last-resort guard: a bug in this script must not fail the workflow.
  warning(`geolint: PR comment crashed: ${err?.message || err}`);
});
