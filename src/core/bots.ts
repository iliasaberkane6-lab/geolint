/**
 * Registry of AI-related crawlers / user-agents that site owners can control
 * via robots.txt — purpose-aware: blocking a 'search' or 'user-fetch' bot
 * makes a site invisible in AI answers *now*; blocking a 'training' bot only
 * affects future model data; control-only tokens are opt-out signals, not
 * crawlers. Verified against vendor docs (see docs/research-notes.md).
 */
export interface AiBot {
  /** Token as it appears in robots.txt User-agent lines. */
  id: string;
  name: string;
  company: string;
  /**
   * training    = collects data to train models (impact: future models)
   * search      = indexes content for AI answers/search (impact: citations now)
   * user-fetch  = fetches a page on behalf of a user action (impact: citations now)
   * mixed       = covers several of the above
   */
  purpose: 'training' | 'search' | 'user-fetch' | 'mixed';
  /** true for tokens that are opt-out signals rather than real crawlers (e.g. Google-Extended). */
  controlOnly?: boolean;
  /**
   * Vendor-stated robots.txt posture:
   * honored   = vendor documents compliance
   * bypass    = vendor documents that robots.txt may NOT apply (user-initiated fetchers)
   * unverified = no reliable official statement
   */
  robotsTxt?: 'honored' | 'bypass' | 'unverified';
  /** Retired/superseded token — still appears in old robots.txt files. */
  retired?: boolean;
  /** Current token that replaces this one, when retired. */
  replacedBy?: string;
  docs?: string;
  notes?: string;
}

export const AI_BOTS: AiBot[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────
  {
    id: 'GPTBot',
    name: 'GPTBot',
    company: 'OpenAI',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    id: 'OAI-SearchBot',
    name: 'OAI-SearchBot',
    company: 'OpenAI',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://developers.openai.com/api/docs/bots',
    notes: 'Blocking removes the site from ChatGPT search citations.',
  },
  {
    id: 'ChatGPT-User',
    name: 'ChatGPT-User',
    company: 'OpenAI',
    purpose: 'user-fetch',
    robotsTxt: 'bypass',
    docs: 'https://developers.openai.com/api/docs/bots',
    notes: 'OpenAI: "robots.txt rules may not apply" to user-initiated fetches.',
  },
  {
    id: 'OAI-AdsBot',
    name: 'OAI-AdsBot',
    company: 'OpenAI',
    purpose: 'mixed',
    robotsTxt: 'honored',
    docs: 'https://help.openai.com/en/articles/20001243',
  },
  // ── Anthropic ───────────────────────────────────────────────────────
  {
    id: 'ClaudeBot',
    name: 'ClaudeBot',
    company: 'Anthropic',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://support.claude.com/en/articles/8896518',
  },
  {
    id: 'Claude-User',
    name: 'Claude-User',
    company: 'Anthropic',
    purpose: 'user-fetch',
    robotsTxt: 'honored',
    docs: 'https://support.claude.com/en/articles/8896518',
    notes: 'Anthropic documents robots.txt compliance for all three bots.',
  },
  {
    id: 'Claude-SearchBot',
    name: 'Claude-SearchBot',
    company: 'Anthropic',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://support.claude.com/en/articles/8896518',
  },
  {
    id: 'anthropic-ai',
    name: 'anthropic-ai',
    company: 'Anthropic',
    purpose: 'training',
    retired: true,
    replacedBy: 'ClaudeBot',
    robotsTxt: 'unverified',
  },
  {
    id: 'Claude-Web',
    name: 'Claude-Web',
    company: 'Anthropic',
    purpose: 'search',
    retired: true,
    replacedBy: 'Claude-SearchBot',
    robotsTxt: 'unverified',
  },
  // ── Perplexity ──────────────────────────────────────────────────────
  {
    id: 'PerplexityBot',
    name: 'PerplexityBot',
    company: 'Perplexity',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md',
    notes: 'Perplexity states full compliance since the 2024 reporting controversy.',
  },
  {
    id: 'Perplexity-User',
    name: 'Perplexity-User',
    company: 'Perplexity',
    purpose: 'user-fetch',
    robotsTxt: 'bypass',
    docs: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md',
    notes: 'Perplexity docs: this fetcher "generally ignores robots.txt".',
  },
  // ── Google ──────────────────────────────────────────────────────────
  {
    id: 'Googlebot',
    name: 'Googlebot',
    company: 'Google',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
    notes:
      'AI Overviews and AI Mode are served from the Search index — blocking Googlebot is the only full opt-out.',
  },
  {
    id: 'Google-Extended',
    name: 'Google-Extended',
    company: 'Google',
    purpose: 'training',
    controlOnly: true,
    robotsTxt: 'honored',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
    notes:
      'Control token for Gemini/Vertex training — never fetches; does not affect ranking or AI Overviews.',
  },
  // ── Apple ───────────────────────────────────────────────────────────
  {
    id: 'Applebot',
    name: 'Applebot',
    company: 'Apple',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://support.apple.com/en-us/119829',
    notes:
      'Feeds Siri/Spotlight answers; falls back to Googlebot rules when no Applebot rules exist.',
  },
  {
    id: 'Applebot-Extended',
    name: 'Applebot-Extended',
    company: 'Apple',
    purpose: 'training',
    controlOnly: true,
    robotsTxt: 'honored',
    docs: 'https://support.apple.com/en-us/119829',
    notes: 'Opt-out token for training — does not crawl webpages.',
  },
  // ── Meta ────────────────────────────────────────────────────────────
  {
    id: 'meta-externalagent',
    name: 'Meta-ExternalAgent',
    company: 'Meta',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
  },
  {
    id: 'Meta-WebIndexer',
    name: 'Meta-WebIndexer',
    company: 'Meta',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
  },
  {
    id: 'Meta-ExternalFetcher',
    name: 'Meta-ExternalFetcher',
    company: 'Meta',
    purpose: 'user-fetch',
    robotsTxt: 'bypass',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
    notes: 'User-triggered fetcher; Meta documents it may bypass robots.txt.',
  },
  {
    id: 'facebookexternalhit',
    name: 'facebookexternalhit',
    company: 'Meta',
    purpose: 'user-fetch',
    robotsTxt: 'unverified',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
    notes: 'Link-preview fetcher.',
  },
  {
    id: 'FacebookBot',
    name: 'FacebookBot',
    company: 'Meta',
    purpose: 'training',
    retired: true,
    replacedBy: 'meta-externalagent',
    robotsTxt: 'unverified',
  },
  // ── Amazon ──────────────────────────────────────────────────────────
  {
    id: 'Amazonbot',
    name: 'Amazonbot',
    company: 'Amazon',
    purpose: 'mixed',
    robotsTxt: 'honored',
    docs: 'https://developer.amazon.com/amazonbot',
    notes: 'No Crawl-delay support; honors page-level noarchive as a training opt-out.',
  },
  {
    id: 'Amzn-SearchBot',
    name: 'Amzn-SearchBot',
    company: 'Amazon',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://developer.amazon.com/amazonbot',
    notes: 'Indexes for Alexa/Rufus answers — explicitly not used for training.',
  },
  {
    id: 'Amzn-User',
    name: 'Amzn-User',
    company: 'Amazon',
    purpose: 'user-fetch',
    robotsTxt: 'honored',
    docs: 'https://developer.amazon.com/amazonbot',
  },
  // ── Mistral ─────────────────────────────────────────────────────────
  {
    id: 'MistralAI-User',
    name: 'MistralAI-User',
    company: 'Mistral AI',
    purpose: 'user-fetch',
    robotsTxt: 'unverified',
    docs: 'https://docs.mistral.ai/robots',
  },
  {
    id: 'MistralAI-Index',
    name: 'MistralAI-Index',
    company: 'Mistral AI',
    purpose: 'search',
    robotsTxt: 'unverified',
    docs: 'https://docs.mistral.ai/robots',
  },
  {
    id: 'MistralAI-Training',
    name: 'MistralAI-Training',
    company: 'Mistral AI',
    purpose: 'training',
    robotsTxt: 'unverified',
    docs: 'https://docs.mistral.ai/robots',
  },
  // ── Microsoft / DuckDuckGo ──────────────────────────────────────────
  {
    id: 'Bingbot',
    name: 'Bingbot',
    company: 'Microsoft',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
    notes: 'Copilot answers and much third-party AI grounding run on the Bing index.',
  },
  {
    id: 'DuckDuckBot',
    name: 'DuckDuckBot',
    company: 'DuckDuckGo',
    purpose: 'search',
    robotsTxt: 'honored',
  },
  {
    id: 'DuckAssistBot',
    name: 'DuckAssistBot',
    company: 'DuckDuckGo',
    purpose: 'user-fetch',
    robotsTxt: 'honored',
    docs: 'https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot',
    notes: 'Fetches for Duck.ai answers; opt-out takes effect within 72h.',
  },
  // ── Other answer engines ────────────────────────────────────────────
  {
    id: 'YouBot',
    name: 'YouBot',
    company: 'You.com',
    purpose: 'search',
    robotsTxt: 'honored',
    docs: 'https://you.com',
  },
  {
    id: 'KimiBot',
    name: 'KimiBot',
    company: 'Moonshot AI',
    purpose: 'training',
    robotsTxt: 'unverified',
  },
  {
    id: 'Kimi-User',
    name: 'Kimi-User',
    company: 'Moonshot AI',
    purpose: 'user-fetch',
    robotsTxt: 'unverified',
  },
  {
    id: 'TongyiBot',
    name: 'TongyiBot',
    company: 'Alibaba',
    purpose: 'mixed',
    robotsTxt: 'unverified',
  },
  {
    id: 'ExaBot',
    name: 'ExaBot',
    company: 'Exa',
    purpose: 'search',
    robotsTxt: 'unverified',
  },
  {
    id: 'TavilyBot',
    name: 'TavilyBot',
    company: 'Tavily',
    purpose: 'search',
    robotsTxt: 'unverified',
  },
  {
    id: 'Timpibot',
    name: 'Timpibot',
    company: 'Timpi',
    purpose: 'search',
    robotsTxt: 'unverified',
    notes: 'Third-party directories report inconsistent robots.txt compliance.',
  },
  // ── Training-data crawlers ──────────────────────────────────────────
  {
    id: 'Bytespider',
    name: 'Bytespider',
    company: 'ByteDance',
    purpose: 'mixed',
    robotsTxt: 'unverified',
    notes:
      'Highest-volume AI bot per Cloudflare data; third-party studies report robots.txt non-compliance — enforce at WAF level if blocking.',
  },
  {
    id: 'CCBot',
    name: 'CCBot',
    company: 'Common Crawl',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://commoncrawl.org/faq',
    notes: 'Common Crawl datasets feed many LLMs; blocking is a de-facto training opt-out.',
  },
  {
    id: 'cohere-ai',
    name: 'cohere-ai',
    company: 'Cohere',
    purpose: 'user-fetch',
    robotsTxt: 'unverified',
    notes: 'Widely mislabeled as a training crawler; community-documented as live retrieval.',
  },
  {
    id: 'cohere-training-data-crawler',
    name: 'cohere-training-data-crawler',
    company: 'Cohere',
    purpose: 'training',
    robotsTxt: 'unverified',
  },
  {
    id: 'Diffbot',
    name: 'Diffbot',
    company: 'Diffbot',
    purpose: 'mixed',
    robotsTxt: 'honored',
    docs: 'https://www.diffbot.com/docs/crawl/',
    notes: 'Honors Disallow + Crawl-delay but ignores the Allow directive.',
  },
  {
    id: 'omgilibot',
    name: 'Omgilibot',
    company: 'Webz.io',
    purpose: 'training',
    retired: true,
    replacedBy: 'webzio',
    robotsTxt: 'honored',
  },
  {
    id: 'webzio',
    name: 'webzio',
    company: 'Webz.io',
    purpose: 'training',
    robotsTxt: 'honored',
  },
  {
    id: 'Webzio-Extended',
    name: 'Webzio-Extended',
    company: 'Webz.io',
    purpose: 'training',
    controlOnly: true,
    robotsTxt: 'honored',
    notes: 'Opt-out token governing AI/ML use of collected data.',
  },
  {
    id: 'ImagesiftBot',
    name: 'ImagesiftBot',
    company: 'The Hive',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://imagesift.com/about',
  },
  {
    id: 'PanguBot',
    name: 'PanguBot',
    company: 'Huawei',
    purpose: 'training',
    robotsTxt: 'unverified',
  },
  {
    id: 'Kangaroo Bot',
    name: 'Kangaroo Bot',
    company: 'Kangaroo LLM',
    purpose: 'training',
    robotsTxt: 'unverified',
    notes: 'Token contains a literal space.',
  },
  {
    id: 'AI2Bot',
    name: 'AI2Bot',
    company: 'Allen Institute for AI',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://allenai.org/crawler',
  },
  {
    id: 'Ai2Bot-Dolma',
    name: 'Ai2Bot-Dolma',
    company: 'Allen Institute for AI',
    purpose: 'training',
    robotsTxt: 'honored',
    docs: 'https://allenai.org/crawler',
  },
  {
    id: 'ICC-Crawler',
    name: 'ICC-Crawler',
    company: 'NICT',
    purpose: 'training',
    robotsTxt: 'unverified',
  },
  {
    id: 'VelenPublicWebCrawler',
    name: 'VelenPublicWebCrawler',
    company: 'Velen',
    purpose: 'training',
    robotsTxt: 'unverified',
  },
];

export function botsByPurpose(purpose: AiBot['purpose']): AiBot[] {
  return AI_BOTS.filter((b) => b.purpose === purpose || b.purpose === 'mixed');
}

/** Bots whose blocking directly removes a site from current AI answers. */
export function citationCriticalBots(): AiBot[] {
  return AI_BOTS.filter(
    (b) => !b.retired && (b.purpose === 'search' || b.purpose === 'user-fetch'),
  );
}

/** Retired/superseded tokens that still appear in robots.txt files. */
export function retiredBots(): AiBot[] {
  return AI_BOTS.filter((b) => b.retired);
}
