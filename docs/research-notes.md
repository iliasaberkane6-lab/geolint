# Research notes — sources behind geolint's checks

Compiled 2026-09-14. These notes back the rule registry (`src/core/bots.ts`)
and the audit rules. Items marked ⚠️ are community-documented, not
operator-verified.

## AI crawler robots.txt posture (per vendor)

| Token | Company | Purpose | robots.txt | Source |
|---|---|---|---|---|
| GPTBot | OpenAI | training | honored | https://developers.openai.com/api/docs/bots |
| OAI-SearchBot | OpenAI | search | honored — blocking removes ChatGPT citations | same |
| ChatGPT-User | OpenAI | user-fetch | **"robots.txt rules may not apply"** | same |
| ClaudeBot / Claude-User / Claude-SearchBot | Anthropic | training / user-fetch / search | all three honored | https://support.claude.com/en/articles/8896518 |
| PerplexityBot | Perplexity | search | honored (claimed since 2024) | https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md |
| Perplexity-User | Perplexity | user-fetch | **"generally ignores robots.txt"** | same |
| Googlebot | Google | search (feeds AI Overviews/AI Mode) | honored | https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers |
| Google-Extended | Google | training | control-only token — **never fetches** | same |
| Applebot | Apple | search (Siri/Spotlight) | honored; falls back to Googlebot rules | https://support.apple.com/en-us/119829 |
| Applebot-Extended | Apple | training | control-only — does not crawl | same |
| meta-externalagent / Meta-WebIndexer / Meta-ExternalFetcher | Meta | training / search / user-fetch | honored / honored / **may bypass** | https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ |
| Amazonbot / Amzn-SearchBot / Amzn-User | Amazon | mixed / search / user-fetch | honored; no Crawl-delay | https://developer.amazon.com/amazonbot |
| MistralAI-User / -Index / -Training | Mistral AI | user-fetch / search / training | unverified | https://docs.mistral.ai/robots |
| Bingbot | Microsoft | search (feeds Copilot) | honored | Bing webmaster docs |
| DuckAssistBot | DuckDuckGo | user-fetch | honored, 72h propagation | https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot |
| Bytespider | ByteDance | mixed | ⚠️ disputed — highest-volume AI bot; enforce at WAF | Fortune/Kasada 2024, Cloudflare data |
| CCBot | Common Crawl | training corpus | honored | https://commoncrawl.org/faq |
| cohere-ai | Cohere | user-fetch (often mislabeled training) | ⚠️ no official docs | community registries |
| FacebookBot, anthropic-ai, Claude-Web, omgilibot | Meta/Anthropic/Webz | retired tokens | — | vendor docs |

## llms.txt spec (llmstxt.org)

- Structure order: optional BOM → **one H1 (only required element)** →
  optional blockquote summary → free markdown (no headings) → H2 sections
  with `- [name](url): optional notes` link lists.
- `## Optional` section, if present, should be last.
- Serve at `/llms.txt`, HTTP 200, `text/plain`/`text/markdown`, UTF-8 —
  not an HTML SPA shell. Links should be absolute.
- llms-full.txt: convention (Mintlify-popularized) — concatenated full
  markdown pages; adopted by Anthropic, Cloudflare, Vercel, Stripe.
- ⚠️ Honest caveat: a proposal, not a standard — no major AI vendor has
  committed to honoring it; weight accordingly in scoring.

## GEO evidence

- **GEO study (KDD'24, arXiv:2311.09735)**: adding quotations (+41%),
  statistics (+31%), source citations (+27%) measurably boost share-of-answer;
  keyword stuffing hurts (−8%). Up-to-40% is per-method upper bound.
- **AI crawlers don't execute JS** (Vercel+MERJ, Dec 2024): zero JS execution
  observed across GPTBot, ClaudeBot, PerplexityBot, Meta-ExternalAgent,
  Bytespider. Exceptions: Googlebot, Applebot. → SSR/SSG is a visibility
  prerequisite.
- **Freshness** (Ahrefs, 17M citations): AI-cited URLs are ~26% fresher than
  organic SERP medians; 76% of ChatGPT top-cited pages updated ≤30 days.
- **Structured data/semantic HTML** (GEO-16, arXiv:2509.10762): metadata +
  freshness + structured data are the pillars most associated with citation.
- ⚠️ Counter-evidence exists for question-format headings (SIGI-2026-037);
  correlations here are confounded — geolint treats them as hints, not facts.
- **nosnippet / max-snippet:0** removes content from AI Overviews/AI Mode
  inputs (Google Search Central docs). `noai`/`noimageai` are not
  standardized; TDMRep is a W3C community report; IETF AIPREF in progress.

## Competitive gaps geolint owns

1. Purpose-aware registry (training vs search vs user-fetch vs control-only)
   with per-vendor robots.txt posture.
2. Control-token correctness — Google-Extended/Applebot-Extended are never
   seen in logs.
3. Stale-token linting (anthropic-ai, Claude-Web, FacebookBot, omgilibot).
4. Source-cited rules; honest llms.txt weighting.
