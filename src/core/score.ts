import type { CategoryScore, Finding, Grade, Rule, RuleCategory, Severity } from './types.js';
import { RULE_CATEGORIES } from './types.js';

/** Points deducted per finding, capped per rule so spam doesn't dominate. */
const FINDING_WEIGHT: Record<Severity, number> = { error: 15, warn: 6, info: 2 };
const RULE_CAP: Record<Severity, number> = { error: 30, warn: 18, info: 6 };

export function gradeFor(score: number): Grade {
  if (score >= 90) {
    return 'A';
  }
  if (score >= 75) {
    return 'B';
  }
  if (score >= 60) {
    return 'C';
  }
  if (score >= 40) {
    return 'D';
  }
  return 'F';
}

function deductionFor(findings: Finding[]): number {
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byRule.get(f.ruleId) ?? [];
    list.push(f);
    byRule.set(f.ruleId, list);
  }
  let total = 0;
  for (const list of byRule.values()) {
    const severity = list[0]!.severity;
    const raw = list.reduce((sum, f) => sum + FINDING_WEIGHT[f.severity], 0);
    total += Math.min(raw, RULE_CAP[severity]);
  }
  return total;
}

/**
 * Score a scan: every category starts at 100 and loses points per finding
 * (per-rule caps prevent one broken rule from zeroing a category).
 * The overall score is the mean of the category scores.
 */
export function computeScore(
  rules: Rule[],
  findings: Finding[],
): { score: number; grade: Grade; categories: Record<RuleCategory, CategoryScore> } {
  const categories = {} as Record<RuleCategory, CategoryScore>;

  for (const cat of RULE_CATEGORIES) {
    const catRules = rules.filter((r) => r.category === cat);
    const catFindings = findings.filter((f) => catRules.some((r) => r.id === f.ruleId));
    const counts = { errors: 0, warnings: 0, infos: 0 };
    for (const f of catFindings) {
      if (f.severity === 'error') {
        counts.errors++;
      } else if (f.severity === 'warn') {
        counts.warnings++;
      } else {
        counts.infos++;
      }
    }
    const rulesRun = catRules.map((r) => r.id);
    const failed = new Set(catFindings.map((f) => f.ruleId));
    categories[cat] = {
      score: catRules.length === 0 ? 100 : Math.max(0, 100 - deductionFor(catFindings)),
      errors: counts.errors,
      warnings: counts.warnings,
      infos: counts.infos,
      rulesRun,
      passed: rulesRun.filter((id) => !failed.has(id)),
    };
  }

  const active = RULE_CATEGORIES.filter((c) => categories[c].rulesRun.length > 0);
  const score =
    active.length === 0
      ? 100
      : Math.round(active.reduce((sum, c) => sum + categories[c].score, 0) / active.length);

  return { score, grade: gradeFor(score), categories };
}
