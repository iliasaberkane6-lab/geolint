# Score badges

`geolint check` can emit a README badge that shows off your AI-search
readiness score — either as a self-contained SVG (no external service
involved) or through shields.io.

The badge colors follow the grade, same as the terminal report:

| Grade | Score   | Color       |
| ----- | ------- | ----------- |
| A     | 90–100  | brightgreen |
| B     | 75–89   | green       |
| C     | 60–74   | yellow      |
| D     | 40–59   | orange      |
| F     | 0–39    | red         |

## Quick start

```bash
geolint check https://example.com --badge
```

This writes `geolint-badge.svg` to the current directory and prints a
markdown snippet to stderr (stdout stays reserved for the report):

```markdown
[![geolint](geolint-badge.svg)](https://github.com/iliasabk/geolint)
```

## Flags

| Flag                        | Effect                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `--badge`                   | Write `geolint-badge.svg` to the cwd + print a markdown snippet. |
| `--badge <file>`            | Write the SVG to `<file>` instead.                            |
| `--badge-endpoint <file>`   | Also write a shields.io endpoint JSON (for live CI badges).   |

All badge output respects the usual rules: the report on stdout is
untouched, progress and the snippet go to stderr, and badge generation
never changes the exit code (`--fail-under` still decides pass/fail).

## Pattern A — committed SVG (self-contained)

The simplest setup: commit the generated SVG and reference it with a
relative path. Nothing depends on an external service, so the badge renders
even if shields.io is down — it just shows the score as of the last commit
that regenerated it.

```bash
geolint check https://example.com --badge
git add geolint-badge.svg README.md
git commit -m "docs: add geolint score badge"
```

To keep it honest, regenerate the SVG on a schedule (e.g. a weekly CI job)
and commit the result — otherwise the number goes stale silently.

## Pattern B — live badge via shields.io endpoint

For a badge that always reflects the latest scan, let CI regenerate a small
JSON file and have shields.io render it:

```yaml
# .github/workflows/geolint-badge.yml (run on push to main / on a schedule)
- run: npx -y @iliasabk/geolint@latest check https://example.com --badge-endpoint geolint-badge.json
- run: |
    git config user.name "geolint-bot"
    git config user.email "bot@users.noreply.github.com"
    git add geolint-badge.json
    git commit -m "chore: refresh geolint badge" || echo "badge unchanged"
    git push
```

The JSON matches the shields endpoint schema:

```json
{
  "schemaVersion": 1,
  "label": "geolint",
  "message": "87/100 · B",
  "color": "green"
}
```

Then point shields at the raw URL of the committed file (a gist or any
public URL works too):

```markdown
[![geolint](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/<owner>/<repo>/main/geolint-badge.json)](https://github.com/iliasabk/geolint)
```

## Pattern C — static shields URL (instant, but goes stale)

The markdown snippet falls back to a static shields URL when no
README-usable SVG path was written:

```markdown
[![geolint](https://img.shields.io/badge/geolint-87%2F100_%C2%B7_B-green)](https://github.com/iliasabk/geolint)
```

This needs zero files and zero CI — but the score is baked into the URL, so
it only ever shows the score of the run that produced it. Prefer pattern A
or B for anything long-lived.

## Programmatic use

The same generators are exported from the package:

```ts
import { badgeSvg, badgeMarkdown, shieldsEndpointJson } from '@iliasabk/geolint';

badgeSvg(87, 'B');                    // '<svg …'
shieldsEndpointJson(87, 'B');         // '{ "schemaVersion": 1, … }'
badgeMarkdown(87, 'B');               // '[![geolint](https://img.shields.io/…)](…)'
badgeMarkdown(87, 'B', { imageUrl: 'geolint-badge.svg' });
```
