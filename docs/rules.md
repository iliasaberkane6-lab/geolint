# geolint rules

geolint ships **45 rules** across 5 categories.
Each rule documents what it checks, why it matters for AI search visibility, and how to fix violations.

## AI Crawler Access

<a id="rule-ai-crawler-search-bots-blocked"></a>
### `ai-crawler/search-bots-blocked` — AI search and user-fetch bots allowed by robots.txt

**Severity:** 🔴 error

ChatGPT, Perplexity, Claude and other answer engines can only cite pages their crawlers are allowed to fetch. A Disallow for a search or user-fetch bot removes the site from current AI answers.

<a id="rule-ai-crawler-training-bots-blocked"></a>
### `ai-crawler/training-bots-blocked` — AI training bots allowed by robots.txt

**Severity:** 🟡 warn

Training crawlers collect the corpus future models learn from. Blocking them does not affect citations today, but it keeps your content out of the training data of the next model generation.

<a id="rule-ai-crawler-wildcard-block-all"></a>
### `ai-crawler/wildcard-block-all` — No wildcard "Disallow: /" in robots.txt

**Severity:** 🔴 error

A "User-agent: *" group that disallows the site root blocks every crawler without a more specific group — including AI crawlers you have never heard of and future answer engines.

<a id="rule-ai-crawler-robots-missing"></a>
### `ai-crawler/robots-missing` — robots.txt present

**Severity:** 🟡 warn

Without a robots.txt, AI crawler access is uncontrolled: every bot assumes it may crawl everything, and you cannot grant or deny access per bot. A robots.txt is the standard way to welcome AI search crawlers explicitly.

<a id="rule-ai-crawler-robots-unreachable"></a>
### `ai-crawler/robots-unreachable` — robots.txt reachable

**Severity:** 🟡 warn

If robots.txt cannot be fetched, crawler access cannot be audited — and some AI crawlers treat repeated robots.txt fetch failures as "fully disallowed" and stop crawling.

<a id="rule-ai-crawler-meta-robots-blocking"></a>
### `ai-crawler/meta-robots-blocking` — No noindex/nosnippet directives blocking AI use

**Severity:** 🔴 error

X-Robots-Tag headers and robots meta tags apply to AI crawlers too: noindex keeps the page out of AI answers entirely, while nosnippet or max-snippet:0 makes it impossible for engines to quote you.

<a id="rule-ai-crawler-crawl-delay"></a>
### `ai-crawler/crawl-delay` — No crawl-delay slowing AI crawlers

**Severity:** 🔵 info

A Crawl-delay that applies to AI bots throttles how fast they can ingest your site. That slows down indexing and can make fresh content invisible to AI answers for longer.

<a id="rule-ai-crawler-ai-opt-out-signals"></a>
### `ai-crawler/ai-opt-out-signals` — Explicit AI opt-out signals

**Severity:** 🔵 info

Signals like <meta name="noai">, TDM-Reservation headers or ai.txt-style markers tell AI systems to stay out. That is a legitimate choice — but it is worth surfacing so it is never an accidental leftover.

<a id="rule-ai-crawler-user-fetch-bypass"></a>
### `ai-crawler/user-fetch-bypass` — User-triggered fetchers that ignore robots.txt

**Severity:** 🔵 info

OpenAI, Perplexity and Meta document that their user-initiated fetchers (ChatGPT-User, Perplexity-User, Meta-ExternalFetcher) may not honor robots.txt — a Disallow does not stop them, so blocking them only creates a false sense of control.

<a id="rule-ai-crawler-stale-tokens"></a>
### `ai-crawler/stale-tokens` — Retired AI bot tokens in robots.txt

**Severity:** 🔵 info

Robots.txt entries for retired tokens (e.g. anthropic-ai, Claude-Web, FacebookBot, omgilibot) do nothing — the vendors moved to new user-agents. Stale rules are a maintenance smell and can mask that the intended bot is actually unrestricted.

## llms.txt

<a id="rule-llms-txt-missing"></a>
### `llms-txt/missing` — llms.txt present

**Severity:** 🟡 warn

llms.txt (llmstxt.org) is the emerging standard for telling AI systems what your site is about and where its most citable content lives. Without it, answer engines have no curated map of your site.

<a id="rule-llms-txt-invalid-structure"></a>
### `llms-txt/invalid-structure` — llms.txt is valid markdown with an H1

**Severity:** 🟡 warn

The llms.txt spec requires a markdown file that starts with an H1 project name. An empty file or an HTML fallback page (common with SPA rewrites) is useless to AI consumers.

<a id="rule-llms-txt-no-summary"></a>
### `llms-txt/no-summary` — llms.txt has a summary

**Severity:** 🔵 info

The blockquote right after the H1 is the short, self-contained description AI systems quote when they need to explain what a site is. Missing it means engines guess.

<a id="rule-llms-txt-no-sections"></a>
### `llms-txt/no-sections` — llms.txt has link sections

**Severity:** 🟡 warn

The point of llms.txt is its curated link lists under H2 sections — they are the map AI systems follow to your most citable pages. A file without sections or links is a dead end.

<a id="rule-llms-txt-broken-links"></a>
### `llms-txt/broken-links` — llms.txt links resolve

**Severity:** 🟡 warn

llms.txt is a curated map for AI consumers — links that 404 or fail to load send crawlers into dead ends and waste their fetch budget.

<a id="rule-llms-txt-llms-full-missing"></a>
### `llms-txt/llms-full-missing` — llms-full.txt companion file

**Severity:** 🔵 info

llms-full.txt is the optional companion that inlines full documentation/content in one file, so an AI system can ingest everything in a single request. Sites serious about AI readability publish it.

<a id="rule-llms-txt-relative-links"></a>
### `llms-txt/relative-links` — llms.txt links are absolute URLs

**Severity:** 🟡 warn

The llms.txt spec expects absolute URLs in link items — an LLM reading the file has no base URL to resolve relative paths against.

<a id="rule-llms-txt-optional-not-last"></a>
### `llms-txt/optional-not-last` — Optional section comes last in llms.txt

**Severity:** 🔵 info

The llms.txt convention defines an "## Optional" section whose links context-limited clients may skip — it only works as the final section.

<a id="rule-llms-txt-robots-directives"></a>
### `llms-txt/robots-directives` — No robots.txt directives inside llms.txt

**Severity:** 🟡 warn

llms.txt is a curated link index, not a control file — User-agent/Disallow lines have no effect there and usually mean the two files were confused.

<a id="rule-llms-txt-multiple-h1"></a>
### `llms-txt/multiple-h1` — Exactly one H1 in llms.txt

**Severity:** 🔵 info

The spec requires exactly one H1 (the project name) as the first element — multiple H1s make the file ambiguous to parse.

## Structured Data

<a id="rule-schema-no-jsonld"></a>
### `schema/no-jsonld` — JSON-LD structured data present

**Severity:** 🟡 warn

Structured data lets answer engines extract facts — what the page is, who wrote it, when — without guessing from prose. Pages with JSON-LD are significantly easier to cite correctly.

<a id="rule-schema-invalid-jsonld"></a>
### `schema/invalid-jsonld` — JSON-LD blocks parse

**Severity:** 🔴 error

A malformed JSON-LD block is worse than none: parsers skip it entirely and may distrust the rest of the markup. Broken structured data = invisible structured data.

<a id="rule-schema-missing-article-fields"></a>
### `schema/missing-article-fields` — Article schema has headline/date/author

**Severity:** 🟡 warn

headline, datePublished and author are the fields answer engines read first from an Article — they feed the citation line. An Article without them wastes most of its citability.

<a id="rule-schema-no-faq-schema"></a>
### `schema/no-faq-schema` — Question headings backed by FAQPage schema

**Severity:** 🔵 info

Question-shaped headings map 1:1 onto the questions users ask answer engines. Marking them up as FAQPage/QAPage makes the Q&A pairs trivially extractable — an easy citation win.

<a id="rule-schema-no-organization"></a>
### `schema/no-organization` — Organization schema present

**Severity:** 🔵 info

Organization markup grounds your site to a real-world entity. Answer engines use it for knowledge-graph disambiguation — to know *who* is speaking before deciding whether to trust and cite them.

<a id="rule-schema-no-breadcrumb"></a>
### `schema/no-breadcrumb` — BreadcrumbList schema present

**Severity:** 🔵 info

BreadcrumbList tells crawlers where a page sits in the site hierarchy, giving AI systems context about topic relationships — useful when they decide which page of yours to cite.

## Citability

<a id="rule-content-thin-content"></a>
### `content/thin-content` — Substantive visible text

**Severity:** 🟡 warn

Answer engines cite pages with real substance. Under ~200 words there is rarely enough self-contained, quotable material for an AI answer — thin pages get skipped.

<a id="rule-content-no-h1"></a>
### `content/no-h1` — Single descriptive H1

**Severity:** 🟡 warn

The H1 is the strongest single "what is this page" signal in the document. AI systems lean on it when deciding whether the page answers a question — a missing or empty H1 leaves them guessing.

<a id="rule-content-no-question-headings"></a>
### `content/no-question-headings` — Question-shaped headings

**Severity:** 🔵 info

Headings phrased as questions mirror how users prompt answer engines. A page whose h2/h3 literally ask the questions users ask is far easier to match and cite.

<a id="rule-content-missing-dates"></a>
### `content/missing-dates` — Visible publication/modified date

**Severity:** 🟡 warn

Freshness is one of the top citation signals: answer engines strongly prefer pages they can date. No machine-readable date means no freshness credit.

<a id="rule-content-no-author"></a>
### `content/no-author` — Author attribution

**Severity:** 🔵 info

E-E-A-T applies to AI search too: attributable content (named author, ideally with credentials) is more trustworthy and more citable than anonymous prose.

<a id="rule-content-no-data-points"></a>
### `content/no-data-points` — Concrete data points

**Severity:** 🔵 info

Statistics and concrete numbers are among the most-cited sentence shapes in AI answers ("X grew 34%"). Pages without any quotable data are harder to cite than pages with stats.

<a id="rule-content-images-no-alt"></a>
### `content/images-no-alt` — Images carry alt text

**Severity:** 🔵 info

Multimodal answer engines read alt text to understand images — and increasingly cite visual content. Images without alt text are invisible to them.

<a id="rule-content-no-structure"></a>
### `content/no-structure` — Structured content (lists/tables)

**Severity:** 🔵 info

Lists, tables and definition lists are the easiest content for AI systems to lift verbatim into an answer. A long wall of prose with zero structure is harder to quote.

<a id="rule-content-lang-missing"></a>
### `content/lang-missing` — html lang attribute

**Severity:** 🔵 info

The lang attribute tells AI systems (and translation layers inside them) which language the content is in — a basic signal for correct citation and answer localization.

## Technical Foundation

<a id="rule-technical-page-unreachable"></a>
### `technical/page-unreachable` — Page fetchable

**Severity:** 🔴 error

If we cannot fetch the page, neither can AI crawlers. Everything else in the audit depends on the page actually loading.

<a id="rule-technical-http-error"></a>
### `technical/http-error` — HTTP status healthy

**Severity:** 🔴 error

A 4xx/5xx response means AI crawlers get an error page instead of your content — nothing to read, nothing to cite.

<a id="rule-technical-client-rendered"></a>
### `technical/client-rendered` — Content in the initial HTML

**Severity:** 🔴 error

AI crawlers do not execute JavaScript. A client-rendered page serves them an empty shell — no text, no facts, nothing to cite. Content must exist in the initial HTML.

<a id="rule-technical-sitemap-missing"></a>
### `technical/sitemap-missing` — XML sitemap discoverable

**Severity:** 🟡 warn

A sitemap is how crawlers — AI ones included — discover your full set of pages efficiently. No sitemap and no Sitemap directive in robots.txt makes discovery depend on fragile link-following.

<a id="rule-technical-canonical"></a>
### `technical/canonical` — Canonical link sanity

**Severity:** 🔵 info

The canonical URL tells engines which URL owns the content. Missing, it invites duplicate-content ambiguity; pointing at a different origin, it can hand your citability to another domain.

<a id="rule-technical-title-missing"></a>
### `technical/title-missing` — Page title present

**Severity:** 🟡 warn

The title is the default label answer engines attach to a citation. No title means an engine either invents one or cites a bare URL.

<a id="rule-technical-meta-description"></a>
### `technical/meta-description` — Meta description present

**Severity:** 🔵 info

The meta description is a ready-made summary engines can quote. Absent or too short, they fall back to extracting an arbitrary passage.

<a id="rule-technical-slow-response"></a>
### `technical/slow-response` — Fast initial response

**Severity:** 🟡 warn

AI crawlers operate under strict fetch budgets and timeouts. A slow TTFB means fewer pages crawled per visit — or timeouts that leave the site partially invisible.

<a id="rule-technical-redirect"></a>
### `technical/redirect` — No unexpected redirect

**Severity:** 🔵 info

Redirects are fine, but they cost crawl budget and can mask canonical problems. Knowing where a URL actually lands matters for how engines index it.

<a id="rule-technical-https"></a>
### `technical/https` — Site served over HTTPS

**Severity:** 🔴 error

AI crawlers and answer engines prefer secure origins; several decline to index or cite plain-HTTP pages.

---

_This file is generated by `scripts/gen-rules-docs.ts`. Do not edit by hand._
