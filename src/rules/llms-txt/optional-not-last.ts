import type { Rule, RuleFinding } from '../../core/types.js';

export const optionalNotLastRule: Rule = {
  id: 'llms-txt/optional-not-last',
  category: 'llms-txt',
  title: 'Optional section comes last in llms.txt',
  description:
    'The llms.txt convention defines an "## Optional" section whose links context-limited clients may skip — it only works as the final section.',
  severity: 'info',
  check(ctx) {
    const parsed = ctx.llmsTxt?.parsed;
    if (!parsed) {
      return [];
    }
    const idx = parsed.sections.findIndex((s) => s.heading.trim().toLowerCase() === 'optional');
    if (idx !== -1 && idx !== parsed.sections.length - 1) {
      return [
        {
          severity: 'info',
          message: 'The "## Optional" section is not the last section',
          fix: 'Move the Optional section to the end of llms.txt.',
          evidence: `Optional is section ${idx + 1} of ${parsed.sections.length}`,
        },
      ];
    }
    return [];
  },
};
