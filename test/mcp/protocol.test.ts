import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { AI_BOTS } from '../../src/core/bots.js';
import { VERSION } from '../../src/core/types.js';
import { createGeolintServer } from '../../src/mcp/server.js';
import { DEFAULT_HTML, withFixtureServer } from '../helpers.js';

const OPEN_ROBOTS = `User-agent: *
Allow: /
`;

/** Wire a Client to a fresh geolint server over a linked in-memory pair. */
async function linkedClient(): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createGeolintServer({ callTimeoutMs: 10_000 });
  const client = new Client({ name: 'geolint-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await Promise.all([client.close(), server.close()]);
    },
  };
}

describe('MCP protocol', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('initialize → tools/list → tools/call list_ai_bots', async () => {
    const { client, close } = await linkedClient();
    cleanup = close;

    // initialize already ran inside connect(); verify server identity.
    expect(client.getServerVersion()?.name).toBe('geolint');
    expect(client.getServerVersion()?.version).toBe(VERSION);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'audit_url',
      'compare_urls',
      'generate_llms_txt',
      'list_ai_bots',
      'list_rules',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
    }

    const res = await client.callTool({ name: 'list_ai_bots', arguments: {} });
    const { bots } = res.structuredContent as { bots: { token: string }[] };
    expect(bots).toHaveLength(AI_BOTS.length);
    expect(bots.some((b) => b.token === 'GPTBot')).toBe(true);
  });

  it('tools/call list_rules honours the category argument', async () => {
    const { client, close } = await linkedClient();
    cleanup = close;
    const res = await client.callTool({
      name: 'list_rules',
      arguments: { category: 'technical' },
    });
    const { rules } = res.structuredContent as { rules: { category: string }[] };
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.category).toBe('technical');
    }
  });

  it('tools/call audit_url round-trips a real scan', async () => {
    const { client, close } = await linkedClient();
    cleanup = close;
    await withFixtureServer(
      [
        { path: '/', body: DEFAULT_HTML },
        { path: '/robots.txt', body: OPEN_ROBOTS, headers: { 'content-type': 'text/plain' } },
      ],
      async (origin) => {
        const res = await client.callTool({ name: 'audit_url', arguments: { url: origin } });
        expect(res.isError).toBeUndefined();
        const p = res.structuredContent as {
          score: number;
          grade: string;
          counts: { errors: number };
          findings: unknown[];
        };
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(100);
        expect(Array.isArray(p.findings)).toBe(true);
      },
    );
  });

  it('tools/call audit_url surfaces invalid input as an error, not a crash', async () => {
    const { client, close } = await linkedClient();
    cleanup = close;
    const res = await client.callTool({
      name: 'audit_url',
      arguments: { url: 'not a url' },
    });
    expect(res.isError).toBe(true);
  });
});
