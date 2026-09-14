# How geolint compares

"AI-search readiness" tooling falls into four categories today. This page
compares geolint to each of them on the axes that matter for actually fixing a
site — not for watching a dashboard.

The short version: blocklists are one-size-fits-all denial, prompt packs can't
see your robots.txt, llms.txt validators check one file, and hosted audit apps
give you a score you can't act on in CI. geolint is the *linter* — purpose-aware
crawler analysis plus 45 fixable rules, runnable anywhere Node runs.

## The table

| | Purpose-aware bot registry | Per-vendor robots.txt posture | Runs in CI | Concrete fix per finding | Generates llms.txt | Free / open source |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| **geolint** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (MIT) |
| ai.robots.txt-style blocklists | ❌ | ❌ | n/a | ❌ | ❌ | ✅ |
| GEO-optimizer skills / prompt packs | ❌ | ❌ | ❌ | ❌ | ❌ | varies |
| llms.txt validators | ❌ | ❌ | some | partial | some | ✅ |
| Hosted GEO audit web apps | partial | ❌ | ❌ | partial | ❌ | ❌ |

## Axis by axis

**Purpose-aware bot registry** — "should I block this crawler?" depends on what
it *does*. geolint's registry (51 tokens, `geolint bots`) splits training bots
(GPTBot, ClaudeBot — blocking = absent from future training data) from search
and user-fetch bots (OAI-SearchBot, PerplexityBot, ChatGPT-User — blocking =
invisible in AI answers now), plus `mixed` tokens. Blocklists treat all tokens
identically; hosted apps usually show a flat allowed/blocked list without the
"so what".

**Per-vendor robots.txt posture** — whether a Disallow even *works* differs per
token: OpenAI, Perplexity and Meta document that their user-triggered fetchers
may ignore robots.txt; Google-Extended and Applebot-Extended are control-only
tokens that never fetch at all; `anthropic-ai` and `FacebookBot` are retired.
geolint encodes all three nuances (`ai-crawler/user-fetch-bypass`,
control-token handling, `ai-crawler/stale-tokens`). No other category models
this — a blocklist *is* the thing being audited, not an auditor.

**Runs in CI** — geolint is a CLI with exit codes (`--fail-under`,
`--baseline` regressions), a SARIF reporter for code scanning, and a
[composite GitHub Action](github-action.md). Web audit apps live behind a URL
input box and can't gate a deploy; prompt packs produce prose, not pass/fail;
llms.txt validators mostly offer a web UI or a single-file check.

**Concrete fix per finding** — every geolint finding ships `fix` text ("Remove
the Disallow covering PerplexityBot in robots.txt, or add an explicit
\"Allow: /\" for it.") plus the `evidence` it matched. Audit apps typically
render a score and a severity; validators point at the malformed line but don't
tell you what a correct file looks like for *your* site.

**Generates llms.txt** — `geolint init <url>` crawls the site and emits a
spec-shaped llms.txt (H1, blockquote, `##` sections, absolute links).
Blocklists and prompt packs don't produce one; validators check an existing
file (some have separate generators); audit apps report its absence.

**Free / open source** — geolint is MIT-licensed with two runtime dependencies,
works offline once installed, and audits localhost/staging. Hosted audit apps
are paid SaaS with black-box scoring; blocklists and validators are free but
narrow.

## The four categories, honestly

### ai.robots.txt-style blocklists

The [ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt) project and
similar community lists give you a ready-made `robots.txt` that denies known AI
crawlers. Useful as a *source of token names* (geolint's registry covers the
same ground), but it's a policy artifact, not a diagnostic tool:

- It can't tell you that blocking `OAI-SearchBot` costs you ChatGPT citations
  while blocking `GPTBot` doesn't — the opposite of what a site that wants AI
  visibility should do.
- It says nothing about whether your *current* robots.txt, meta tags or markup
  are hurting you.
- Blocking user-fetch tokens via robots.txt doesn't reliably work anyway (see
  `user-fetch-bypass`) — a blocklist gives false confidence.

### GEO-optimizer skills / prompt packs

Agent skills and prompt packs that rewrite your content for citability
(better summaries, question headings, statistics) operate entirely on the
content layer. They can be genuinely useful *after* an audit — but they can't
observe robots.txt, can't verify the crawler can fetch the page at all, don't
run deterministically, and produce edited prose rather than pass/fail findings
you can gate on. Complementary, not competing: fix access and structure with
geolint first, then optimize content.

### llms.txt validators

Web UIs and small CLIs that lint an existing `/llms.txt` against the spec —
H1 present, sections well-formed, links absolute. geolint's `llms-txt/*`
category covers the same checks (plus `llms-full.txt`, broken-link resolution
and `robots.txt`-directives-misplaced detection), but a validator can't answer
the prior question: can AI crawlers even reach your pages? And since llms.txt
is a proposal no vendor has committed to, a perfect score there buys you less
than the validators imply — which is exactly why geolint weights that category
as warnings, not errors.

### Hosted GEO audit web apps

"AI visibility" graders and dashboards — paste a URL, get a score. The
category is moving fast, so specifics vary, but structurally: scoring is a
black box, findings rarely come with per-rule fixes, there's no CLI/CI path,
private staging is unreachable, and the meter is running. geolint's equivalent
is a `npx` one-liner, a documented scoring formula
(see [faq.md](faq.md#how-is-the-score-computed)), and reports you can commit
next to the code.

## What geolint doesn't do

Fairness cuts both ways — geolint deliberately doesn't:

- **Track your actual citations/rankings** in ChatGPT or Perplexity over time
  (that's the dashboard tools' real value — geolint audits *readiness*, not
  outcomes).
- **Rewrite your content** (that's the optimizer tools' job).
- **Guarantee** that a high score produces citations — no tool can, and any
  that claims otherwise is overclaiming.

## See also

- [rules.md](rules.md) — all 45 rules with rationale and fixes
- [research-notes.md](research-notes.md) — the vendor documentation and GEO
  research behind the registry and the rules
- [github-action.md](github-action.md) — the CI recipes the "runs in CI"
  column is about
