import type { Rule, RuleFinding } from '../../core/types.js';

const HTML_RE = /^\s*<(!doctype|html)\b/i;

export const invalidStructureRule: Rule = {
  id: 'llms-txt/invalid-structure',
  category: 'llms-txt',
  title: 'llms.txt is valid markdown with an H1',
  description:
    'The llms.txt spec requires a markdown file that starts with an H1 project name. An empty file or an HTML fallback page (common with SPA rewrites) is useless to AI consumers.',
  severity: 'warn',
  check(ctx) {
    const lt = ctx.llmsTxt;
    if (!lt || lt.raw == null) {
      return [];
    }
    const findings: RuleFinding[] = [];

    if (HTML_RE.test(lt.raw)) {
      findings.push({
        severity: 'warn',
        message: 'llms.txt serves HTML instead of markdown',
        detail:
          'The response looks like an HTML page — likely an SPA or 404 fallback rewrite. AI consumers expect plain markdown.',
        fix: 'Serve real markdown at /llms.txt and exclude it from HTML fallback/rewrite rules.',
        evidence: lt.raw.trim().slice(0, 120),
      });
      return findings;
    }

    if (lt.raw.trim() === '') {
      findings.push({
        severity: 'warn',
        message: 'llms.txt is empty',
        detail: 'The file exists but contains no content for AI systems to consume.',
        fix: 'Fill /llms.txt with an H1 title, a blockquote summary and ## link sections.',
      });
      return findings;
    }

    if (lt.parsed === null || lt.parsed.title === null) {
      findings.push({
        severity: 'warn',
        message: 'llms.txt has no H1 title',
        detail:
          'The spec requires a single H1 ("# Project name") as the first element; without it parsers cannot identify the site.',
        fix: 'Start /llms.txt with a single H1 line naming the site or project.',
        evidence: lt.raw.trim().split('\n')[0]?.slice(0, 120),
      });
    }
    return findings;
  },
};
