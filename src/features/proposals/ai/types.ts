import type { CurrencyCode } from "@/config/currencies";
import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";
import type {
  OpportunityConfidence,
  OpportunityEvidence,
  OpportunityPriority,
} from "@/domain/opportunities/types";
import type { EntityId } from "@/domain/shared";

export type ProposalAiInput = {
  agency: {
    id: EntityId;
    name: string;
  };
  prospect: {
    id: EntityId;
    businessName: string;
    websiteUrl: string;
  };
  audit: {
    id: EntityId;
    analyzedUrl: string;
    verticalKey: VerticalPlaybookKey;
    playbookVersion: string;
    signalSchemaVersion: string;
  };
  proposal: {
    id: EntityId;
    title: string;
    currency: CurrencyCode;
  };
  selectedItems: ProposalAiSelectedItem[];
};

export type ProposalAiSelectedItem = {
  opportunityId: EntityId;
  title: string;
  shortDescription: string;
  businessImpact: string;
  priority: OpportunityPriority;
  confidence: OpportunityConfidence;
  evidence: OpportunityEvidence[];
  aiInsight: {
    salesSummary: string | null;
    whyItMatters: string | null;
    clientFacingExplanation: string | null;
    agencyTalkingPoints: string[];
    recommendedNextStep: string | null;
  } | null;
  service: {
    id: EntityId;
    name: string;
    description: string | null;
    approvedScope?: string | null;
  };
};

export type ProposalAiProviderMetadata = {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
};

export type ProposalAiProvider = {
  metadata: ProposalAiProviderMetadata;
  generateProposalDraft(
    input: ProposalAiInput,
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<unknown>;
};
