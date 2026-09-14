# Showcase site

`scripts/gen-showcase.mjs` generates a static showcase — "geolint on the real
web" — deployed to GitHub Pages as the project's public demo surface.

## What it generates

Everything lands under `site/` (gitignored — built fresh in CI):

| Path | Content |
| --- | --- |
| `site/index.html` | Self-contained card grid: one card per site with score badge, grade chip, error/warning counts and a link to the full report. Sorted by score, unreachable sites last. |
| `site/reports/<slug>.html` | The full standalone geolint HTML report for that site (requires the `html` report format; skipped with a warning when the build predates it). |
| `site/data/<slug>.json` | The raw JSON scan report — or an error object when the site could not be scanned. |

Each site is scanned **once** with the real CLI
(`node dist/cli.js check <url> -f json -o site/data/<slug>.json --timeout 25000`),
then the HTML report is rendered from that JSON via the library API
(`renderReport(report, 'html')`). Scans run sequentially with a short delay —
polite, never parallel. A site that fails to scan never aborts the build: it
gets an error JSON and an "unreachable" card.

## The site list

The `SITES` array at the top of `scripts/gen-showcase.mjs` — currently GitHub,
Anthropic, OpenAI, Perplexity, Stripe, Vercel, Cloudflare, Wikipedia,
Stack Overflow and Hacker News. To add a site, append a
`{ slug, url, label }` entry (`slug` becomes the report/data filename — keep it
lowercase, no spaces).

## Run it locally

```bash
npm run build && node scripts/gen-showcase.mjs
open site/index.html
```

`npm run build` is required — the generator runs `dist/cli.js` and imports
`renderReport`/`badgeSvg` from `dist/index.js`, and exits with a clear error
when `dist/` is missing. A full run takes a few minutes (10 sites, real
network fetches, 25s fetch timeout each).

## Deployment

`.github/workflows/pages.yml` rebuilds and deploys on every push to `main`
that touches `src/**`, the generator, or the workflow itself — plus manual
`workflow_dispatch` runs. It uses the standard two-job Pages pattern:
`build` (npm ci → build → generate → `upload-pages-artifact`) and `deploy`
(`deploy-pages` into the `github-pages` environment).

**One-time maintainer step:** in the repo, go to
**Settings → Pages → Source** and select **GitHub Actions**. Until that is
done, the `deploy` job has no Pages environment to publish to.
