import type { RuleCategory } from '../core/types.js';
import { allRules } from '../rules/index.js';
import { formatTable } from './util.js';

export type RulesFormat = 'table' | 'json' | 'markdown';

/** List the rule registry, optionally filtered to one category. */
export function listRules(opts: { category?: RuleCategory; format?: RulesFormat } = {}): string {
  const format = opts.format ?? 'table';
  const rules = allRules.filter((r) => !opts.category || r.category === opts.category);
  if (format === 'json') {
    return JSON.stringify(
      rules.map(({ id, category, severity, title, description }) => ({
        id,
        category,
        severity,
        title,
        description,
      })),
      null,
      2,
    );
  }
  if (format === 'markdown') {
    return [
      '| id | severity | title |',
      '| --- | --- | --- |',
      ...rules.map((r) => `| ${r.id} | ${r.severity} | ${r.title} |`),
    ].join('\n');
  }
  return formatTable(
    ['ID', 'SEVERITY', 'TITLE'],
    rules.map((r) => [r.id, r.severity, r.title]),
  );
}
