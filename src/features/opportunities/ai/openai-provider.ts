import "server-only";

import {
  OPPORTUNITY_INSIGHT_PROMPT_VERSION,
  OPPORTUNITY_INSIGHT_SYSTEM_PROMPT,
  buildOpportunityInsightUserPrompt,
} from "@/features/opportunities/ai/prompt";
import type {
  OpportunityAiInput,
  OpportunityAiProvider,
} from "@/features/opportunities/ai/types";
import {
  callOpenAiStructuredJson,
  getConfiguredOpenAiModel,
} from "@/lib/ai/openai-responses";
import {
  opportunityAiInsightJsonSchema,
  opportunityAiInsightSchemaVersion,
} from "@/lib/validation/opportunity-ai-insights";

export function createOpenAiOpportunityInsightProvider(): OpportunityAiProvider {
  const model = getConfiguredOpenAiModel();

  return {
    metadata: {
      provider: "openai",
      model,
      promptVersion: OPPORTUNITY_INSIGHT_PROMPT_VERSION,
      schemaVersion: opportunityAiInsightSchemaVersion,
    },
    async generateOpportunityInsight(
      input: OpportunityAiInput,
      options?: {
        signal?: AbortSignal;
      },
    ) {
      return callOpenAiStructuredJson({
        signal: options?.signal,
        systemPrompt: OPPORTUNITY_INSIGHT_SYSTEM_PROMPT,
        userPrompt: buildOpportunityInsightUserPrompt(input),
        schemaName: "opportunity_ai_insight",
        jsonSchema: opportunityAiInsightJsonSchema,
        maxOutputTokens: 1200,
      });
    },
  };
}
