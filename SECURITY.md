# Security policy

## Supported versions

geolint is pre-1.0; only the latest minor release receives security fixes.

| Version | Supported      |
| ------- | -------------- |
| 0.1.x   | ✅ latest only |
| < 0.1   | ❌             |

Once 1.0 ships, this table will track the current major plus the previous
minor line.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately via
[GitHub private vulnerability reporting](https://github.com/iliasaberkane6-lab/geolint/security/advisories/new)
(the "Report a vulnerability" button on the repo's Security tab).

Please include:

- the geolint version (`geolint --version`) and Node version,
- a minimal reproduction (command + target setup),
- the impact you believe is possible.

You can expect an acknowledgement within **72 hours** and, if accepted, a fix
or a documented mitigation in the next patch release. We will credit you in
the release notes unless you prefer to stay anonymous.

## Scope and threat model

geolint is a **client-side auditing CLI**: it fetches whatever URL you point it
at (the target page plus same-origin helpers like `robots.txt`, `llms.txt` and
sitemaps) and renders a report.

In scope:

- Remote code execution, sandbox escapes or credential/file exfiltration
  triggered by **parsing a malicious page** (HTML, robots.txt, llms.txt,
  JSON-LD).
- Vulnerabilities in published artifacts — the npm package, the composite
  `action.yml`, or release workflow (e.g. provenance/publishing issues).
- Dependency vulnerabilities reachable through normal `check`/`crawl` usage.

Out of scope:

- **SSRF-style abuse**: geolint fetches arbitrary URLs by design — that *is*
  the feature. If you embed geolint in a server or a shared CI runner, treating
  user-supplied URLs as trusted is your responsibility (rate-limit, allowlist,
  isolate). Issues that only amount to "geolint fetched a URL I gave it" are
  not vulnerabilities.
- Denial of service against a *target* site (crawl is bounded by
  `--max-pages`/`--concurrency`, but hammering is a usage choice).
- Findings *about* your site (that is the tool working as intended — fix the
  site, not the linter).
- Vulnerabilities requiring an already-compromised machine (e.g. malicious
  `node_modules`, tampered PATH).

If in doubt, report anyway — we would rather triage a borderline report than
miss a real issue.
