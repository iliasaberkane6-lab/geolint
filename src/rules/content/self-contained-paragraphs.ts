import type { Rule } from '../../core/types.js';

/** Only substantial paragraphs are sampled — short lines are often intentional. */
const MIN_PARAGRAPH_WORDS = 15;
const SAMPLE_SIZE = 8;
const MIN_SAMPLED = 4;
/** Flag when more than half the sampled paragraphs lean on earlier context. */
const MAX_DEPENDENT_RATIO = 0.5;
const CHROME_ANCESTORS = 'nav, aside, form, blockquote';

/**
 * Openers that only make sense with preceding context — a RAG chunk starting
 * like this is detached from whatever it refers to.
 */
const DEPENDENT_OPENER_RE =
  /^(as (mentioned|noted|seen|shown|discussed|described|explained|covered) (above|earlier|before|previously|in (the|a) previous)|as (we|i) (saw|discussed|noted|mentioned|explained|described)|that (said|being said)|having said that|building on (that|this|the above)|for this (reason|approach|purpose)|to do (this|that|so)|in doing so|doing so)\b/i;

/** A paragraph that opens on a bare pronoun/demonstrative refers back by construction. */
const PRONOUN_OPENER_RE = /^(this|it|these|those|they|such|its|their|he|she)\b/i;

export const selfContainedParagraphsRule: Rule = {
  id: 'content/self-contained-paragraphs',
  category: 'content',
  title: 'Paragraphs are self-contained',
  description:
    'Answer engines quote individual chunks, not whole pages. Paragraphs that open with "as mentioned above" or a bare pronoun lose their meaning when lifted out of context — self-contained paragraphs survive extraction.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const sampled: string[] = [];
    $('p').each((_, el) => {
      if (sampled.length >= SAMPLE_SIZE) {
        return false;
      }
      const node = $(el);
      if (node.parents(CHROME_ANCESTORS).length > 0) {
        return;
      }
      const text = node.text().replace(/\s+/g, ' ').trim();
      if (text.split(/\s+/).length >= MIN_PARAGRAPH_WORDS) {
        sampled.push(text);
      }
      return;
    });

    if (sampled.length < MIN_SAMPLED) {
      return [];
    }
    const dependent = sampled.filter(
      (t) => DEPENDENT_OPENER_RE.test(t) || PRONOUN_OPENER_RE.test(t),
    );
    if (dependent.length / sampled.length <= MAX_DEPENDENT_RATIO) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: `${dependent.length} of ${sampled.length} sampled paragraphs depend on earlier context`,
        detail:
          'Openers like "this approach" or "as noted above" refer to text the engine may never see — each paragraph should restate its subject.',
        fix: 'Rewrite paragraph openers so each names its subject explicitly (e.g. "The caching layer…" instead of "This layer…").',
        evidence: dependent[0]!.slice(0, 120),
      },
    ];
  },
};
