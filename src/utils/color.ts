import { styleText } from 'node:util';

type Style = Parameters<typeof styleText>[0];

const enabled = () => {
  if (process.env.NO_COLOR || process.env.FORCE_COLOR === '0') {
    return false;
  }
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') {
    return true;
  }
  return process.stdout.isTTY === true;
};

/** Tiny color helper — zero deps. Falls back to plain text when not a TTY. */
export function c(text: string, ...styles: Style[]): string {
  if (!enabled()) {
    return text;
  }
  let out = text;
  for (const s of styles) {
    out = styleText(s, out);
  }
  return out;
}

export const paint = {
  error: (t: string) => c(t, 'red'),
  warn: (t: string) => c(t, 'yellow'),
  info: (t: string) => c(t, 'cyan'),
  ok: (t: string) => c(t, 'green'),
  dim: (t: string) => c(t, 'dim'),
  bold: (t: string) => c(t, 'bold'),
};
