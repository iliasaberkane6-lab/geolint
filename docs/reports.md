# Report formats

`geolint check` and `geolint crawl` render the same audit data through
`-f, --format`:

| Format     | Best for                                                     |
| ---------- | ------------------------------------------------------------ |
| `pretty`   | Terminal output (default) — colored, compact, scan-and-go.   |
| `html`     | A shareable, self-contained web report — see below.          |
| `markdown` | PR comments, docs, GitHub/GitLab summaries.                  |
| `json`     | Machine-readable output for CI, `diff`, and custom tooling.  |
| `sarif`    | Code-scanning integrations (GitHub Advanced Security, IDEs). |

```bash
geolint check https://example.com -f html -o report.html
geolint crawl https://example.com -f html -o site-report.html
```

## The HTML report

The HTML format produces **one self-contained `.html` file** — all CSS is
inlined, the only JavaScript is a small inline findings filter, and there are
no external fonts, scripts, images or CDN links. It renders identically
offline (`file://`) and hosted, so it is the format to reach for when the
report leaves your machine.

It contains:

- **Header** — scanned URL (plus final URL when redirected), HTTP status,
  TTFB, robots.txt / llms.txt status and the scan timestamp.
- **Score hero** — an SVG score ring, the numeric score out of 100 and the
  grade letter (A → F, same colors as the terminal report and the badge).
- **Category breakdown** — the five rule categories with per-category score
  bars and issue counts.
- **Findings** — grouped into collapsible Errors / Warnings / Hints sections
  (hints are collapsed by default, expanded with `--verbose`), each with the
  rule id, rule title, message, fix hint and evidence. A filter box searches
  across all findings client-side.
- **AI crawler access matrix** — every known AI bot with its vendor, purpose
  badge (training / search / user-fetch / mixed), documented robots.txt
  posture and whether your robots.txt allows it. Retired tokens are dimmed.
- **Site reports** (`crawl`) additionally show a per-page table — score,
  grade and worst issue per page, worst first, each row linking to the page —
  and deduplicate shared findings with a `×N pages` count.

The report is XSS-safe (every dynamic string is escaped at render time),
responsive down to phone widths, and prints acceptably — collapsed sections
are auto-expanded when printing.

### Sharing and hosting

Because nothing external is referenced, you can:

- **Email / Slack it** — attach `report.html`; the recipient just opens it.
- **Commit it** — check a snapshot into a repo or wiki for audit trails.
- **Host it statically** — drop it on GitHub Pages, Netlify, S3, an artifact
  bucket, or an internal dashboard. One file, no build step.
- **Upload as a CI artifact** — e.g. `actions/upload-artifact` in GitHub
  Actions after `geolint check -f html -o report.html`.

## Programmatic use

```ts
import { renderReport, renderSiteReport, REPORT_FORMATS } from '@iliasabk/geolint';

const html = renderReport(report, 'html');       // single-page audit
const siteHtml = renderSiteReport(site, 'html'); // crawl audit
```

`renderReport`/`renderSiteReport` accept every entry in `REPORT_FORMATS`
(`'pretty' | 'json' | 'sarif' | 'markdown' | 'html'`).
