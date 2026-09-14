# geolint FAQ

Honest answers, including the uncomfortable ones. Everything here is backed by
the rule registry, the vendor documentation collected in
[research-notes.md](research-notes.md), or the source itself.

## Does blocking GPTBot hurt my rankings in ChatGPT?

**No — GPTBot is training-only.** Blocking it keeps your content out of the
corpus future models learn from, but it does not affect citations today.
That's why `ai-crawler/training-bots-blocked` is a *warning*, while blocking a
search or user-fetch bot is an *error*.

The OpenAI tokens that actually affect visibility now are different:

- **OAI-SearchBot** — indexes for ChatGPT search. Blocking it removes you from
  ChatGPT citations (OpenAI documents this).
- **ChatGPT-User** — fetches a page when a user asks ChatGPT about it. Blocking
  it removes you from those answers — and OpenAI says robots.txt rules "may not
  apply" to it anyway.

Run `geolint bots` to see the purpose and blocking impact of all 51 tokens —
"should I block X?" has a different answer per token, which is the whole point
of the registry.

## Does llms.txt actually get read by AI vendors?

**Nobody has committed to it.** llms.txt is a community proposal (llmstxt.org),
not a standard — no major AI vendor has promised to fetch or honor it. geolint
is deliberately honest about this: `llms-txt/*` findings are warnings and
hints, never errors, so a missing llms.txt can't tank your score.

Why bother at all? Adoption is real (Anthropic, Cloudflare, Vercel and Stripe
publish llms.txt/llms-full.txt), the cost is one static file, and *if* a vendor
starts honoring it you're already there. `geolint init <url>` generates one
from your crawled pages.

## Why did my score change between two runs of the same site?

Small drift is normal — the audit measures a live fetch:

- **`technical/slow-response`** is timing-sensitive: TTFB over ~800ms is an
  info finding, over ~2000ms a warning. A cold cache can cost you points that a
  warm run gets back.
- **Flaky fetches** — if robots.txt or the page times out, rules like
  `ai-crawler/robots-unreachable` or `technical/page-unreachable` fire and
  disappear again next run.
- **The site actually changed** — deployed markup, a new redirect, a CDN
  config edit. Run `geolint diff before.json after.json` on two saved JSON
  reports to see exactly which findings appeared or resolved.

For gating, prefer `--baseline` (fails only on *new* findings) or
`--fail-under` with a few points of slack instead of an exact score match.

## Can I audit localhost, staging or a private environment?

Yes. Localhost-family hosts (`localhost`, `127.*`, `0.0.0.0`, `::1`,
`*.localhost`, `*.test`, `*.local`) default to **http**, so
`geolint check localhost:4173` just works against a dev server.

For staging behind auth or a VPN: geolint has to reach the site over HTTP —
run it from a machine inside the network (self-hosted CI runner, your laptop
on the VPN). If the site is http-only, `--ignore technical/https` keeps that
rule out of the score. Try the bundled demo:
`python3 -m http.server 4173 --directory examples/demo-site` then
`geolint check localhost:4173 --ignore technical/https`.

## How do I get findings into GitHub code scanning?

Emit SARIF and upload it:

```bash
npx @iliasabk/geolint check https://example.com -f sarif -o geolint.sarif
```

```yaml
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: geolint.sarif
```

Findings appear on the PR's Checks tab and under Security → Code scanning,
each with its rule id and remediation. The
[GitHub Action](github-action.md) produces the SARIF file for you.

## How is the score computed?

Each of the five categories starts at **100** and loses points per finding:

| Severity | Per finding | Per-rule cap |
| --- | ---: | ---: |
| error | −15 | 30 |
| warn | −6 | 18 |
| info | −2 | 6 |

Caps keep one spammy rule (e.g. 40 images without alt text) from zeroing a
category. The overall score is the **mean of the categories that ran**, so
`--only`/`--category` rescope it cleanly. Grades: **A** ≥ 90, **B** ≥ 75,
**C** ≥ 60, **D** ≥ 40, **F** below 40.

The score is a prioritization device, not a prophecy — no score guarantees
citations. See "What geolint is honest about" in the README.

## Does geolint send my data anywhere?

No. There is **no telemetry, no analytics, no phone-home**. The only network
traffic is the HTTP(S) fetching needed to audit the site you pointed at — the
page, robots.txt, llms.txt, sitemap and llms-full.txt discovery (bounded at 10
auxiliary fetches per scan). The package has exactly two runtime dependencies
(`commander`, `cheerio`), so the supply-chain surface is auditable. Nothing
about your codebase is inspected — geolint audits the *published page*, like a
crawler would.

## `check` vs `crawl` — which should I use?

- **`check <url>`** audits one page — fast, page-level detail, supports
  `--only`/`--ignore`/`--category`, `--compare`, baselines and all scanning
  options. Use it in PR CI.
- **`crawl <url>`** BFS-follows same-origin links (respecting robots.txt
  disallows), audits each page, and aggregates into a site report with
  `×N pages` rollup findings. Use it for periodic audits or before launches.

Rule of thumb: `check` on every PR against a representative URL; `crawl` on a
schedule or on `main`.

## Why does geolint say my `Disallow` won't actually block that bot?

Because three vendors document that their **user-triggered fetchers** —
ChatGPT-User (OpenAI), Perplexity-User (Perplexity), Meta-ExternalFetcher
(Meta) — may not honor robots.txt. They act on behalf of a person asking a
question, so vendors treat them more like a browser than a crawler.

`ai-crawler/user-fetch-bypass` fires when one of those tokens is disallowed:
the robots.txt line gives you a false sense of control. If you genuinely need
to keep them out, enforce at the WAF/auth layer (IP ranges, signed requests) —
geolint's fix text says exactly that.

A related check, `ai-crawler/stale-tokens`, flags retired tokens
(`anthropic-ai`, `Claude-Web`, `FacebookBot`, `omgilibot`) — rules that do
nothing today — and names the current replacement token.

## Do AI crawlers execute JavaScript?

Mostly **no** — and this is one of the best-documented findings in the space
(Vercel + MERJ crawl analysis): GPTBot, ClaudeBot, PerplexityBot,
Meta-ExternalAgent and Bytespider were observed fetching raw HTML with zero JS
execution. Googlebot and Applebot are the exceptions.

That's why `technical/client-rendered` is an error: if your content only
appears after hydration, most AI crawlers see an empty shell. SSR, SSG or
prerendering isn't an optimization here — it's the entry ticket.

## What does a "hint" (info severity) mean?

Info findings are advisory signals, not defects: question-shaped headings,
data points, `llms-full.txt`, author attribution. They're grounded in GEO
research that shows *correlation* with AI citations — but correlation isn't
causation, and geolint scores them accordingly (−2 each, capped).

They're hidden from the pretty report unless you pass `--verbose` (they still
count in the summary), and always included in json/sarif/markdown output.
