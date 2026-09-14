# Writing rules

The complete guide to authoring a geolint audit rule. For dev setup and PR
process see [CONTRIBUTING.md](../CONTRIBUTING.md); engine internals are in
[docs/architecture.md](architecture.md); the catalogue is the generated
[docs/rules.md](rules.md).

## Where rules live

- One file per rule: `src/rules/<category>/<name>.ts`, where `<category>` is
  one of `ai-crawler`, `llms-txt`, `schema`, `content`, `technical`.
- The rule `id` is `<category>/<kebab-name>` — conventionally identical to
  its path (`src/rules/technical/https.ts` → `technical/https`). Ids select
  rules (`--only`/`--ignore`) and attribute findings.
- Register the rule in `src/rules/index.ts`: import it and add it to
  `allRules` inside its category block. Registry order defines the order in
  `geolint rules` and the generated catalogue.
- `src/rules/technical/https.ts` is the canonical template — copy it.

## The `check(ctx)` lifecycle

A rule is a plain object (`interface Rule` in `src/core/types.ts`): an `id`,
a `category`, a `title`, a one-paragraph `description`, a declared `severity`
and `check(ctx)`. The lifecycle:

- `check` returns `RuleFinding[]` (sync or async); an **empty array means
  pass**.
- All selected rules run **in parallel** (`Promise.all` in the engine) — a
  rule must not rely on execution order or mutate shared state.
- If `check` throws, the engine converts the exception into an `internal`
  info finding (`rule failed: …`) — reported but never scored. Still, prefer
  returning `[]` over throwing.

### What `ctx` guarantees

| Field | Contract |
| --- | --- |
| `ctx.url` | The requested URL (pre-redirect). Always set. |
| `ctx.finalUrl` | URL after redirects; equals `ctx.url` when the fetch failed. |
| `ctx.page` | `PageData \| null`. **Null when the target could not be fetched** — handle it (usually `return []`; `technical/page-unreachable` already owns that finding). |
| `ctx.$` | Cheerio handle over `page.html`; null iff `page` is null. |
| `ctx.robots` | `RobotsData \| null`. `status === 0` = unreachable; `raw === null` = no parseable file (4xx or failure) — `groups`/`sitemaps` are then `[]`. |
| `ctx.llmsTxt` | `LlmsTxtData \| null`. Same status semantics, plus `parsed` (H1 title, blockquote summary, H2 link sections) when the body parsed. |
| `ctx.options` | Resolved scan options: `timeout`, `userAgent`, `only`, `ignore`, `categories`, `maxExtraFetches`. |
| `ctx.fetchPage(url)` | Extra fetches from inside a rule — sitemap probes, llms-full.txt, manifest candidates, llms.txt link sampling (link targets may leave the origin). Budgeted: after `maxExtraFetches` calls (default **10 per page**) it throws. **A throw is not evidence** — wrap calls in try/catch and return `[]` or skip. |

Reach for the shared helpers instead of re-parsing:

- `wordCount` / `visibleText` — `src/rules/_text.ts` (body text with
  nav/script/style stripped)
- `extractJsonLd` / `jsonLdTypes` / `CITABILITY_SCHEMA_TYPES` —
  `src/core/schema.ts`
- `isAllowed` / `matchGroup` / `blocksRoot` — `src/core/robots.ts` (evaluate
  robots.txt for any token + path)
- `AI_BOTS`, `botsByPurpose`, `citationCriticalBots`, `retiredBots` —
  `src/core/bots.ts`

## Findings

```ts
interface RuleFinding {
  severity: 'error' | 'warn' | 'info';
  message: string;    // one line: what was found
  detail?: string;    // why it matters / context
  fix?: string;       // concrete remediation — see style below
  evidence?: string;  // verbatim proof: header line, status, matched rule
}
```

- `message` — short and factual; a single sentence fragment, no trailing
  period (matches the existing style).
- `fix` — **actionable imperative** naming the artifact and the change:
  `Remove the Disallow covering OAI-SearchBot in robots.txt`, not
  `improve your SEO`. Every non-pass finding should carry one.
- `evidence` — the strongest quote you have: the offending `Disallow:` line,
  the `X-Robots-Tag` value, `GET /sitemap.xml → HTTP 404`. Reporters render
  it under the finding.
- One finding per distinct problem (e.g. one per blocked bot) — per-rule
  score caps prevent score distortion, but reports read better when each
  finding is actionable on its own.
- `internal: true` exists on `Finding` but is set **by the engine only**,
  for crashed rules — rules never produce it.

## Severity: error vs warn vs info

geolint's honesty stance ([docs/research-notes.md](research-notes.md)):
severity tracks the strength of evidence that a problem costs the site AI
visibility — not how interesting the check is.

| Severity | When | Examples |
| --- | --- | --- |
| `error` | Verified loss of visibility: crawlers/answer engines demonstrably can't see or cite the page — fetch failure, 4xx/5xx, client-rendered shell, `noindex`, a citation-critical bot disallowed, broken JSON-LD, plain HTTP. | `technical/page-unreachable`, `ai-crawler/search-bots-blocked`, `schema/invalid-jsonld` |
| `warn` | A real defect with documented impact, but the page stays visible — or the standard involved is not universally adopted. | `llms-txt/missing` (a proposal, not a standard), `technical/sitemap-missing`, `content/thin-content`, `ai-crawler/training-bots-blocked` (affects future models, not current citations) |
| `info` | Advisory: emerging conventions, legitimate policy choices worth surfacing, or signals where the research is equivocal. | `llms-txt/llms-full-missing`, `ai-crawler/crawl-delay`, `ai-crawler/stale-tokens`, `content/no-question-headings` (counter-evidence exists) |

Two corollaries:

- **Absence of evidence is not evidence of absence.** When the data your rule
  needs is unavailable — null `page`, unreachable robots.txt, an auxiliary
  fetch that threw — return `[]`; never punish a site for what the scan
  couldn't see.
- **Findings carry the effective severity; `rule.severity` is the declared
  default** (used by `geolint rules` and the generated docs). A rule may emit
  mixed severities — see `ai-crawler/meta-robots-blocking` (noindex → error,
  nosnippet → warn, `unavailable_after` → info).

## Worked example

`technical/charset-missing` — fires when neither the `Content-Type` header
nor the document declares an encoding. Small, but it exercises the whole
contract: null handling, ctx fields, a complete finding.

```ts
// src/rules/technical/charset-missing.ts
import type { Rule } from '../../core/types.js';

export const charsetMissingRule: Rule = {
  id: 'technical/charset-missing',
  category: 'technical',
  title: 'Character encoding declared',
  description:
    'AI crawlers consume pages as text. When neither the Content-Type header nor a <meta charset> declares the encoding, non-ASCII content can be mangled before any engine reads it.',
  severity: 'info',
  check(ctx) {
    // ctx.page is null when the fetch failed — never dereference blindly.
    if (!ctx.page || !ctx.$) {
      return [];
    }
    const header = ctx.page.contentType;
    const meta = ctx.$('meta[charset]').attr('charset') ?? '';
    if (/charset\s*=/i.test(header) || meta.trim() !== '') {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'No character encoding declared',
        detail:
          'The Content-Type header has no charset parameter and the document has no <meta charset> — decoders must guess.',
        fix: 'Send "Content-Type: text/html; charset=utf-8" and/or put <meta charset="utf-8"> first in <head>.',
        evidence: `content-type: ${header || '(absent)'}`,
      },
    ];
  },
};
```

Register it in `src/rules/index.ts`:

```ts
import { charsetMissingRule } from './technical/charset-missing.js';
// …then inside allRules, in the // technical block:
charsetMissingRule,
```

## Testing

Specs live in `test/rules/<category>.test.ts`. `test/helpers.ts` provides
stub factories — no network needed:

```ts
// test/rules/technical.test.ts
import { describe, expect, it } from 'vitest';
import { charsetMissingRule } from '../../src/rules/technical/charset-missing.js';
import { makeCtx, makePage } from '../helpers.js';

describe('technical/charset-missing', () => {
  it('passes when a charset is declared', async () => {
    expect(await charsetMissingRule.check(makeCtx())).toEqual([]);
  });

  it('informs when no charset is declared anywhere', async () => {
    const page = makePage({
      contentType: 'text/html',
      headers: { 'content-type': 'text/html' },
      html: '<!doctype html><html><head><title>t</title></head><body>x</body></html>',
    });
    const findings = await charsetMissingRule.check(makeCtx({ page }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('info');
    expect(findings[0]!.fix).toContain('utf-8');
  });
});
```

Available stubs: `makePage(overrides)`, `makeRobots(raw | null)`,
`makeLlmsTxt(raw | null)` — the last two run the **real parsers** on your raw
strings — and `makeCtx(overrides)`, which composes them into a `RuleContext`.
`makeCtx`'s `fetchPage` defaults to an echo stub; override it to simulate
statuses, bodies or a budget-exhaustion throw (see the
`technical/sitemap-missing` specs).

Cover at minimum: pass → `[]`; fail → finding with `fix`; `page: null` → no
crash; and for rules using `ctx.fetchPage`, a throwing fetch → `[]`.

Rules that need real HTTP semantics (redirects, status codes, cross-file
flows) can go through the whole engine against a local server —
`withFixtureServer(routes, fn)` in `test/helpers.ts` spins one up;
`test/e2e.test.ts` shows the pattern (imports: `scan` from
`../../src/core/engine.js`, `withFixtureServer` from `../helpers.js`):

```ts
await withFixtureServer(
  [{ path: '/', body: '<html>…</html>', headers: { 'content-type': 'text/html' } }],
  async (origin) => {
    const report = await scan(origin, { only: ['technical/charset-missing'] });
    expect(report.findings.map((f) => f.ruleId)).toContain('technical/charset-missing');
  },
);
```

## Documentation

`docs/rules.md` is **generated** — do not edit it by hand. After registering
your rule, run `npx tsx scripts/gen-rules-docs.ts`. It renders each rule's
`id`, `title`, `severity` and `description` into the catalogue (including the
`rule-<id>` anchors that SARIF `helpUri` links point at). Write `description`
for that audience: one paragraph on *why it matters for AI search*, not how
the check is implemented.

Rule selection comes free — `--only`, `--ignore`, `--category` and
`geolint rules` all work off the registry (`selectRules` in
`src/core/engine.ts`); there is nothing per-rule to wire up.

## Before you open the PR

- `npm test` — your specs plus the whole suite pass
- `npx tsx scripts/gen-rules-docs.ts` — `docs/rules.md` regenerated
- `npm run lint` — biome clean (autofixes formatting/import order)
- `npm run typecheck` — `tsc --noEmit` clean
- Smoke-test the real pipeline — serve the bundled demo site
  (`python3 -m http.server 4173 --directory examples/demo-site`) and run
  `npm run geolint -- check localhost:4173 --only <your-rule-id>`
