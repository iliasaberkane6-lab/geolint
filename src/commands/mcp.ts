import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGeolintServer } from '../mcp/server.js';

/**
 * `geolint mcp` — run the MCP server on stdio. stdout carries JSON-RPC
 * frames only; incidental logging goes to stderr.
 */
export async function runMcpServer(opts: { timeout?: number } = {}): Promise<void> {
  const server = createGeolintServer({ callTimeoutMs: opts.timeout });
  await server.connect(new StdioServerTransport());
  console.error('geolint mcp: server listening on stdio');
}
