import { c } from '../utils/color.js';
import type { RenderOptions } from './index.js';

/**
 * Reporter toolkit — hand-rolled, zero-dep text layout helpers.
 * All width math is ANSI-aware: escape sequences occupy zero cells.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI SGR sequences are exactly what we strip
export const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/** Visible cell width of a (possibly styled) string. */
export function visLen(text: string): number {
  return stripAnsi(text).length;
}

export function padEndVis(text: string, width: number): string {
  const gap = width - visLen(text);
  return gap > 0 ? text + ' '.repeat(gap) : text;
}

export function padStartVis(text: string, width: number): string {
  const gap = width - visLen(text);
  return gap > 0 ? ' '.repeat(gap) + text : text;
}

/**
 * Flatten whitespace, strip control sequences and truncate to `width`
 * visible chars (ellipsis when cut). For untrusted/plain text only —
 * styling is stripped on purpose (evidence, messages from pages).
 */
export function clip(text: string, width: number): string {
  const flat = stripAnsi(text).replace(/\s+/g, ' ').trim();
  return visLen(flat) <= width ? flat : `${flat.slice(0, Math.max(0, width - 1))}…`;
}

export interface Column {
  /** Header cell; omit/undefined for a headerless column. */
  header?: string;
  align?: 'left' | 'right';
  /** Max visible width — overflowing cells are clipped. */
  max?: number;
}

/**
 * Render a plain-text table: computes per-column widths from headers +
 * cells, pads ANSI-aware, trims trailing whitespace on every line.
 */
export function renderTable(columns: Column[], rows: string[][], gap = '   '): string[] {
  const widths = columns.map((col, i) => {
    let w = col.header === undefined ? 0 : visLen(col.header);
    for (const row of rows) {
      w = Math.max(w, Math.min(visLen(row[i] ?? ''), col.max ?? Number.MAX_SAFE_INTEGER));
    }
    return w;
  });

  const fmtCell = (raw: string | undefined, i: number): string => {
    const col = columns[i]!;
    const cell = raw ?? '';
    const clipped =
      visLen(cell) <= (col.max ?? Number.MAX_SAFE_INTEGER) ? cell : clip(cell, col.max!);
    if (i === columns.length - 1 && col.align !== 'right') {
      return clipped;
    }
    return col.align === 'right'
      ? padStartVis(clipped, widths[i]!)
      : padEndVis(clipped, widths[i]!);
  };

  const fmtRow = (cells: (string | undefined)[]): string =>
    cells
      .map((cell, i) => fmtCell(cell, i))
      .join(gap)
      .replace(/\s+$/, '');

  const lines: string[] = [];
  if (columns.some((col) => col.header !== undefined)) {
    lines.push(fmtRow(columns.map((col) => col.header)));
  }
  for (const row of rows) {
    lines.push(fmtRow(row));
  }
  return lines;
}

/** Greedy word-wrap producing lines of at most `width` visible chars. */
export function wrapText(text: string, width: number, indent = ''): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = indent;
  for (const word of words) {
    const sep = visLen(cur) > indent.length ? 1 : 0;
    if (visLen(cur) + sep + word.length > width && cur !== indent) {
      lines.push(cur);
      cur = indent + word;
    } else {
      cur += (sep ? ' ' : '') + word;
    }
  }
  if (cur !== indent || lines.length === 0) {
    lines.push(cur);
  }
  return lines;
}

export type StyleName =
  | 'bold'
  | 'dim'
  | 'italic'
  | 'underline'
  | 'red'
  | 'green'
  | 'yellow'
  | 'cyan'
  | 'gray'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'cyanBright';

/** SGR codes mirroring util.styleText — used to force color on non-TTY. */
const ANSI_CODES: Record<StyleName, [number, number]> = {
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  cyan: [36, 39],
  gray: [90, 39],
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  cyanBright: [96, 39],
};

export type Paint = (text: string, ...styles: StyleName[]) => string;

/**
 * Painter honoring RenderOptions.color:
 *   false     → plain text
 *   true      → force ANSI even on non-TTY
 *   undefined → auto (TTY detection + NO_COLOR via utils/color)
 */
export function makePaint(opts: RenderOptions = {}): Paint {
  if (opts.color === false) {
    return (text) => text;
  }
  if (opts.color === true) {
    return (text, ...styles) => {
      let out = text;
      for (const style of styles) {
        const [open, close] = ANSI_CODES[style];
        out = `\x1b[${open}m${out}\x1b[${close}m`;
      }
      return out;
    };
  }
  return (text, ...styles) => c(text, ...styles);
}

/** Final render pass — guarantees zero ANSI when color is explicitly off. */
export function finish(text: string, opts: RenderOptions): string {
  return opts.color === false ? stripAnsi(text) : text;
}
