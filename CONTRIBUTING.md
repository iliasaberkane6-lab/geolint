# Contributing to geolint

Thanks for helping make the web more readable for AI search engines!
This guide covers local development, project layout and how to extend the
auditor. For bugs and features, please use the
[issue templates](https://github.com/iliasabk/geolint/issues/new/choose).

## Development setup

Requirements: **Node.js >= 22** and npm.

```bash
git clone https://github.com/iliasabk/geolint.git
cd geolint
npm install

# Type-check + rebuild on change while you work:
npm run dev

# Run the CLI straight from source:
npm run geolint -- check https://example.com

# Or build once and run dist/:
npm run build
node dist/cli.js check https://example.com
```

### Everyday commands

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm test`          | Run the vitest suite once                |
| `npm run test:watch`| Re-run tests on change                   |
| `npm run lint:ci`   | Biome check (what CI runs; no autofix)   |
| `npm run lint`      | Biome check with `--write` autofix       |
| `npm run typecheck` | `tsc --noEmit`                           |
| `npm run build`     | tsup bundle to `dist/`                   |

CI runs `lint:ci` → `typecheck` → `test` → `build` → a CLI smoke test on Node
22 and 24, so all four must pass locally before a PR is mergeable.

## Project layout

```
src/
  cli.ts              entry point — wires commander, calls registerCommands()
  commands/           one file per command: check, crawl, init, diff, rules, bots
  core/               scan engine, fetch, robots.txt + llms.txt parsers,
                      JSON-LD/schema helpers, scoring (score + grade)
  rules/              audit rules, grouped by category directory:
                      ai-crawler/ llms-txt/ schema/ content/ technical/
  reporters/          pretty, json, sarif, markdown renderers
  utils/              shared helpers (colors…)
test/                 vitest specs mirroring src/ (test/rules/, …)
docs/                 rules.md (rule catalogue), github-action.md (CI usage)
action.yml            the composite GitHub Action (runs `npx @iliasabk/geolint`)
```

Type contracts (`ScanReport`, `Rule`, `Finding`, `Grade`…) live in
`src/core/types.ts` — read that file first.

## Adding a rule

1. **Copy the template.** `src/rules/technical/https.ts` is the canonical
   pattern: an `id` of `<category>/<kebab-name>`, a `check(ctx)` that returns
   `[]` when the rule passes, and findings with `severity`, `message`,
   `detail`, `fix` and (when useful) `evidence`.
2. **Handle the unreachable case.** `ctx.page` is `null` when the fetch failed
   — return `[]` (or a dedicated finding) instead of throwing.
3. **Use the context, don't refetch blindly.** `ctx` already carries the page,
   parsed `robots`, `llmsTxt`, a cheerio handle `$` and a rate-limited
   `ctx.fetchPage(url)` for same-origin extras (sitemap, llms-full.txt).
4. **Register it.** Import and add the rule to `allRules` in
   `src/rules/index.ts`. Keep ids unique and category-prefixed.
5. **Test it.** Add a spec under `test/rules/` (see `test/helpers.ts` for
   building a fake `RuleContext`). Cover: passes → `[]`, fails → finding with
   `fix`, `page === null` → no crash.
6. **Document it.** Regenerate the public rule catalogue with
   `npx tsx scripts/gen-rules-docs.ts` — `docs/rules.md` is generated, never
   edit it by hand. The full guide: `docs/writing-rules.md`.

Rule severity cheat-sheet: `error` hurts the score the most (something is
broken or blocked), `warn` is a real but softer problem, `info` is advisory.

## Adding a command

1. Create `src/commands/<name>.ts` exporting a registration function.
2. Wire it in `src/commands/index.ts` inside `registerCommands()` — `cli.ts`
   calls that exactly once; keep the signature stable.
3. Reuse `scan()` / `createScanner()` from `src/core/engine.ts` (or
   `crawlPages()` from `src/commands/crawl.ts`) and render through
   `src/reporters/index.ts` so `--format` behaves consistently.
4. Respect the shared exit-code contract: `0` pass, `1` gate/baseline failure,
   `2` runtime error.

## Adding a reporter

1. Create `src/reporters/<name>.ts` rendering `ScanReport` (and `SiteReport`
   where applicable) to a string.
2. Register the format in `REPORT_FORMATS` and the `renderReport` /
   `renderSiteReport` switches in `src/reporters/index.ts`.
3. Every reporter must be deterministic (no timestamps beyond
   `report.scannedAt`) — SARIF and JSON are diffed in CI.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/), e.g.:

```
feat(rules): add schema/faqpage rule
fix(crawl): respect robots.txt per-page
docs: document --save-baseline
```

Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`,
`ci`. Scope is optional but encouraged (`rules`, `cli`, `reporters`, `action`…).

## Pull request process

1. Open an issue first for anything bigger than a typo — it saves everyone time.
2. Branch from `main`, keep PRs focused (one rule/feature per PR is ideal).
3. Fill in the PR template checklist; CI must be green on both Node versions.
4. A maintainer reviews, may request changes, then squash-merges.

## Release process (maintainers)

1. Bump `version` in `package.json` and `VERSION` in `src/core/types.ts`
   (they are kept in sync manually), and update `CHANGELOG.md`.
2. Tag the release: `git tag v1.2.3 && git push origin v1.2.3`.
3. The [release workflow](.github/workflows/release.yml) runs tests, builds,
   publishes to npm with `--provenance` and creates the GitHub release.
4. Float the major tag so the action stays current:
   `git tag -f v1 v1.2.3 && git push -f origin v1`.

## Code of conduct

Be kind and constructive. Assume good intent; disagree on ideas, not people.
Maintainers may remove comments or contributors who don't.
