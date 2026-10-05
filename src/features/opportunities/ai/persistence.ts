import type { OpportunityAiProviderMetadata } from "@/features/opportunities/ai/types";
import type { Json, Database } from "@/lib/supabase/database.types";
import type { OpportunityAiInsightOutput } from "@/lib/validation/opportunity-ai-insights";

type OpportunityAiInsightInsert =
  Database["public"]["Tables"]["opportunity_ai_insights"]["Insert"];
type OpportunityAiInsightUpdate =
  Database["public"]["Tables"]["opportunity_ai_insights"]["Update"];

export function createGeneratingInsightRow(input: {
  agencyId: string;
  opportunityId: string;
  metadata: OpportunityAiProviderMetadata;
}): OpportunityAiInsightInsert {
  return {
    agency_id: input.agencyId,
    opportunity_id: input.opportunityId,
    status: "generating",
    model_provider: input.metadata.provider,
    model_name: input.metadata.model,
    prompt_version: input.metadata.promptVersion,
    schema_version: input.metadata.schemaVersion,
    sales_summary: null,
    why_it_matters: null,
    client_facing_explanation: null,
    agency_talking_points: [],
    recommended_next_step: null,
    error_message: null,
  };
}

export function createGeneratingInsightUpdate(input: {
  metadata: OpportunityAiProviderMetadata;
}): OpportunityAiInsightUpdate {
  return {
    status: "generating",
    model_provider: input.metadata.provider,
    model_name: input.metadata.model,
    prompt_version: input.metadata.promptVersion,
    schema_version: input.metadata.schemaVersion,
    error_message: null,
  };
}

export function createCompletedInsightUpdate(input: {
  metadata: OpportunityAiProviderMetadata;
  insight: OpportunityAiInsightOutput;
}): OpportunityAiInsightUpdate {
  return {
    status: "completed",
    model_provider: input.metadata.provider,
    model_name: input.metadata.model,
    prompt_version: input.metadata.promptVersion,
    schema_version: input.metadata.schemaVersion,
    sales_summary: input.insight.salesSummary,
    why_it_matters: input.insight.whyItMatters,
    client_facing_explanation: input.insight.clientFacingExplanation,
    agency_talking_points: input.insight.agencyTalkingPoints as unknown as Json,
    recommended_next_step: input.insight.recommendedNextStep,
    error_message: null,
  };
}

export function createFailedInsightUpdate(input: {
  metadata: OpportunityAiProviderMetadata;
  errorMessage: string;
}): OpportunityAiInsightUpdate {
  return {
    status: "failed",
    model_provider: input.metadata.provider,
    model_name: input.metadata.model,
    prompt_version: input.metadata.promptVersion,
    schema_version: input.metadata.schemaVersion,
    error_message: input.errorMessage,
  };
}
