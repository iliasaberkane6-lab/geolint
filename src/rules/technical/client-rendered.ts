import type { Rule } from '../../core/types.js';
import { wordCount } from '../_text.js';

/** Typical SPA mount-point markers in the raw HTML shell. */
const SPA_SHELL_RE = /id=["'](?:root|app|__next|__nuxt)["']|data-reactroot|ng-app\b/i;

export const clientRenderedRule: Rule = {
  id: 'technical/client-rendered',
  category: 'technical',
  title: 'Content in the initial HTML',
  description:
    'AI crawlers do not execute JavaScript. A client-rendered page serves them an empty shell — no text, no facts, nothing to cite. Content must exist in the initial HTML.',
  severity: 'error',
  check(ctx) {
    if (!ctx.page || !ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const words = wordCount($);
    const bodyHtml = $('body').html() ?? '';
    const spaShell = SPA_SHELL_RE.test(bodyHtml);

    if (words >= 50 && !(spaShell && words < 100)) {
      return [];
    }
    return [
      {
        severity: 'error',
        message: 'Page appears client-rendered — AI crawlers see an empty shell',
        detail: spaShell
          ? `A JS mount point (id="root"/"app"/"__next"…) is present but only ~${words} words of text shipped in the HTML. Crawlers without a JS engine get almost nothing.`
          : `Only ~${words} words of visible text in the initial HTML — likely rendered client-side.`,
        fix: 'Use server-side rendering, static generation or prerendering so the real content is in the first HTML response.',
        evidence: `${words} words of visible text`,
      },
    ];
  },
};
