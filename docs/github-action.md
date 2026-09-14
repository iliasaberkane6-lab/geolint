# Using geolint in GitHub Actions

geolint ships a [composite action](../action.yml) that audits a URL for
AI-search readiness on every push or pull request: GEO score + grade as step
outputs, a SARIF report for code scanning, and a markdown report for job
summaries and PR comments.

The action runs the published npm package via `npx @iliasabk/geolint@<version>` — it does
not need a checkout of this repository, and it does not build from source.

## Quick start

```yaml
# .github/workflows/geolint.yml
name: geolint

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write   # SARIF upload to code scanning
  pull-requests: write     # PR comment (remove if you skip that step)

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # geolint needs Node >= 22. The runner's default node usually works,
      # but pin it explicitly so the audit never depends on runner images.
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Audit AI-search readiness
        id: geolint
        uses: iliasaberkane6-lab/geolint@v1
        with:
          url: https://example.com
          fail-under: 60

      - name: Upload SARIF to code scanning
        if: always() # keep findings even when the score gate fails
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ${{ steps.geolint.outputs.sarif-file }}

      - name: Comment the report on the PR
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const file = '${{ steps.geolint.outputs.markdown-file }}';
            const body = fs.existsSync(file)
              ? fs.readFileSync(file, 'utf8')
              : 'geolint did not produce a report — see the step log.';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## geolint — AI-search readiness\n\n${body}`,
            });
```

The audit itself appears in the job log and, when `format` is `markdown`
(the default), as a rendered job summary on the workflow run page.

> **Permissions note:** `pull-requests: write` is only needed for the PR-comment
> step, and `security-events: write` only for the SARIF upload. Drop either one
> if you remove the matching step. On PRs from forks, `GITHUB_TOKEN` is
> read-only — the comment step will fail there; gate it with
> `github.event.pull_request.head.repo.fork == false` if that matters.

## Inputs

| Input           | Default        | Description |
| --------------- | -------------- | ----------- |
| `url`           | *(required)*   | URL to audit. |
| `format`        | `markdown`     | Report format written to `markdown-file`: `pretty`, `json`, `sarif` or `markdown`. |
| `fail-under`    | `0`            | Fail the step when the GEO score is below this value (0–100). `0` disables the gate. |
| `crawl`         | `false`        | `true` runs `geolint crawl` (multi-page) instead of `geolint check`. |
| `max-pages`     | `25`           | Maximum pages audited when `crawl` is enabled. |
| `sarif-file`    | `geolint.sarif`| Path of the generated SARIF report. |
| `markdown-file` | `geolint.md`   | Path of the generated report in `format`. |
| `version`       | `latest`       | geolint version or dist-tag run via `npx` (e.g. `0.1.0`). |
| `timeout`       | `15000`        | Per-request fetch timeout in ms (`check` only). |

## Outputs

| Output          | Description |
| --------------- | ----------- |
| `score`         | GEO score, 0–100. Empty when no report was produced. |
| `grade`         | GEO grade: `A`, `B`, `C`, `D` or `F`. |
| `sarif-file`    | Path to the SARIF report. |
| `markdown-file` | Path to the report in the requested `format`. |

Example — gate a deployment on the score:

```yaml
- uses: iliasaberkane6-lab/geolint@v1
  id: geolint
  with:
    url: https://example.com

- run: echo "Scored ${{ steps.geolint.outputs.score }} (${{ steps.geolint.outputs.grade }})"
```

## SARIF → code scanning

The action always writes a SARIF report. Upload it with
`github/codeql-action/upload-sarif` and findings show up on the PR's
**Checks** tab and under **Security → Code scanning**:

```yaml
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: ${{ steps.geolint.outputs.sarif-file }}
```

<!-- TODO(maintainer): add a screenshot of a geolint finding in the code
     scanning UI once the first repo has real results, e.g.
     ![geolint code scanning findings](../media/code-scanning.png) -->

`if: always()` matters: when `fail-under` fails the audit step, the SARIF file
still exists and the upload step must not be skipped.

## PR comment recipe

The full workflow above posts `markdown-file` as a new comment on every run.
For a quieter PR, update one comment instead of creating many:

```yaml
- uses: actions/github-script@v7
  if: always() && github.event_name == 'pull_request'
  with:
    script: |
      const fs = require('fs');
      const marker = '<!-- geolint-report -->';
      const file = '${{ steps.geolint.outputs.markdown-file }}';
      const report = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '_no report_';
      const body = `${marker}\n## geolint — AI-search readiness\n\n${report}`;

      const { data: comments } = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
      });
      const existing = comments.find(
        (c) => c.user.login === 'github-actions[bot]' && c.body.includes(marker),
      );
      if (existing) {
        await github.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existing.id,
          body,
        });
      } else {
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body,
        });
      }
```

## Baseline drift recipe

`fail-under` enforces an absolute floor. To catch *regressions* instead, keep a
committed baseline and let `--baseline` fail the job when a rule that used to
pass starts failing (or the score drops).

The composite action deliberately does not commit files, so run the CLI
directly for the baseline workflow:

```yaml
# Run on main — refresh the committed baseline.
- run: npx -y @iliasabk/geolint@latest check https://example.com --save-baseline .geolint-baseline.json
- run: |
    git config user.name "geolint-bot"
    git config user.email "bot@users.noreply.github.com"
    git add .geolint-baseline.json
    git commit -m "chore: refresh geolint baseline" || echo "baseline unchanged"
    git push
```

```yaml
# Run on PRs — fail on drift.
- run: npx -y @iliasabk/geolint@latest check https://example.com --baseline .geolint-baseline.json
```

`--baseline` exits `1` when findings regress against the committed file, so no
extra scripting is needed. Combining `--baseline` with `--fail-under` gives you
both a floor and drift detection.

## Pinning advice

- `uses: iliasaberkane6-lab/geolint@v1` tracks the latest `v1.x` release — the
  maintainer floats the `v1` tag on every release. Recommended for most users.
- For maximum supply-chain safety, pin the full commit SHA:
  `uses: iliasaberkane6-lab/geolint@<sha> # v1.0.0`
- The `version` input pins the *CLI* version independently of the action
  version (`version: 0.1.0`). Pinning the action SHA but leaving
  `version: latest` still executes the newest published CLI — set both for a
  fully reproducible audit.

## Notes & limitations

- The action is **composite** (shell steps only), which keeps it portable but
  means it cannot call other actions internally — SARIF upload and PR comments
  live in your workflow, as shown above.
- Each run performs up to three audits (JSON for outputs, SARIF and markdown
  for artifacts). For heavy sites prefer `check` over `crawl`, or raise
  `timeout`.
- The audited site must be reachable from the runner — for private staging
  environments use a self-hosted runner inside the network or an allowlisted
  tunnel.
