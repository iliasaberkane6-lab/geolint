import { describe, expect, it } from 'vitest';
import { VERSION } from '../../src/core/types.js';
import { renderReport, renderSiteReport } from '../../src/reporters/index.js';
import { makeReport, makeSiteReport } from './fixtures.js';

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  helpUri: string;
  defaultConfiguration: { level: string };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: { physicalLocation: { artifactLocation: { uri: string } } }[];
}

interface SarifDoc {
  $schema: string;
  version: string;
  runs: {
    tool: { driver: { name: string; version: string; informationUri: string; rules: SarifRule[] } };
    results: SarifResult[];
  }[];
}

function parse(out: string): SarifDoc {
  return JSON.parse(out) as SarifDoc;
}

describe('sarif — ScanReport', () => {
  const report = makeReport();
  const doc = parse(renderReport(report, 'sarif'));
  const run = doc.runs[0]!;
  const results = run.results;

  it('is valid SARIF 2.1.0', () => {
    expect(doc.version).toBe('2.1.0');
    expect(doc.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(run.tool.driver.name).toBe('geolint');
    expect(run.tool.driver.version).toBe(VERSION);
    expect(run.tool.driver.informationUri).toContain('github.com');
  });

  it('emits one result per finding', () => {
    expect(results.length).toBe(report.findings.length);
  });

  it('maps severities to SARIF levels', () => {
    const byId = new Map(results.map((r) => [r.ruleId, r.level]));
    expect(byId.get('llms-txt/missing')).toBe('error');
    expect(byId.get('content/thin-content')).toBe('warning');
    expect(byId.get('content/no-faq')).toBe('note');
  });

  it('appends fix text to the message and targets the final URL', () => {
    const llms = results.find((r) => r.ruleId === 'llms-txt/missing')!;
    expect(llms.message.text).toContain('No llms.txt found');
    expect(llms.message.text).toContain('Fix: Create /llms.txt');
    expect(llms.locations[0]!.physicalLocation.artifactLocation.uri).toBe(report.finalUrl);
  });

  it('uses registry metadata for known rules', () => {
    const https = run.tool.driver.rules.find((r) => r.id === 'technical/https')!;
    expect(https.shortDescription.text).toBe('Site served over HTTPS');
    expect(https.defaultConfiguration.level).toBe('error');
    expect(https.helpUri).toBe(
      'https://github.com/iliasabk/geolint/blob/main/docs/rules.md#rule-technical-https',
    );
    expect(https.name).toBe('TechnicalHttps');
  });

  it('emits minimal rule stubs for findings with unknown rule ids', () => {
    const withUnknown = makeReport({
      findings: [
        ...makeReport().findings,
        {
          ruleId: 'content/zzz-not-a-real-rule',
          severity: 'warn',
          message: 'Hypothetical check failed',
        },
      ],
    });
    const stubDoc = parse(renderReport(withUnknown, 'sarif'));
    const stub = stubDoc.runs[0]!.tool.driver.rules.find(
      (r) => r.id === 'content/zzz-not-a-real-rule',
    )!;
    expect(stub).toBeDefined();
    expect(stub.helpUri).toContain('#rule-content-zzz-not-a-real-rule');
    expect(stub.helpUri).not.toContain('content/zzz');
    expect(stub.defaultConfiguration.level).toBe('warning'); // from finding severity
    expect(stub.shortDescription.text.length).toBeGreaterThan(0);
  });

  it('covers every result ruleId in the driver rules', () => {
    const ruleIds = new Set(run.tool.driver.rules.map((r) => r.id));
    for (const result of results) {
      expect(ruleIds.has(result.ruleId)).toBe(true);
    }
  });
});

describe('sarif — SiteReport', () => {
  const site = makeSiteReport();
  const doc = parse(renderSiteReport(site, 'sarif'));
  const results = doc.runs[0]!.results;

  it('emits per-page results with that page finalUrl', () => {
    const pageFindings = site.pages.flatMap((p) => p.findings).length;
    const siteOnly = site.findings.filter(
      (f) =>
        !site.pages.some((p) =>
          p.findings.some((pf) => pf.ruleId === f.ruleId && pf.message === f.message),
        ),
    ).length;
    expect(results.length).toBe(pageFindings + siteOnly);

    const pricing = results.filter(
      (r) =>
        r.locations[0]!.physicalLocation.artifactLocation.uri === 'https://site.example/pricing',
    );
    expect(pricing.length).toBe(site.pages[0]!.findings.length);
  });

  it('maps site-level findings to the root url', () => {
    const dup = results.find((r) => r.ruleId === 'content/duplicate-titles')!;
    expect(dup.locations[0]!.physicalLocation.artifactLocation.uri).toBe('https://site.example/');
  });

  it('produces a parseable document', () => {
    expect(() => parse(renderSiteReport(site, 'sarif'))).not.toThrow();
  });
});
