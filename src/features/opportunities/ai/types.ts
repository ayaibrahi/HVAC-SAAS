import type {
  OpportunityConfidence,
  OpportunityPriority,
} from "@/domain/opportunities/types";
import type { EntityId } from "@/domain/shared";
import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";

export type OpportunityAiEvidence = {
  signal: string;
  observedValue: unknown;
  scope: "analyzed_page";
  source: "deterministic_analyzer";
  details: string;
};

export type OpportunityAiInput = {
  verticalKey: "hvac";
  audit: {
    id: EntityId;
    analyzedUrl: string;
    verticalKey: VerticalPlaybookKey;
    playbookVersion: string;
    signalSchemaVersion: string;
  };
  opportunity: {
    id: EntityId;
    ruleKey: string;
    title: string;
    shortDescription: string;
    businessImpact: string;
    priority: OpportunityPriority;
    confidence: OpportunityConfidence;
    rankingScore: number;
    rankingRationale: string | null;
    evidence: OpportunityAiEvidence[];
    recommendedServiceCategory: string;
    recommendedService: {
      id: EntityId;
      name: string;
      description: string | null;
    } | null;
  };
};

export type OpportunityAiProviderMetadata = {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
};

export type OpportunityAiProvider = {
  metadata: OpportunityAiProviderMetadata;
  generateOpportunityInsight(
    input: OpportunityAiInput,
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<unknown>;
};
