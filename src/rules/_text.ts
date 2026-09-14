import type { CheerioAPI } from 'cheerio';

/** Elements that never carry citable page content. */
const NON_CONTENT = 'script, style, nav, header, footer, noscript, svg, template, iframe';

/**
 * Visible body text with non-content elements stripped, whitespace-normalized.
 * Works on a clone so the parsed document is never mutated.
 */
export function visibleText($: CheerioAPI): string {
  const body = $('body');
  const clone = body.length > 0 ? body.clone() : $.root().children().clone();
  clone.find(NON_CONTENT).remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

/** Word count of {@link visibleText}. */
export function wordCount($: CheerioAPI): number {
  const text = visibleText($);
  return text === '' ? 0 : text.split(/\s+/).length;
}
