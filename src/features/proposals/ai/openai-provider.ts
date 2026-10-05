import "server-only";

import {
  PROPOSAL_DRAFT_PROMPT_VERSION,
  PROPOSAL_DRAFT_SYSTEM_PROMPT,
  buildProposalDraftUserPrompt,
} from "@/features/proposals/ai/prompt";
import type {
  ProposalAiInput,
  ProposalAiProvider,
} from "@/features/proposals/ai/types";
import {
  callOpenAiStructuredJson,
  getConfiguredOpenAiModel,
} from "@/lib/ai/openai-responses";
import {
  proposalAiDraftJsonSchema,
  proposalAiDraftSchemaVersion,
} from "@/lib/validation/proposal-ai";

export function createOpenAiProposalDraftProvider(): ProposalAiProvider {
  const model = getConfiguredOpenAiModel();

  return {
    metadata: {
      provider: "openai",
      model,
      promptVersion: PROPOSAL_DRAFT_PROMPT_VERSION,
      schemaVersion: proposalAiDraftSchemaVersion,
    },
    generateProposalDraft(
      input: ProposalAiInput,
      options?: {
        signal?: AbortSignal;
      },
    ) {
      return callOpenAiStructuredJson({
        signal: options?.signal,
        systemPrompt: PROPOSAL_DRAFT_SYSTEM_PROMPT,
        userPrompt: buildProposalDraftUserPrompt(input),
        schemaName: "proposal_ai_draft",
        jsonSchema: proposalAiDraftJsonSchema,
        maxOutputTokens: 1600,
      });
    },
  };
}
