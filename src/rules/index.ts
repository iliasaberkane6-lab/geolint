import type { Rule } from '../core/types.js';
import { aiOptOutSignalsRule } from './ai-crawler/ai-opt-out-signals.js';
import { crawlDelayRule } from './ai-crawler/crawl-delay.js';
import { metaRobotsBlockingRule } from './ai-crawler/meta-robots-blocking.js';
import { robotsMissingRule } from './ai-crawler/robots-missing.js';
import { robotsUnreachableRule } from './ai-crawler/robots-unreachable.js';
import { searchBotsBlockedRule } from './ai-crawler/search-bots-blocked.js';
import { staleTokensRule } from './ai-crawler/stale-tokens.js';
import { trainingBotsBlockedRule } from './ai-crawler/training-bots-blocked.js';
import { userFetchBypassRule } from './ai-crawler/user-fetch-bypass.js';
import { wildcardBlockAllRule } from './ai-crawler/wildcard-block-all.js';
import { answerFirstRule } from './content/answer-first.js';
import { imagesNoAltRule } from './content/images-no-alt.js';
import { langMissingRule } from './content/lang-missing.js';
import { missingDatesRule } from './content/missing-dates.js';
import { noAuthorRule } from './content/no-author.js';
import { noDataPointsRule } from './content/no-data-points.js';
import { noH1Rule } from './content/no-h1.js';
import { noQuestionHeadingsRule } from './content/no-question-headings.js';
import { noStructureRule } from './content/no-structure.js';
import { selfContainedParagraphsRule } from './content/self-contained-paragraphs.js';
import { staleDatesRule } from './content/stale-dates.js';
import { thinContentRule } from './content/thin-content.js';
import { aiManifestRule } from './llms-txt/ai-manifest.js';
import { brokenLinksRule } from './llms-txt/broken-links.js';
import { invalidStructureRule } from './llms-txt/invalid-structure.js';
import { llmsFullMissingRule } from './llms-txt/llms-full-missing.js';
import { llmsTxtMissingRule } from './llms-txt/missing.js';
import { multipleH1Rule } from './llms-txt/multiple-h1.js';
import { noSectionsRule } from './llms-txt/no-sections.js';
import { noSummaryRule } from './llms-txt/no-summary.js';
import { optionalNotLastRule } from './llms-txt/optional-not-last.js';
import { relativeLinksRule } from './llms-txt/relative-links.js';
import { robotsDirectivesRule } from './llms-txt/robots-directives.js';
import { invalidJsonLdRule } from './schema/invalid-jsonld.js';
import { missingArticleFieldsRule } from './schema/missing-article-fields.js';
import { noBreadcrumbRule } from './schema/no-breadcrumb.js';
import { noFaqSchemaRule } from './schema/no-faq-schema.js';
import { noJsonLdRule } from './schema/no-jsonld.js';
import { noOrganizationRule } from './schema/no-organization.js';
import { requiredFieldsRule } from './schema/required-fields.js';
import { canonicalRule } from './technical/canonical.js';
import { clientRenderedRule } from './technical/client-rendered.js';
import { httpErrorRule } from './technical/http-error.js';
import { httpsRule } from './technical/https.js';
import { metaDescriptionRule } from './technical/meta-description.js';
import { pageUnreachableRule } from './technical/page-unreachable.js';
import { redirectRule } from './technical/redirect.js';
import { sitemapMissingRule } from './technical/sitemap-missing.js';
import { sitemapQualityRule } from './technical/sitemap-quality.js';
import { slowResponseRule } from './technical/slow-response.js';
import { titleMissingRule } from './technical/title-missing.js';

/**
 * Rule registry. Rules live in category subdirectories and are registered
 * here. Keep ids unique and category-prefixed: '<category>/<kebab-name>'.
 */
export const allRules: Rule[] = [
  // ai-crawler
  searchBotsBlockedRule,
  trainingBotsBlockedRule,
  wildcardBlockAllRule,
  robotsMissingRule,
  robotsUnreachableRule,
  metaRobotsBlockingRule,
  crawlDelayRule,
  aiOptOutSignalsRule,
  userFetchBypassRule,
  staleTokensRule,
  // llms-txt
  llmsTxtMissingRule,
  invalidStructureRule,
  noSummaryRule,
  noSectionsRule,
  brokenLinksRule,
  llmsFullMissingRule,
  relativeLinksRule,
  optionalNotLastRule,
  robotsDirectivesRule,
  multipleH1Rule,
  aiManifestRule,
  // schema
  noJsonLdRule,
  invalidJsonLdRule,
  missingArticleFieldsRule,
  noFaqSchemaRule,
  noOrganizationRule,
  noBreadcrumbRule,
  requiredFieldsRule,
  // content
  thinContentRule,
  noH1Rule,
  noQuestionHeadingsRule,
  missingDatesRule,
  noAuthorRule,
  noDataPointsRule,
  imagesNoAltRule,
  noStructureRule,
  langMissingRule,
  answerFirstRule,
  selfContainedParagraphsRule,
  staleDatesRule,
  // technical
  pageUnreachableRule,
  httpErrorRule,
  clientRenderedRule,
  sitemapMissingRule,
  canonicalRule,
  titleMissingRule,
  metaDescriptionRule,
  slowResponseRule,
  redirectRule,
  httpsRule,
  sitemapQualityRule,
];

export function ruleById(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id);
}
