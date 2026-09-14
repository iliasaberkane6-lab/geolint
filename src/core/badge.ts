import type { Grade } from './types.js';

/**
 * Grade → shields.io named color. Same severity ladder as the terminal
 * reporter (A best → F worst); #97ca00 is what shields calls 'green'.
 */
const GRADE_NAMED_COLOR: Record<Grade, string> = {
  A: 'brightgreen',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

/** Hex equivalents of GRADE_NAMED_COLOR for the self-contained SVG. */
const GRADE_HEX_COLOR: Record<Grade, string> = {
  A: '#4c1',
  B: '#97ca00',
  C: '#dfb317',
  D: '#fe7d37',
  F: '#e05d44',
};

/** Dark grey used for the label segment, same as shields' default. */
const LABEL_BG = '#555';
const DEFAULT_LABEL = 'geolint';
const REPO_URL = 'https://github.com/iliasaberkane6-lab/geolint';

/** Escape the five XML special chars for use in text nodes and attributes. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The value-segment text shared by the SVG, endpoint JSON and static URL. */
function badgeMessage(score: number, grade: Grade): string {
  return `${Math.round(score)}/100 · ${grade}`;
}

/**
 * Rough Verdana-11px text width estimate, same heuristic shields uses for
 * badges without access to a font engine: ~6.5px per char + 10px padding.
 */
function segmentWidth(text: string): number {
  return Math.round(text.length * 6.5) + 10;
}

/**
 * Self-contained shields.io-style flat SVG badge: dark label segment on the
 * left, score+grade segment on the right colored by grade. Coordinates use
 * shields' scale(.1) trick — font-size 110 at 10% ≈ 11px Verdana.
 */
export function badgeSvg(score: number, grade: Grade, label = DEFAULT_LABEL): string {
  const message = badgeMessage(score, grade);
  const left = escapeXml(label);
  const right = escapeXml(message);
  const leftWidth = segmentWidth(label);
  const rightWidth = segmentWidth(message);
  const width = leftWidth + rightWidth;
  const leftCenter = Math.round((leftWidth / 2) * 10);
  const rightCenter = Math.round((leftWidth + rightWidth / 2) * 10);
  const leftTextLength = (leftWidth - 10) * 10;
  const rightTextLength = (rightWidth - 10) * 10;
  const title = `${left}: ${right}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    '<linearGradient id="s" x2="0" y2="100%">',
    '<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>',
    '<stop offset="1" stop-opacity=".1"/>',
    '</linearGradient>',
    '<clipPath id="r">',
    `<rect width="${width}" height="20" rx="3" fill="#fff"/>`,
    '</clipPath>',
    '<g clip-path="url(#r)">',
    `<rect width="${leftWidth}" height="20" fill="${LABEL_BG}"/>`,
    `<rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${GRADE_HEX_COLOR[grade]}"/>`,
    `<rect width="${width}" height="20" fill="url(#s)"/>`,
    '</g>',
    '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">',
    `<text aria-hidden="true" x="${leftCenter}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${leftTextLength}">${left}</text>`,
    `<text x="${leftCenter}" y="140" transform="scale(.1)" fill="#fff" textLength="${leftTextLength}">${left}</text>`,
    `<text aria-hidden="true" x="${rightCenter}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${rightTextLength}">${right}</text>`,
    `<text x="${rightCenter}" y="140" transform="scale(.1)" fill="#fff" textLength="${rightTextLength}">${right}</text>`,
    '</g>',
    '</svg>',
  ].join('');
}

/**
 * shields.io endpoint-schema JSON: serve this file (committed or via gist)
 * and point https://img.shields.io/endpoint?url=<raw-url> at it for a live,
 * CI-regenerated badge.
 */
export function shieldsEndpointJson(score: number, grade: Grade): string {
  const endpoint = {
    schemaVersion: 1,
    label: DEFAULT_LABEL,
    message: badgeMessage(score, grade),
    color: GRADE_NAMED_COLOR[grade],
  };
  return `${JSON.stringify(endpoint, null, 2)}\n`;
}

/**
 * shields path-segment encoding: escape '-' → '--' and '_' → '__', turn
 * spaces into '_', then URI-encode everything else (e.g. '/' → %2F).
 */
function shieldsEncode(text: string): string {
  return encodeURIComponent(text.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_'));
}

/** Static shields.io badge URL with the score baked in — instant, but stale. */
function shieldsStaticBadgeUrl(score: number, grade: Grade): string {
  const message = shieldsEncode(badgeMessage(score, grade));
  return `https://img.shields.io/badge/${DEFAULT_LABEL}-${message}-${GRADE_NAMED_COLOR[grade]}`;
}

/**
 * README-ready markdown for the badge. `imageUrl` overrides the image (e.g.
 * a committed 'geolint-badge.svg' or a shields endpoint URL); `linkUrl`
 * overrides the click target (defaults to the geolint repo).
 */
export function badgeMarkdown(
  score: number,
  grade: Grade,
  opts: { imageUrl?: string; linkUrl?: string } = {},
): string {
  const image = opts.imageUrl ?? shieldsStaticBadgeUrl(score, grade);
  const link = opts.linkUrl ?? REPO_URL;
  return `[![${DEFAULT_LABEL}](${image})](${link})`;
}
