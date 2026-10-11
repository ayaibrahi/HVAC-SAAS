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
import { createStructuredJsonProvider } from "@/lib/ai/provider";
import {
  proposalAiDraftJsonSchema,
  proposalAiDraftSchemaVersion,
} from "@/lib/validation/proposal-ai";

export function createProposalAiProvider(): ProposalAiProvider {
  const transport = createStructuredJsonProvider();

  return {
    metadata: {
      provider: transport.provider,
      model: transport.model,
      promptVersion: PROPOSAL_DRAFT_PROMPT_VERSION,
      schemaVersion: proposalAiDraftSchemaVersion,
    },
    generateProposalDraft(
      input: ProposalAiInput,
      options?: {
        signal?: AbortSignal;
      },
    ) {
      return transport.generate({
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
