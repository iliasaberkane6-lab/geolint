import type { Finding, ScanReport, Severity, SiteReport } from '../core/types.js';
import { allRules } from '../rules/index.js';

const INFORMATION_URI = 'https://github.com/iliasaberkane/geolint';
const SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

type SarifLevel = 'error' | 'warning' | 'note';

const LEVEL: Record<Severity, SarifLevel> = { error: 'error', warn: 'warning', info: 'note' };

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  helpUri: string;
  defaultConfiguration: { level: SarifLevel };
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: [{ physicalLocation: { artifactLocation: { uri: string } } }];
}

/** 'ai-crawler/gptbot-blocked' → 'AiCrawlerGptbotBlocked' */
function ruleName(id: string): string {
  return id
    .split(/[/-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** 'ai-crawler/gptbot-blocked' → 'Gptbot blocked' — fallback title text. */
function humanize(id: string): string {
  const last = id.split('/').pop() ?? id;
  const words = last.split('-').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function helpUri(id: string): string {
  return `${INFORMATION_URI}/blob/main/docs/rules.md#${id.replace(/\//g, '-')}`;
}

function worstSeverity(findings: Finding[]): Severity {
  if (findings.some((f) => f.severity === 'error')) {
    return 'error';
  }
  if (findings.some((f) => f.severity === 'warn')) {
    return 'warn';
  }
  return 'info';
}

/** Registry rules + minimal stubs for findings referencing unknown ids. */
function driverRules(findings: Finding[]): SarifRule[] {
  const rules: SarifRule[] = allRules.map((rule) => ({
    id: rule.id,
    name: ruleName(rule.id),
    shortDescription: { text: rule.title },
    fullDescription: { text: rule.description },
    helpUri: helpUri(rule.id),
    defaultConfiguration: { level: LEVEL[rule.severity] },
  }));
  const known = new Set(allRules.map((rule) => rule.id));
  for (const id of new Set(findings.map((f) => f.ruleId))) {
    if (!known.has(id)) {
      rules.push({
        id,
        name: ruleName(id),
        shortDescription: { text: humanize(id) },
        fullDescription: { text: `Finding reported by geolint rule '${id}'.` },
        helpUri: helpUri(id),
        defaultConfiguration: {
          level: LEVEL[worstSeverity(findings.filter((f) => f.ruleId === id))],
        },
      });
    }
  }
  return rules;
}

function toResult(finding: Finding, uri: string): SarifResult {
  return {
    ruleId: finding.ruleId,
    level: LEVEL[finding.severity],
    message: { text: finding.fix ? `${finding.message} Fix: ${finding.fix}` : finding.message },
    locations: [{ physicalLocation: { artifactLocation: { uri } } }],
  };
}

function sarifLog(version: string, results: SarifResult[], findings: Finding[]): string {
  return `${JSON.stringify(
    {
      $schema: SCHEMA,
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'geolint',
              version,
              informationUri: INFORMATION_URI,
              rules: driverRules(findings),
            },
          },
          results,
        },
      ],
    },
    null,
    2,
  )}\n`;
}

/** SARIF 2.1.0 for GitHub code scanning — one result per finding. */
export function renderSarif(report: ScanReport): string {
  const results = report.findings.map((f) => toResult(f, report.finalUrl));
  return sarifLog(report.tool.version, results, report.findings);
}

/**
 * SARIF for a crawl report — per-page findings point at that page's finalUrl;
 * site-level findings not attributable to a page point at the root URL.
 */
export function renderSiteSarif(report: SiteReport): string {
  const results: SarifResult[] = [];
  const pageKeys = new Set<string>();
  for (const page of report.pages) {
    for (const f of page.findings) {
      pageKeys.add(`${f.ruleId}${f.message}`);
      results.push(toResult(f, page.finalUrl || page.url));
    }
  }
  for (const f of report.findings) {
    if (!pageKeys.has(`${f.ruleId}${f.message}`)) {
      results.push(toResult(f, report.url));
    }
  }
  const all = report.pages.flatMap((page) => page.findings).concat(report.findings);
  return sarifLog(report.tool.version, results, all);
}
