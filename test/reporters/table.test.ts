import { describe, expect, it } from 'vitest';
import {
  clip,
  makePaint,
  padEndVis,
  padStartVis,
  renderTable,
  stripAnsi,
  visLen,
  wrapText,
} from '../../src/reporters/table.js';

describe('table utils', () => {
  it('measures visible length ignoring ANSI escapes', () => {
    expect(visLen('\x1b[31mabc\x1b[39m')).toBe(3);
    expect(stripAnsi('\x1b[31mabc\x1b[39m')).toBe('abc');
  });

  it('pads ANSI-styled cells to a visible width', () => {
    const styled = '\x1b[31m✗\x1b[39m';
    expect(stripAnsi(padEndVis(styled, 5))).toBe('✗    ');
    expect(stripAnsi(padStartVis(styled, 5))).toBe('    ✗');
  });

  it('clips long text with an ellipsis and flattens whitespace', () => {
    expect(clip('hello   world', 20)).toBe('hello world');
    expect(clip('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`);
    expect(clip('line\nbreak', 20)).toBe('line break');
  });

  it('renders an aligned table with headers', () => {
    const lines = renderTable(
      [{ header: 'NAME' }, { header: 'SCORE', align: 'right' }],
      [
        ['alpha', '10'],
        ['beta-long', '7'],
      ],
      '  ',
    );
    expect(lines).toEqual(['NAME       SCORE', 'alpha         10', 'beta-long      7']);
  });

  it('wraps text greedily under a width', () => {
    const lines = wrapText('aa bb cc dd ee', 5);
    expect(lines).toEqual(['aa bb', 'cc dd', 'ee']);
  });

  it('makePaint honors the color option', () => {
    expect(makePaint({ color: false })('x', 'red')).toBe('x');
    expect(makePaint({ color: true })('x', 'red')).toBe('\x1b[31mx\x1b[39m');
    // auto mode on non-TTY stays plain
    expect(makePaint({})('x', 'red')).toBe('x');
  });
});
