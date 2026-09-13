import type { Rule } from '../core/types.js';
import { httpsRule } from './technical/https.js';

/**
 * Rule registry. Rules live in category subdirectories and are registered
 * here. Keep ids unique and category-prefixed: '<category>/<kebab-name>'.
 */
export const allRules: Rule[] = [httpsRule];

export function ruleById(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id);
}
