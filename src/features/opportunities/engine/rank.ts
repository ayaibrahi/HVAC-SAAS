import type {
  MappedOpportunityDraft,
  OpportunityRuleKey,
  RankedOpportunityDraft,
} from "@/features/opportunities/types";

export const maxRankedOpportunities = 5;

export const opportunityRuleOrder: Record<OpportunityRuleKey, number> = {
  missing_online_booking: 1,
  weak_emergency_conversion: 2,
  service_area_local_seo: 3,
  weak_lead_capture: 4,
  hvac_service_visibility: 5,
  financing_visibility: 6,
  maintenance_plan_visibility: 7,
};

const priorityWeights = {
  high: 35,
  medium: 22,
  low: 10,
} as const;

const confidenceWeights = {
  high: 25,
  medium: 15,
  low: 6,
} as const;

const hvacRelevanceWeights: Record<OpportunityRuleKey, number> = {
  missing_online_booking: 16,
  weak_emergency_conversion: 18,
  service_area_local_seo: 16,
  weak_lead_capture: 15,
  hvac_service_visibility: 14,
  financing_visibility: 12,
  maintenance_plan_visibility: 12,
};

export function rankOpportunities(
  opportunities: MappedOpportunityDraft[],
): RankedOpportunityDraft[] {
  return opportunities
    .map((opportunity) => {
      const scoreParts = getScoreParts(opportunity);
      const score = Math.min(
        100,
        scoreParts.priority +
          scoreParts.confidence +
          scoreParts.evidence +
          scoreParts.relevance +
          scoreParts.serviceMatch,
      );

      return {
        ...opportunity,
        score,
        rankingRationale: buildRankingRationale(scoreParts),
        rank: 0,
      };
    })
    .sort(compareRankedOpportunities)
    .slice(0, maxRankedOpportunities)
    .map((opportunity, index) => ({
      ...opportunity,
      rank: index + 1,
    }));
}

function compareRankedOpportunities(
  left: RankedOpportunityDraft,
  right: RankedOpportunityDraft,
) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return opportunityRuleOrder[left.ruleKey] - opportunityRuleOrder[right.ruleKey];
}

function getScoreParts(opportunity: MappedOpportunityDraft) {
  return {
    priority: priorityWeights[opportunity.priority],
    confidence: confidenceWeights[opportunity.confidence],
    evidence: getEvidenceStrength(opportunity),
    relevance: hvacRelevanceWeights[opportunity.ruleKey],
    serviceMatch: opportunity.agencyServiceId ? 12 : 0,
  };
}

function getEvidenceStrength(opportunity: MappedOpportunityDraft) {
  const baseEvidence = Math.min(18, opportunity.evidence.length * 6);
  const analyzerEvidence = opportunity.evidence.some(
    (item) => (item.analyzer_evidence?.length ?? 0) > 0,
  )
    ? 4
    : 0;

  return Math.min(22, baseEvidence + analyzerEvidence);
}

function buildRankingRationale(scoreParts: ReturnType<typeof getScoreParts>) {
  const serviceText =
    scoreParts.serviceMatch > 0 ? "service match present" : "no service match";

  return `Priority ${scoreParts.priority}, confidence ${scoreParts.confidence}, evidence ${scoreParts.evidence}, HVAC relevance ${scoreParts.relevance}, ${serviceText}.`;
}
