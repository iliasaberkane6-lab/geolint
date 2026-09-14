import type { Rule } from '../../core/types.js';

/** Emerging AI-facing manifest conventions beyond llms.txt. */
const CANDIDATES = ['/agents.json', '/ai.txt', '/.well-known/ai-plugin.json'] as const;

/** A JSON manifest should actually parse; a 200 HTML fallback page should not count. */
function looksReal(path: string, body: string): boolean {
  const trimmed = body.trimStart();
  if (trimmed === '' || trimmed.startsWith('<')) {
    return false; // SPA/404 fallback page
  }
  if (path.endsWith('.json')) {
    try {
      JSON.parse(trimmed);
    } catch {
      return false;
    }
  }
  return true;
}

export const aiManifestRule: Rule = {
  id: 'llms-txt/ai-manifest',
  category: 'llms-txt',
  title: 'Emerging AI manifest files (agents.json, ai.txt)',
  description:
    'Beyond llms.txt, conventions like /agents.json, /ai.txt and /.well-known/ai-plugin.json are proposed ways to declare AI-facing metadata. None is settled — presence is worth knowing about, absence is not a defect.',
  severity: 'info',
  async check(ctx) {
    let origin: string;
    try {
      origin = new URL(ctx.finalUrl).origin;
    } catch {
      return [];
    }

    const found: string[] = [];
    let aborted = false;
    for (const path of CANDIDATES) {
      try {
        const res = await ctx.fetchPage(`${origin}${path}`);
        if (res.status < 400 && looksReal(path, res.html)) {
          found.push(path);
        }
      } catch {
        // Timeout/budget exhaustion is not evidence of absence — stop probing.
        aborted = true;
        break;
      }
    }

    if (found.length > 0) {
      return [
        {
          severity: 'info',
          message: `Emerging AI manifest file${found.length > 1 ? 's' : ''} detected: ${found.join(', ')}`,
          detail:
            'These conventions have no settled spec yet — they neither help nor hurt citations today, but their contents should be intentional rather than forgotten leftovers.',
          fix: 'Verify the manifest contents are accurate and current; /llms.txt remains the broadly recognized file to invest in.',
          evidence: found.join('\n'),
        },
      ];
    }
    if (aborted) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: 'No emerging AI manifest files found',
        detail: `Checked ${CANDIDATES.join(', ')} — all absent. These conventions are early and entirely optional.`,
        fix: 'Prioritize /llms.txt; add agents.json or ai.txt only if they fit your AI distribution strategy.',
      },
    ];
  },
};
