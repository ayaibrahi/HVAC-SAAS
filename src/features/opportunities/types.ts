import type {
  OpportunityConfidence,
  OpportunityEvidence,
  OpportunityPriority,
} from "@/domain/opportunities/types";
import type { EntityId } from "@/domain/shared";
import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";

export const opportunityRuleKeys = [
  "missing_online_booking",
  "weak_emergency_conversion",
  "financing_visibility",
  "maintenance_plan_visibility",
  "service_area_local_seo",
  "hvac_service_visibility",
  "weak_lead_capture",
] as const;

export type OpportunityRuleKey = (typeof opportunityRuleKeys)[number];

export type OpportunityDraft = {
  verticalKey: VerticalPlaybookKey;
  playbookVersion: string;
  ruleKey: OpportunityRuleKey;
  title: string;
  shortDescription: string;
  businessImpact: string;
  evidence: OpportunityEvidence[];
  priority: OpportunityPriority;
  confidence: OpportunityConfidence;
  recommendedServiceCategory: string;
};

export type MappedOpportunityDraft = OpportunityDraft & {
  agencyServiceId: EntityId | null;
};

export type RankedOpportunityDraft = MappedOpportunityDraft & {
  score: number;
  rankingRationale: string;
  rank: number;
};
