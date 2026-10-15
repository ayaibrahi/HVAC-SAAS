import type { OpportunityAiInsightOutput } from "@/lib/validation/opportunity-ai-insights";
import type { OpportunityAiInput } from "@/features/opportunities/ai/types";
import { AppError } from "@/lib/errors";

const currencyClaimPattern =
  /(?:[$€£]\s*\d[\d,.]*(?:\s*[kmb])?|\b\d[\d,]*(?:\.\d+)?\s*(?:dollars?|bucks|usd|eur|gbp|egp|sar|aed)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion))*\s+(?:dollars?|usd|eur|gbp|egp|sar|aed)\b|\b(?:five|six|seven|eight|nine)\s+figures?\b|\bthousands?\s+in\s+(?:lost|additional)?\s*revenue\b)/i;
const percentageClaimPattern =
  /\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*(?:percent|percentage points?)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))*\s+(?:percent|percentage points?)(?:\s+(?:uplift|increase|gain|improvement))?\b/i;
const fabricatedMetricPattern =
  /\b\d[\d,]*(?:\.\d+)?\s*(?:leads?|calls?|customers?|jobs?|appointments?|bookings?|visitors?|conversions?)\b/i;
const guaranteedResultPattern =
  /\b(?:guarantee[ds]?|guaranteed|definitely|certainly|guaranteed\s+roi|will\s+(?:increase|improve|reduce|generate|capture|drive|boost))\b/i;
const financialOutcomePattern =
  /\b(?:(?:double|triple)\s+revenue|[2-9]x\s+revenue|increase\s+revenue\s+significantly|generate\s+thousands?\s+in\s+(?:additional\s+)?revenue|recover\s+lost\s+revenue|lost\s+revenue|guaranteed\s+roi|roi\s+is\s+guaranteed)\b/i;
const unsupportedBusinessClaimPattern =
  /\b(?:the\s+)?(?:company|business|contractor|hvac company|they)\s+(?:(?:does not|doesn't|do not|don't|never)\s+(?:offer|provide|have)|(?:offers?|provides?|has)\s+no|lacks?)\b/i;
const agencyServiceClaimPattern =
  /\b(?:agency|we|our team)\s+can\s+(?:address|provide|deliver|implement|build|create|offer|sell)\b|\bthrough\s+(?:our|the agency's)\b/i;

const wholeSiteClaimPatterns = [
  /\b(?:company|business|contractor|they)\s+(?:(?:currently|clearly|visibly|apparently|still|simply|also)\s+){0,4}(?:(?:does not|doesn't|do not|don't|never)\s+(?:offer|provide|have)|(?:offers?|provides?|has)\s+no|lacks?)\b/i,
  /\b(?:website|site)\s+(?:(?:currently|clearly|visibly|apparently|still|simply|also|entirely)\s+){0,4}(?:does\s+not|doesn't|has\s+no|lacks?|is\s+missing)\b/i,
  /\b(?:entire|whole)\s+(?:website|site)\b/i,
  /\banywhere\s+on\s+(?:the\s+)?(?:website|site)\b/i,
  /\bacross\s+(?:the\s+)?(?:website|site)\b/i,
  /\b(?:the\s+)?(?:website|site)\s+(?:does not|doesn't|has no|lacks|is missing)\b/i,
  /\bthere\s+is\s+no\s+(?:booking|financing|maintenance|service areas?|service-area pages?)\s+anywhere\b/i,
  /\b(?:the\s+)?(?:company|business|contractor|hvac company|they)\s+has\s+no\s+(?:booking system|financing|maintenance|service areas?)\b/i,
  /\b(?:the\s+)?(?:company|business|contractor|hvac company|they)\s+(?:offers?|provides?)\s+no\s+(?:booking|financing|maintenance|service areas?)\b/i,
  /\b(?:the\s+)?(?:company|business|contractor|hvac company|they)\s+lacks?\s+(?:booking|financing|maintenance|service areas?)\b/i,
  /\b(?:the\s+)?(?:company|business|contractor|hvac company|they)\s+(?:does not|doesn't|do not|don't|never)\s+(?:offer|provide|have)\s+(?:booking|financing|maintenance|service areas?)\b/i,
  /\bthere\s+are\s+no\s+service areas?\s+on\s+(?:the\s+)?(?:website|site)\b/i,
  /\b(?:the\s+)?(?:website|site)\s+has\s+no\s+service-area pages?\b/i,
];

const outOfScopeServicePatterns = [
  /\bsocial media\b/i,
  /\bcrm\b/i,
  /\bemail automation\b/i,
  /\bwhats\s?app\b/i,
  /\bstripe\b/i,
  /\bpayment processing\b/i,
  /\bpdf\b/i,
  /\bproposal generation\b/i,
  /\bcompetitor\b/i,
  /\bgoogle business profile\b/i,
  /\bbacklink\b/i,
  /\bchatbot\b/i,
];

export function assertOpportunityAiInsightIsSafe(
  insight: OpportunityAiInsightOutput,
  input: OpportunityAiInput,
) {
  const issues = getOpportunityAiSafetyIssues(insight, input);

  if (issues.length > 0) {
    throw new AppError(
      `AI insight failed safety validation: ${issues[0]}`,
      422,
    );
  }
}

export function getOpportunityAiSafetyIssues(
  insight: OpportunityAiInsightOutput,
  input: OpportunityAiInput,
) {
  const text = getInsightText(insight);

  return getSalesAiTextSafetyIssues(text, {
    hasAnalyzedPageEvidence: input.opportunity.evidence.some(
      (item) => item.scope === "analyzed_page",
    ),
    allowedServiceNames: input.opportunity.recommendedService
      ? [input.opportunity.recommendedService.name]
      : [],
  });
}

export function getSalesAiTextSafetyIssues(
  text: string,
  options: {
    hasAnalyzedPageEvidence: boolean;
    allowedServiceNames: string[];
  },
) {
  text = text
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u2018\u2019]/g, "'");
  const issues: string[] = [];

  if (currencyClaimPattern.test(text)) {
    issues.push("currency or revenue claim");
  }

  if (percentageClaimPattern.test(text)) {
    issues.push("percentage claim");
  }

  if (fabricatedMetricPattern.test(text)) {
    issues.push("fabricated numeric metric");
  }

  if (guaranteedResultPattern.test(text)) {
    issues.push("guaranteed result claim");
  }

  if (financialOutcomePattern.test(text)) {
    issues.push("unsupported financial outcome claim");
  }

  if (
    options.hasAnalyzedPageEvidence &&
    wholeSiteClaimPatterns.some((pattern) => pattern.test(text))
  ) {
    issues.push("unsupported whole-site claim");
  }

  if (unsupportedBusinessClaimPattern.test(text)) {
    issues.push("unsupported business offering claim");
  }

  if (outOfScopeServicePatterns.some((pattern) => pattern.test(text))) {
    issues.push("out-of-scope or unsupported service reference");
  }

  const claimsAgencyService = agencyServiceClaimPattern.test(text);

  if (options.allowedServiceNames.length === 0 && claimsAgencyService) {
    issues.push("agency service claim without mapped service");
  }

  if (
    options.allowedServiceNames.length > 0 &&
    claimsAgencyService &&
    !options.allowedServiceNames.some((name) =>
      normalizeText(text).includes(normalizeText(name)),
    )
  ) {
    issues.push("agency service claim does not reference the mapped service");
  }

  return issues;
}

function getInsightText(insight: OpportunityAiInsightOutput) {
  return [
    insight.salesSummary,
    insight.whyItMatters,
    insight.clientFacingExplanation,
    ...insight.agencyTalkingPoints,
    insight.recommendedNextStep,
  ].join("\n");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
