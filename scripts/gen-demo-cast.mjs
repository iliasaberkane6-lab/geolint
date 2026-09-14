#!/usr/bin/env node
/**
 * Generate a synthetic asciinema cast for the demo GIF:
 * types the command with a typewriter effect, streams the real CLI output
 * (bot matrix condensed for height, marked with an ellipsis line),
 * then holds on the final frame.
 *
 * Usage:
 *   FORCE_COLOR=1 node dist/cli.js check localhost:4173 --ignore technical/https > /tmp/geolint-out.txt
 *   node scripts/gen-demo-cast.mjs /tmp/geolint-out.txt /tmp/geolint-demo.cast
 *   agg /tmp/geolint-demo.cast media/demo.gif --cols 120 --rows 40 --font-size 15
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , outFile = '/tmp/geolint-out.txt', castFile = '/tmp/geolint-demo.cast'] = process.argv;
const allLines = readFileSync(outFile, 'utf8').split('\n').slice(0, -1);

// Condense the AI CRAWLER ACCESS matrix: keep its header + the first
// `keep` vendor rows, replace the rest with a marked ellipsis.
// Match markers on ANSI-stripped text — headings carry style codes.
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape matching is the point
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const matrixStart = allLines.findIndex((l) => strip(l).includes('AI CRAWLER ACCESS'));
const findingsStart = allLines.findIndex((l) => strip(l).trimStart().startsWith('FINDINGS'));
const KEEP_MATRIX_ROWS = 15;
let lines;
if (
  matrixStart !== -1 &&
  findingsStart !== -1 &&
  findingsStart - matrixStart > KEEP_MATRIX_ROWS + 2
) {
  const kept = allLines.slice(0, matrixStart + KEEP_MATRIX_ROWS);
  const droppedLines = allLines.slice(matrixStart + KEEP_MATRIX_ROWS, findingsStart);
  const droppedBots = droppedLines.filter((l) => /[✓✗–]/.test(strip(l))).length;
  lines = [
    ...kept,
    `      … +${droppedBots} more (run: geolint bots)`,
    '',
    ...allLines.slice(findingsStart),
  ];
} else {
  lines = allLines;
}

const COMMAND = 'geolint check localhost:4173 --ignore technical/https';
const WIDTH = 120;
// Terminal tall enough that nothing scrolls — the whole report stays visible.
const HEIGHT = lines.length + 3;

const events = [];
let t = 0.3;
const push = (at, data) => events.push([Number(at.toFixed(3)), 'o', data]);

push(t, '$ ');
for (const ch of COMMAND) {
  t += 0.045 + Math.random() * 0.03;
  push(t, ch);
}
t += 0.4;
push(t, '\r\n');
t += 0.3;

for (const line of lines) {
  push(t, `${line}\r\n`);
  t += 0.03;
}

t += 4.5;

const header = {
  version: 2,
  width: WIDTH,
  height: HEIGHT,
  timestamp: Math.floor(Date.now() / 1000),
  env: { TERM: 'xterm-256color', SHELL: '/bin/zsh' },
};

const cast = `${[JSON.stringify(header), ...events.map((e) => JSON.stringify(e))].join('\n')}\n`;
writeFileSync(castFile, cast);
console.log(
  `wrote ${castFile} (${events.length} events, ${t.toFixed(1)}s, ${WIDTH}x${HEIGHT}, ${lines.length} lines)`,
);
