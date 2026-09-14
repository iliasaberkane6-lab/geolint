# geolint MCP server

`geolint mcp` starts a [Model Context Protocol](https://modelcontextprotocol.io)
server over stdio, exposing geolint's AI-search audit engine to MCP clients such
as Claude Desktop, Cursor, VS Code and Windsurf. The same five tools power every
client configuration below.

The server speaks JSON-RPC on stdout only — all diagnostics go to stderr, so it
is safe to run under any stdio-compatible client. Every tool call is capped by a
wall-clock timeout (default 60 s) so a hung site cannot stall the client.

## Tools

| Tool | Description |
| --- | --- |
| `audit_url` | Audit a URL: GEO score (0–100), grade, per-category scores and findings sorted by severity. |
| `generate_llms_txt` | Crawl a site and generate a spec-conformant `llms.txt` document. |
| `list_rules` | List the audit rules, optionally filtered by category. |
| `list_ai_bots` | List known AI crawler/fetcher tokens with vendor, purpose and documented robots.txt behavior. |
| `compare_urls` | Audit two URLs and report the score delta plus added/resolved findings. |

### `audit_url`

| Argument | Type | Notes |
| --- | --- | --- |
| `url` | string | **Required.** `https://…` or a bare hostname. |
| `timeout` | number | Per-request fetch timeout in ms. |
| `category` | string[] | Only run these categories: `ai-crawler`, `llms-txt`, `schema`, `content`, `technical`. |
| `only` | string[] | Only run these rule ids. |
| `ignore` | string[] | Skip these rule ids. |
| `maxFindings` | number | Max findings returned — default 20, clamped to 1–100. |

Returns `structuredContent` with `url`, `finalUrl`, `score`, `grade`,
`counts {errors, warnings, info}`, `categories [{category, label, score, max}]`,
`findings [{ruleId, severity, title, message, detail?}]` (errors first, capped at
`maxFindings`) and `truncated`. A compact text summary is included in `content`.

### `generate_llms_txt`

| Argument | Type | Notes |
| --- | --- | --- |
| `url` | string | **Required.** Site URL to crawl. |
| `maxPages` | number | Max pages to crawl — default 30, clamped to 1–100. |
| `timeout` | number | Per-request fetch timeout in ms. |

Returns the generated `llms.txt` as text content plus `structuredContent`
`{url, markdown, pageCount}`.

### `list_rules`

| Argument | Type | Notes |
| --- | --- | --- |
| `category` | string | Optional category filter (one of the five categories above). |

Returns `structuredContent` `{rules: [{id, category, severity, title, description}]}`.

### `list_ai_bots`

No arguments. Returns `structuredContent`
`{bots: [{token, vendor, purpose, robotsTxt, retired}]}` — `purpose` is one of
`training`, `search`, `user-fetch`, `mixed`; `robotsTxt` is the vendor-documented
posture (`honored`, `bypass`, `unverified`).

### `compare_urls`

| Argument | Type | Notes |
| --- | --- | --- |
| `urlA` | string | **Required.** Baseline URL. |
| `urlB` | string | **Required.** Candidate URL. |
| `timeout` | number | Per-request fetch timeout in ms. |

Scans both URLs and returns `structuredContent`
`{a: {url, score, grade}, b: {url, score, grade}, delta, added, resolved}` —
`added` lists findings present in B but not A (capped at 20), `resolved` lists
findings that disappeared (capped at 20).

## Client configuration

All configurations launch the published package with `npx`. For a local dev
install (`npm link` / `npm i -g` from this repo) the equivalent command is
`geolint mcp`.

### Claude Desktop

Add to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "geolint": {
      "command": "npx",
      "args": ["-y", "@iliasabk/geolint", "mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "geolint": {
      "command": "npx",
      "args": ["-y", "@iliasabk/geolint", "mcp"]
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` in the workspace (or the `mcp` section of user
settings):

```json
{
  "servers": {
    "geolint": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@iliasabk/geolint", "mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "geolint": {
      "command": "npx",
      "args": ["-y", "@iliasabk/geolint", "mcp"]
    }
  }
}
```

## Local development

```bash
npm run build
node dist/cli.js mcp        # stdio server; speaks JSON-RPC only
npx tsx src/cli.ts mcp      # without building
```

To probe the server by hand, pipe a framed JSON-RPC message into it:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  | node dist/cli.js mcp
```

The response is a single JSON-RPC frame on stdout; a startup line on stderr is
expected and harmless.
