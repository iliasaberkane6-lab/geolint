import {
  type BotAccess,
  type CategoryScore,
  type Finding,
  RULE_CATEGORIES,
  type RuleCategory,
  type ScanReport,
  type SiteReport,
} from '../../src/core/types.js';

export const BOTS: BotAccess[] = [
  { id: 'GPTBot', name: 'GPTBot', company: 'OpenAI', purpose: 'training', allowed: true },
  {
    id: 'OAI-SearchBot',
    name: 'OAI-SearchBot',
    company: 'OpenAI',
    purpose: 'search',
    allowed: false,
  },
  {
    id: 'ChatGPT-User',
    name: 'ChatGPT-User',
    company: 'OpenAI',
    purpose: 'user-fetch',
    allowed: true,
  },
  { id: 'ClaudeBot', name: 'ClaudeBot', company: 'Anthropic', purpose: 'training', allowed: null },
  {
    id: 'Claude-User',
    name: 'Claude-User',
    company: 'Anthropic',
    purpose: 'user-fetch',
    allowed: true,
  },
  {
    id: 'PerplexityBot',
    name: 'PerplexityBot',
    company: 'Perplexity',
    purpose: 'search',
    allowed: false,
  },
];

export const FINDINGS: Finding[] = [
  {
    ruleId: 'llms-txt/missing',
    severity: 'error',
    message: 'No llms.txt found at /llms.txt',
    detail: 'llms.txt returned 404',
    fix: 'Create /llms.txt with an H1 title and curated links to key docs.',
    evidence: 'HTTP 404 — GET https://example.com/llms.txt',
  },
  {
    ruleId: 'schema/jsonld-missing',
    severity: 'error',
    message: 'No JSON-LD structured data found',
    fix: 'Add Organization/Article JSON-LD to <head> | keep it under 8KB.',
    evidence: '<head> contains 0 application/ld+json scripts',
  },
  {
    ruleId: 'content/thin-content',
    severity: 'warn',
    message: 'Very little extractable text on the page',
    fix: 'Add substantive prose — answer engines quote paragraphs, not nav.',
  },
  {
    ruleId: 'technical/https',
    severity: 'error',
    message: 'Page is not served over HTTPS',
    fix: 'Serve the site over HTTPS and redirect http:// to https://.',
  },
  {
    ruleId: 'content/no-faq',
    severity: 'info',
    message: 'No FAQ-style Q&A blocks detected',
    fix: 'Add an FAQ section or FAQPage schema for direct-answer citation.',
  },
];

export function makeCategories(
  overrides: Partial<Record<RuleCategory, Partial<CategoryScore>>> = {},
): Record<RuleCategory, CategoryScore> {
  const base: Record<RuleCategory, CategoryScore> = {
    'ai-crawler': {
      score: 100,
      errors: 0,
      warnings: 0,
      infos: 0,
      rulesRun: ['ai-crawler/gptbot-blocked', 'ai-crawler/oai-searchbot-blocked'],
      passed: ['ai-crawler/gptbot-blocked', 'ai-crawler/oai-searchbot-blocked'],
    },
    'llms-txt': {
      score: 70,
      errors: 1,
      warnings: 0,
      infos: 0,
      rulesRun: ['llms-txt/missing'],
      passed: [],
    },
    schema: {
      score: 85,
      errors: 1,
      warnings: 0,
      infos: 0,
      rulesRun: ['schema/jsonld-missing'],
      passed: [],
    },
    content: {
      score: 90,
      errors: 0,
      warnings: 1,
      infos: 1,
      rulesRun: ['content/thin-content', 'content/no-faq'],
      passed: [],
    },
    technical: {
      score: 85,
      errors: 1,
      warnings: 0,
      infos: 0,
      rulesRun: ['technical/https'],
      passed: [],
    },
  };
  for (const cat of RULE_CATEGORIES) {
    if (overrides[cat]) {
      base[cat] = { ...base[cat], ...overrides[cat] };
    }
  }
  return base;
}

export function makeReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    tool: { name: 'geolint', version: '0.1.0' },
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    scannedAt: '2025-06-01T12:00:00.000Z',
    durationMs: 1234,
    page: { status: 200, contentType: 'text/html; charset=utf-8', timingMs: 42, redirected: false },
    robots: {
      url: 'https://example.com/robots.txt',
      status: 200,
      groupCount: 3,
      sitemaps: ['https://example.com/sitemap.xml'],
    },
    llmsTxt: { url: 'https://example.com/llms.txt', status: 404, title: null, linkCount: 0 },
    bots: BOTS,
    findings: FINDINGS,
    score: 74,
    grade: 'C',
    categories: makeCategories(),
    ...overrides,
  };
}

export function makePageReport(path: string, score: number, findings: Finding[]): ScanReport {
  return makeReport({
    url: `https://site.example${path}`,
    finalUrl: `https://site.example${path}`,
    score,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F',
    findings,
  });
}

const SITE_ONLY_FINDING: Finding = {
  ruleId: 'content/duplicate-titles',
  severity: 'warn',
  message: 'Identical <title> across multiple pages',
  fix: 'Give every page a unique, descriptive title.',
};

export function makeSiteReport(overrides: Partial<SiteReport> = {}): SiteReport {
  const pages = [
    makePageReport('/pricing', 38, [
      FINDINGS[0]!,
      FINDINGS[2]!,
      { ...FINDINGS[1]!, message: 'No JSON-LD structured data found' },
    ]),
    makePageReport('/', 88, [FINDINGS[0]!, FINDINGS[2]!]),
    makePageReport('/about', 95, []),
  ];
  const pageFindings = pages.flatMap((p) => p.findings);
  return {
    tool: { name: 'geolint', version: '0.1.0' },
    url: 'https://site.example/',
    scannedAt: '2025-06-01T12:00:00.000Z',
    durationMs: 8420,
    pages,
    findings: [...pageFindings, SITE_ONLY_FINDING],
    score: 64,
    grade: 'C',
    categories: makeCategories(),
    stats: { pagesScanned: 3, pagesFailed: 1 },
    ...overrides,
  };
}
