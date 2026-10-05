import type { EntityId, Timestamp } from "@/domain/shared";
import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";

export type OpportunityPriority = "low" | "medium" | "high";
export type OpportunityConfidence = "low" | "medium" | "high";
export type OpportunityStatus = "open" | "dismissed" | "selected";
export type OpportunityAiInsightStatus =
  | "not_generated"
  | "generating"
  | "completed"
  | "failed";
export type OpportunityEvidenceScope = "analyzed_page";
export type OpportunityEvidenceSource = "deterministic_analyzer";

export type OpportunityAnalyzerEvidence = {
  source: string;
  detail: string;
  snippet?: string;
  url?: string;
  count?: number;
};

export type OpportunityEvidence = {
  signal: string;
  observed_value: unknown;
  scope: OpportunityEvidenceScope;
  source: OpportunityEvidenceSource;
  details: string;
  analyzer_evidence?: OpportunityAnalyzerEvidence[];
};

export type Opportunity = {
  id: EntityId;
  agencyId: EntityId;
  auditId: EntityId;
  prospectId: EntityId;
  agencyServiceId: EntityId | null;
  verticalKey: VerticalPlaybookKey;
  playbookVersion: string;
  ruleKey: string;
  title: string;
  shortDescription: string;
  businessImpact: string;
  evidence: OpportunityEvidence[];
  priority: OpportunityPriority;
  confidence: OpportunityConfidence;
  recommendedServiceCategory: string;
  score: number;
  rankingRationale: string | null;
  status: OpportunityStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type OpportunityAiInsight = {
  id: EntityId;
  agencyId: EntityId;
  opportunityId: EntityId;
  status: OpportunityAiInsightStatus;
  modelProvider: string;
  modelName: string;
  promptVersion: string;
  schemaVersion: string;
  salesSummary: string | null;
  whyItMatters: string | null;
  clientFacingExplanation: string | null;
  agencyTalkingPoints: string[];
  recommendedNextStep: string | null;
  errorMessage: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
