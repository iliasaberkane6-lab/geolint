import { extractJsonLd } from '../../core/schema.js';
import type { Rule, RuleFinding } from '../../core/types.js';

type JsonObject = Record<string, unknown>;

/**
 * Per-type field expectations for the non-article citability types.
 * `required` properties must each exist; every `anyOf` group needs at least
 * one of its properties. Article-family types are intentionally absent —
 * schema/missing-article-fields owns them.
 */
const EXPECTED: Record<string, { required: string[]; anyOf: string[][] }> = {
  faqpage: { required: [], anyOf: [['mainEntity']] },
  qapage: { required: [], anyOf: [['mainEntity']] },
  organization: { required: ['name'], anyOf: [['url', 'logo', 'sameAs']] },
  person: { required: ['name'], anyOf: [] },
  product: { required: ['name'], anyOf: [['offers', 'review', 'aggregateRating']] },
  howto: { required: ['name'], anyOf: [['step']] },
  recipe: { required: ['name'], anyOf: [['recipeIngredient', 'recipeInstructions']] },
  event: { required: ['name', 'startDate'], anyOf: [['location']] },
};

function typeNames(obj: JsonObject): string[] {
  const t = obj['@type'];
  if (typeof t === 'string') {
    return [t.toLowerCase()];
  }
  if (Array.isArray(t)) {
    return t.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase());
  }
  return [];
}

/** Collect every node whose @type has field expectations, walking @graph and nested values. */
function collectTyped(node: unknown, out: JsonObject[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectTyped(item, out);
    }
    return;
  }
  const obj = node as JsonObject;
  if (typeNames(obj).some((t) => t in EXPECTED)) {
    out.push(obj);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      collectTyped(value, out);
    }
  }
}

export const requiredFieldsRule: Rule = {
  id: 'schema/required-fields',
  category: 'schema',
  title: 'Typed entities carry their key fields',
  description:
    'A FAQPage without mainEntity, an Organization without a name or a Product without offers gives engines the shell of an entity but nothing to extract — incomplete typed data rarely earns citations.',
  severity: 'warn',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const nodes: JsonObject[] = [];
    for (const block of extractJsonLd(ctx.$)) {
      if (block.data) {
        collectTyped(block.data, nodes);
      }
    }
    const findings: RuleFinding[] = [];
    for (const node of nodes) {
      const types = typeNames(node).filter((t) => t in EXPECTED);
      const missing = new Set<string>();
      for (const t of types) {
        const spec = EXPECTED[t]!;
        for (const prop of spec.required) {
          if (!(prop in node)) {
            missing.add(prop);
          }
        }
        for (const group of spec.anyOf) {
          if (!group.some((prop) => prop in node)) {
            missing.add(group.join(' or '));
          }
        }
      }
      if (missing.size === 0) {
        continue;
      }
      findings.push({
        severity: 'warn',
        message: `${types.join('/')} schema is missing key fields: ${[...missing].join(', ')}`,
        detail:
          'Engines extract answers from these fields — an entity without them is structured data that cannot be quoted.',
        fix: `Add ${[...missing].join(', ')} to the ${types.join('/')} JSON-LD node.`,
        evidence: `"@type": "${typeNames(node).join(', ')}"`,
      });
    }
    return findings;
  },
};
