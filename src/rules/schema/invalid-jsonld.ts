import { extractJsonLd } from '../../core/schema.js';
import type { Rule, RuleFinding } from '../../core/types.js';

export const invalidJsonLdRule: Rule = {
  id: 'schema/invalid-jsonld',
  category: 'schema',
  title: 'JSON-LD blocks parse',
  description:
    'A malformed JSON-LD block is worse than none: parsers skip it entirely and may distrust the rest of the markup. Broken structured data = invisible structured data.',
  severity: 'error',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const findings: RuleFinding[] = [];
    for (const block of extractJsonLd(ctx.$)) {
      if (!block.parseError) {
        continue;
      }
      findings.push({
        severity: 'error',
        message: 'A JSON-LD block contains invalid JSON',
        detail: `Parse error: ${block.parseError}. The whole block is ignored by consumers.`,
        fix: 'Validate the JSON-LD (e.g. validator.schema.org) — common culprits are trailing commas, single quotes and unescaped characters.',
        evidence: block.raw.slice(0, 120),
      });
    }
    return findings;
  },
};
