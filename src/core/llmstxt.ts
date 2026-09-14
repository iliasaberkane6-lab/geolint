import { fetchPage } from './fetch.js';
import type { LlmsTxtData, LlmsTxtParsed, LlmsTxtSection, ResolvedScanOptions } from './types.js';

/**
 * Parse a llms.txt file per llmstxt.org conventions:
 * - exactly one H1 (# Title) — required
 * - an optional blockquote summary (> ...)
 * - optional freeform markdown
 * - H2 sections (## Name) containing markdown link lists
 */
export function parseLlmsTxt(raw: string): LlmsTxtParsed {
  const lines = raw.split(/\r?\n/);
  let title: string | null = null;
  const summaryParts: string[] = [];
  const sections: LlmsTxtSection[] = [];
  let current: LlmsTxtSection | null = null;
  let linkCount = 0;

  const linkRe = /\[([^\]]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"[^"]*")?\)/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      if (title === null) {
        title = trimmed.slice(2).trim();
      }
      continue;
    }
    if (trimmed.startsWith('## ')) {
      current = { heading: trimmed.slice(3).trim(), links: [] };
      sections.push(current);
      continue;
    }
    if (trimmed.startsWith('>')) {
      summaryParts.push(trimmed.slice(1).trim());
      continue;
    }
    linkRe.lastIndex = 0;
    for (const m of trimmed.matchAll(linkRe)) {
      linkCount++;
      if (current && m[1] !== undefined && m[2] !== undefined) {
        current.links.push({ text: m[1], url: m[2] });
      }
    }
  }

  return {
    title,
    summary: summaryParts.length ? summaryParts.join(' ') : null,
    sections,
    linkCount,
  };
}

export async function fetchLlmsTxt(
  origin: string,
  options: ResolvedScanOptions,
): Promise<LlmsTxtData> {
  const url = `${origin}/llms.txt`;
  try {
    const page = await fetchPage(url, options);
    if (page.status >= 200 && page.status < 300) {
      return { url, status: page.status, raw: page.html, parsed: parseLlmsTxt(page.html) };
    }
    return { url, status: page.status, raw: null, parsed: null };
  } catch {
    return { url, status: 0, raw: null, parsed: null };
  }
}
