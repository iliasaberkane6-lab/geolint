/**
 * Registry of AI-related crawlers / user-agents that site owners can control
 * via robots.txt. Blocking a 'search' or 'user-fetch' bot makes a site
 * invisible in AI answers; blocking a 'training' bot only affects future
 * model training data.
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
  docs?: string;
}

export const AI_BOTS: AiBot[] = [
  {
    id: 'GPTBot',
    name: 'GPTBot',
    company: 'OpenAI',
    purpose: 'training',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    id: 'OAI-SearchBot',
    name: 'OAI-SearchBot',
    company: 'OpenAI',
    purpose: 'search',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    id: 'ChatGPT-User',
    name: 'ChatGPT-User',
    company: 'OpenAI',
    purpose: 'user-fetch',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    id: 'PerplexityBot',
    name: 'PerplexityBot',
    company: 'Perplexity',
    purpose: 'search',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'Perplexity-User',
    name: 'Perplexity-User',
    company: 'Perplexity',
    purpose: 'user-fetch',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'ClaudeBot',
    name: 'ClaudeBot',
    company: 'Anthropic',
    purpose: 'training',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    id: 'Claude-User',
    name: 'Claude-User',
    company: 'Anthropic',
    purpose: 'user-fetch',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    id: 'Claude-SearchBot',
    name: 'Claude-SearchBot',
    company: 'Anthropic',
    purpose: 'search',
    docs: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    id: 'Google-Extended',
    name: 'Google-Extended',
    company: 'Google',
    purpose: 'training',
    controlOnly: true,
    docs: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
  },
  {
    id: 'Applebot-Extended',
    name: 'Applebot-Extended',
    company: 'Apple',
    purpose: 'training',
    controlOnly: true,
    docs: 'https://support.apple.com/en-us/119829',
  },
  {
    id: 'meta-externalagent',
    name: 'Meta-ExternalAgent',
    company: 'Meta',
    purpose: 'training',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers',
  },
  {
    id: 'FacebookBot',
    name: 'FacebookBot',
    company: 'Meta',
    purpose: 'training',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers',
  },
  {
    id: 'Amazonbot',
    name: 'Amazonbot',
    company: 'Amazon',
    purpose: 'mixed',
    docs: 'https://developer.amazon.com/amazonbot',
  },
  {
    id: 'Bytespider',
    name: 'Bytespider',
    company: 'ByteDance',
    purpose: 'training',
  },
  {
    id: 'CCBot',
    name: 'CCBot',
    company: 'Common Crawl',
    purpose: 'training',
    docs: 'https://commoncrawl.org/ccbot',
  },
  {
    id: 'cohere-ai',
    name: 'cohere-ai',
    company: 'Cohere',
    purpose: 'training',
  },
  {
    id: 'cohere-training-data-crawler',
    name: 'cohere-training-data-crawler',
    company: 'Cohere',
    purpose: 'training',
  },
  { id: 'Diffbot', name: 'Diffbot', company: 'Diffbot', purpose: 'mixed' },
  { id: 'omgilibot', name: 'Omgilibot', company: 'Omgili', purpose: 'training' },
  {
    id: 'YouBot',
    name: 'YouBot',
    company: 'You.com',
    purpose: 'search',
    docs: 'https://about.you.com/youbot',
  },
  { id: 'ImagesiftBot', name: 'ImagesiftBot', company: 'The Hive', purpose: 'training' },
  { id: 'Timpibot', name: 'Timpibot', company: 'Timpi', purpose: 'search' },
  { id: 'PanguBot', name: 'PanguBot', company: 'Huawei', purpose: 'mixed' },
  { id: 'Kangaroo Bot', name: 'Kangaroo Bot', company: 'Kangaroo LLM', purpose: 'training' },
  { id: 'Webzio-Extended', name: 'Webzio-Extended', company: 'Webz.io', purpose: 'training' },
  { id: 'AI2Bot', name: 'AI2Bot', company: 'Allen Institute for AI', purpose: 'training' },
  {
    id: 'Ai2Bot-Dolma',
    name: 'Ai2Bot-Dolma',
    company: 'Allen Institute for AI',
    purpose: 'training',
  },
  { id: 'ICC-Crawler', name: 'ICC-Crawler', company: 'NTT', purpose: 'training' },
  {
    id: 'VelenPublicWebCrawler',
    name: 'VelenPublicWebCrawler',
    company: 'Velen',
    purpose: 'training',
  },
  { id: 'DuckAssistBot', name: 'DuckAssistBot', company: 'DuckDuckGo', purpose: 'search' },
  {
    id: 'MistralAI-User',
    name: 'MistralAI-User',
    company: 'Mistral AI',
    purpose: 'user-fetch',
  },
];

export function botsByPurpose(purpose: AiBot['purpose']): AiBot[] {
  return AI_BOTS.filter((b) => b.purpose === purpose || b.purpose === 'mixed');
}

/** Bots whose blocking directly removes a site from current AI answers. */
export function citationCriticalBots(): AiBot[] {
  return AI_BOTS.filter((b) => b.purpose === 'search' || b.purpose === 'user-fetch');
}
