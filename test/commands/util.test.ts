import { describe, expect, it } from 'vitest';
import { formatTable, normalizeUrl, runPool } from '../../src/commands/util.js';

describe('normalizeUrl', () => {
  it('prepends https:// to bare hostnames', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('keeps explicit http/https schemes', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
    expect(normalizeUrl('https://example.com/x')).toBe('https://example.com/x');
  });

  it('treats host:port as a hostname, not a scheme', () => {
    expect(normalizeUrl('example.com:8443/a')).toBe('https://example.com:8443/a');
    // Loopback dev servers almost never serve TLS — default them to http.
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeUrl('127.0.0.1:8080/a')).toBe('http://127.0.0.1:8080/a');
  });

  it('rejects non-http(s) schemes and garbage', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(/unsupported URL scheme/);
    expect(() => normalizeUrl('mailto:a@b.c')).toThrow(/unsupported URL scheme/);
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(/unsupported URL scheme/);
    expect(() => normalizeUrl('not a url')).toThrow(/invalid URL/);
    expect(() => normalizeUrl('   ')).toThrow(/empty/);
  });
});

describe('runPool', () => {
  it('drains the queue with bounded concurrency', async () => {
    const queue = [1, 2, 3, 4, 5];
    const done: number[] = [];
    await runPool(queue, 2, async (n) => {
      done.push(n);
    });
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('processes items workers push onto the queue (BFS)', async () => {
    const queue = [1];
    const done: number[] = [];
    await runPool(queue, 3, async (n) => {
      done.push(n);
      if (n === 1) {
        queue.push(2, 3);
      }
      if (n === 2) {
        queue.push(4);
      }
    });
    expect(done.sort()).toEqual([1, 2, 3, 4]);
  });

  it('never exceeds the concurrency limit', async () => {
    const queue = Array.from({ length: 20 }, (_, i) => i);
    let active = 0;
    let peak = 0;
    await runPool(queue, 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe('formatTable', () => {
  it('pads columns and renders a separator', () => {
    const out = formatTable(
      ['ID', 'TITLE'],
      [
        ['a/b', 'short'],
        ['a/longer-id', 'title here'],
      ],
    );
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('ID');
    expect(lines[2]).toContain('a/b');
    expect(lines[3]).toContain('a/longer-id');
  });
});
