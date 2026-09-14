# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-14

First public release of geolint — lint your website for AI-search readiness.

### Added

- **Commands**: `check` (single-page audit), `crawl` (multi-page site audit
  with `--max-pages`, `--max-depth`, `--concurrency`), `init` (generate
  `llms.txt`), `diff` (compare two reports), `rules` (list audit rules) and
  `bots` (show per-bot AI crawler access).
- **~37 audit rules** across five categories: AI crawler access, llms.txt,
  structured data, citability and technical foundation.
- **Reporters**: `pretty` (terminal), `json`, `sarif` (code scanning) and
  `markdown` (PR comments, job summaries) via `--format` / `--output`.
- **Score gate**: `--fail-under <0-100>` plus exit codes `0`/`1`/`2` for CI.
- **Baseline diffing**: `--save-baseline` / `--baseline` to catch regressions
  against a committed baseline.
- **GitHub Action**: composite `action.yml` (`iliasaberkane/geolint@v1`)
  producing score/grade outputs, a SARIF report and a job summary — see
  [docs/github-action.md](docs/github-action.md).
- Fetch layer with per-request timeout (`--timeout`), redirect handling and a
  bounded same-origin fetch budget for sitemap/llms-full.txt discovery.

[unreleased]: https://github.com/iliasaberkane/geolint/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/iliasaberkane/geolint/releases/tag/v0.1.0
