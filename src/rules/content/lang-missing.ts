import type { Rule } from '../../core/types.js';

export const langMissingRule: Rule = {
  id: 'content/lang-missing',
  category: 'content',
  title: 'html lang attribute',
  description:
    'The lang attribute tells AI systems (and translation layers inside them) which language the content is in — a basic signal for correct citation and answer localization.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const lang = ctx.$('html').attr('lang');
    if (lang && lang.trim() !== '') {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'The <html> element has no lang attribute',
        detail: 'Without a declared language, engines must infer it — and can get it wrong.',
        fix: 'Add lang to the root element, e.g. <html lang="en">.',
      },
    ];
  },
};
