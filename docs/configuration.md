# geolint CLI reference

Complete reference for every command, flag and exit code. Everything here is
verified against the `geolint --help` output of the published CLI.

```text
Usage: geolint [options] [command]

Commands:
  check [options] <url>       Audit a single URL for AI search readiness
  crawl [options] <url>       Crawl same-origin pages and audit the whole site
  init [options] <url>        Generate a llms.txt for the site from its crawled pages
  diff <old.json> <new.json>  Compare two geolint JSON reports
  rules [options]             List the audit rules in the registry
  bots [options]              List known AI crawlers and the impact of blocking each one
  help [command]              display help for command
```

Global options: `-V, --version` prints the version, `-h, --help` works on every
command (`geolint check --help`).

## URL handling

Every command that takes `<url>` accepts:

- a full URL — `https://example.com/path`
- a bare hostname — `example.com` → `https://example.com/`
- a `host:port` pair — `example.com:8443` → `https://example.com:8443/`

Localhost-style hosts default to **http**, not https: `localhost`, `127.*`,
`0.0.0.0`, `::1`, `*.localhost`, `*.test`, `*.local`. So
`geolint check localhost:4173` scans `http://localhost:4173/` — convenient for
staging and the bundled demo site. Non-http(s) schemes are rejected.

geolint fetches with its own UA
(`Mozilla/5.0 (compatible; geolint/<version>; +https://github.com/iliasaberkane/geolint)`),
follows redirects, and reports the final URL. Each scan may perform a bounded
number of auxiliary same-origin fetches (robots.txt, llms.txt, sitemap,
llms-full.txt) — capped at 10.

## `geolint check <url>`

Audit a single URL. This is the command you'll use 95% of the time.

| Option | Description |
| --- | --- |
| `-f, --format <format>` | `pretty` (default), `json`, `sarif` or `markdown` |
| `-o, --output <file>` | Write the report to a file instead of stdout |
| `--fail-under <0-100>` | Exit `1` when the overall score is below this threshold |
| `--only <ids...>` | Run only these rule ids (space-separated, variadic) |
| `--ignore <ids...>` | Skip these rule ids |
| `--category <cats...>` | Run only these categories: `ai-crawler`, `llms-txt`, `schema`, `content`, `technical` |
| `--timeout <ms>` | Per-request fetch timeout in ms (default: `15000`) |
| `--user-agent <ua>` | Custom `User-Agent` header for fetching |
| `--compare <url2>` | Also scan this URL and render a side-by-side comparison |
| `--save-baseline <file>` | Write a findings baseline JSON to this file |
| `--baseline <file>` | Exit `1` on findings that are new since this baseline |
| `--verbose` | Include `info`-severity findings in the output (they're counted in the summary either way) |
| `--no-color` | Disable colored output |

`--only`, `--ignore` and `--category` are *scanning* options — they filter which
of the 45 rules run, so the score and the "checks passed" count reflect only
what ran. Rule ids are kebab-case and category-prefixed; list them with
`geolint rules` or see [rules.md](rules.md).

Progress and status messages always go to **stderr** — stdout stays clean for
redirecting or piping the report itself.

### Examples

```bash
# The 30-second audit
npx geolint check yoursite.com

# CI score gate — exit 1 below 80
npx geolint check https://example.com --fail-under 80

# JSON report for artifacts or `geolint diff`
npx geolint check https://example.com -f json -o geolint-report.json

# Only the AI-crawler and llms.txt categories
npx geolint check https://example.com --category ai-crawler llms-txt

# One rule only
npx geolint check https://example.com --only ai-crawler/search-bots-blocked

# Skip a rule that's irrelevant for your stack (e.g. http-only staging)
npx geolint check http://staging.internal --ignore technical/https

# Head-to-head against a competitor page
npx geolint check a.com --compare b.com

# Impersonate a crawler to test UA-gated responses
npx geolint check https://example.com --user-agent "Mozilla/5.0 (compatible; GPTBot/1.0)"
```

### Compare mode

`--compare <url2>` scans both URLs with the same rule set and renders a metric
table — overall score, grade, per-category scores, finding counts, bots allowed
— with a `Δ (B − A)` column and a winner line. The comparison renderer replaces
the normal report; combine with `--ignore`/`--category` to scope it.

### Baseline workflow

`--fail-under` enforces an absolute floor. Baselines catch *drift* instead:

```bash
# On main (or before a refactor): commit a baseline of current findings
npx geolint check https://example.com --save-baseline .geolint-baseline.json

# On PRs: exit 1 when a rule that used to pass now fails
npx geolint check https://example.com --baseline .geolint-baseline.json
```

`--baseline` prints each regression and resolution to stderr
(`regression [rule-id] …` / `resolved [rule-id] …`) and exits `1` if any finding
is new. Combine both flags for a floor *and* drift detection.

## `geolint crawl <url>`

BFS-crawl same-origin links from the entry page and audit the site as a whole.
Respects robots.txt disallows while crawling, skips off-origin links and binary
assets. The entry page gets the full 45-rule audit; the site report aggregates
per-page findings (multi-page findings are marked `×N pages`).

| Option | Description |
| --- | --- |
| `--max-pages <n>` | Maximum pages to crawl (default: `25`) |
| `--max-depth <n>` | Maximum link depth from the entry page (default: `3`) |
| `--concurrency <n>` | Parallel fetches (default: `4`) |
| `-f, --format <format>` | `pretty` (default), `json`, `sarif` or `markdown` |
| `-o, --output <file>` | Write the site report to a file instead of stdout |
| `--fail-under <0-100>` | Exit `1` when the site score is below this threshold |
| `--timeout <ms>` | Per-request fetch timeout in ms |
| `--verbose` | Log each fetched/scanned page to stderr |
| `--no-color` | Disable colored output |

Note: `--verbose` means something different on `check` (show info-severity
findings) and `crawl` (log progress per page).

```bash
npx geolint crawl https://example.com --max-pages 50 --fail-under 75
```

## `geolint init <url>`

Crawl the site (same-origin links, `--max-pages`, default 30) and generate a
spec-shaped `llms.txt`: H1 from the site, a blockquote summary, `##` sections
per page with absolute links. Prints to stdout unless `-o` is given.

| Option | Description |
| --- | --- |
| `-o, --output <file>` | Write llms.txt to a file instead of stdout |
| `--max-pages <n>` | Maximum pages to crawl (default: `30`) |
| `--timeout <ms>` | Per-request fetch timeout in ms |

```bash
npx geolint init https://example.com -o public/llms.txt
```

The generated file is a starting point — review the section titles and prune
pages that don't help a model answer questions before publishing.

## `geolint diff <old.json> <new.json>`

Compare two JSON reports produced by `check -f json -o …`. Prints the score
delta plus added and resolved findings, grouped by rule:

```bash
npx geolint check https://example.com -f json -o before.json
# … deploy changes …
npx geolint check https://example.com -f json -o after.json
npx geolint diff before.json after.json
```

No options. Use `--baseline` on `check` instead when you want a *gate* (exit
code) on regressions; `diff` is the human-readable version.

## `geolint rules`

Print the rule registry — all 45 rules with id, severity and title.

| Option | Description |
| --- | --- |
| `--category <cat>` | Only one category: `ai-crawler`, `llms-txt`, `schema`, `content`, `technical` |
| `--format <format>` | `table` (default), `json` or `markdown` |

```bash
npx geolint rules --category ai-crawler          # the 10 crawler-access rules
npx geolint rules --format markdown > rules.md   # docs-ready table
```

## `geolint bots`

Print the AI-bot registry: 51 tokens grouped by vendor with their purpose
(`training` / `search` / `user-fetch` / `mixed`) and the concrete impact of
blocking each one — "invisible in AI answers now" vs "absent from future
training data".

| Option | Description |
| --- | --- |
| `--format <format>` | `table` (default) or `json` (`token`, `company`, `purpose`, `impact` per bot) |

`bots` and `rules` read the bundled registry only — they make **no network
requests** and have no `--no-color` flag (colors auto-disable on non-TTY and
`NO_COLOR`).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. The audit ran — findings and errors *in the report* don't fail the command on their own. |
| `1` | A gate failed: score below `--fail-under`, or regressions against `--baseline`. Also used for usage errors (bad flag, missing argument). |
| `2` | Unexpected runtime error (e.g. invalid URL string, unreadable baseline file). |

A page that can't be fetched is **not** an exit-2 crash: the scan completes,
`technical/page-unreachable` reports an error finding, and the exit code is `0`
(unless a gate fails). That keeps CI informative instead of flaky.

## Environment variables

| Variable | Effect |
| --- | --- |
| `NO_COLOR` | Any value disables colored output (equivalent to `--no-color` on `check`/`crawl`). Wins over `FORCE_COLOR`. |
| `FORCE_COLOR` | `0` disables colors; any other value forces colors on, even when piped. |

Colors auto-disable when stdout isn't a TTY, so piped/CI output is clean
without any flags — and `FORCE_COLOR=1` is how you keep them in a CI log that
supports ANSI.

## npm scripts and non-GitHub CI

```jsonc
// package.json — audit staging on every build
{
  "scripts": {
    "audit:geo": "geolint check https://staging.example.com --fail-under 75",
    "audit:geo:report": "geolint check https://staging.example.com -f markdown -o geolint.md"
  }
}
```

```yaml
# .gitlab-ci.yml — same idea, any runner
geo-audit:
  image: node:22
  script:
    - npx -y geolint@latest check https://example.com --fail-under 80 -f markdown -o geolint.md
  artifacts:
    when: always
    paths: [geolint.md]
```

```yaml
# .circleci/config.yml
- run: npx -y geolint@latest check https://example.com --fail-under 80
```

On GitHub Actions prefer the composite action — it wires up SARIF upload,
job summaries and step outputs for you: [github-action.md](github-action.md).

## Programmatic API

The CLI is a thin wrapper over the library — everything above is available
from `import … from 'geolint'`:

```ts
import { scan } from 'geolint';

const report = await scan('https://example.com', {
  timeout: 10_000,                       // per-request ms (default 15000)
  userAgent: 'MyAuditor/1.0',            // default: geolint UA
  only: ['schema/no-jsonld'],            // run only these rules
  ignore: ['technical/https'],           // or skip these
  categories: ['ai-crawler', 'llms-txt'],// or restrict categories
  maxExtraFetches: 10,                   // auxiliary-fetch budget (default 10)
});
```

`scan()` takes a **fully-qualified URL** — the `localhost` → `http://`
convenience lives in the CLI layer, so pass `http://localhost:4173` explicitly.
It resolves a typed `ScanReport` (score, grade, per-category breakdown,
findings with fixes, the bot-access matrix). Parsers, scorers, reporters and
the rule/bot registries are exported too — see `src/index.ts` or the generated
`dist/index.d.ts` for the full surface.
