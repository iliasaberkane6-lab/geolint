# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-09-14

### Fixed

- `--version`, SARIF reports and MCP `serverInfo` reported a stale version:
  `VERSION` is now synced from `package.json` by the `npm version` lifecycle.

## [0.2.0] - 2026-09-14

### Added

- **MCP server**: `geolint mcp` runs a [Model Context
  Protocol](https://modelcontextprotocol.io) server over stdio so Claude
  Desktop, Cursor, VS Code and Windsurf can use geolint natively. Five
  read-only tools — `audit_url`, `generate_llms_txt`, `compare_urls`,
  `list_rules`, `list_ai_bots` — with structured output and per-call
  timeouts (see [docs/mcp.md](docs/mcp.md)). The SDK loads lazily, so
  `check`/`crawl` startup is unaffected.
- **Score badge**: `check --badge [file]` writes a self-contained,
  shields-style SVG badge and prints a paste-ready README snippet;
  `--badge-endpoint <file>` writes a shields.io endpoint JSON for
  CI-regenerated live badges (see [docs/badges.md](docs/badges.md)).
- Library exports: `badgeSvg`, `shieldsEndpointJson`, `badgeMarkdown`.

## [0.1.0] - 2026-09-14

First public release of geolint — lint your website for AI-search readiness.

### Added

- **Commands**: `check` (single-page audit), `crawl` (multi-page site audit
  with `--max-pages`, `--max-depth`, `--concurrency`), `init` (generate
  `llms.txt`), `diff` (compare two reports), `rules` (list audit rules) and
  `bots` (show per-bot AI crawler access).
- **45 audit rules** across five categories: AI crawler access, llms.txt,
  structured data, citability and technical foundation (see
  [docs/rules.md](docs/rules.md)).
- **Reporters**: `pretty` (terminal), `json`, `sarif` (code scanning) and
  `markdown` (PR comments, job summaries) via `--format` / `--output`.
- **Score gate**: `--fail-under <0-100>` plus exit codes `0`/`1`/`2` for CI.
- **Baseline diffing**: `--save-baseline` / `--baseline` to catch regressions
  against a committed baseline.
- **GitHub Action**: composite `action.yml` (`iliasabk/geolint@v1`)
  producing score/grade outputs, a SARIF report and a job summary — see
  [docs/github-action.md](docs/github-action.md).
- Fetch layer with per-request timeout (`--timeout`), redirect handling and a
  bounded same-origin fetch budget for sitemap/llms-full.txt discovery.

[unreleased]: https://github.com/iliasabk/geolint/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/iliasabk/geolint/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/iliasabk/geolint/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iliasabk/geolint/releases/tag/v0.1.0
