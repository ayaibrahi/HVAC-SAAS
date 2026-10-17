import "server-only";

import {
  PROPOSAL_DRAFT_PROMPT_VERSION,
  PROPOSAL_DRAFT_SYSTEM_PROMPT,
  buildProposalDraftUserPrompt,
  PROPOSAL_COMPLETE_PROMPT_VERSION,
  PROPOSAL_COMPLETE_SYSTEM_PROMPT,
} from "@/features/proposals/ai/prompt";
import type {
  ProposalAiInput,
  ProposalAiProvider,
} from "@/features/proposals/ai/types";
import { createStructuredJsonProvider } from "@/lib/ai/provider";
import { AppError } from "@/lib/errors";
import {
  proposalAiDraftJsonSchema,
  proposalAiDraftSchemaVersion,
} from "@/lib/validation/proposal-ai";

export function createProposalAiProvider(complete = false): ProposalAiProvider {
  if (complete && process.env.AI_PROVIDER !== "groq") {
    throw new AppError(
      "Complete proposal generation requires the server Groq provider. Manual editing remains available.",
      422,
    );
  }
  const transport = createStructuredJsonProvider();

  return {
    metadata: {
      provider: transport.provider,
      model: transport.model,
      promptVersion: complete
        ? PROPOSAL_COMPLETE_PROMPT_VERSION
        : PROPOSAL_DRAFT_PROMPT_VERSION,
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
        systemPrompt: complete
          ? PROPOSAL_COMPLETE_SYSTEM_PROMPT
          : PROPOSAL_DRAFT_SYSTEM_PROMPT,
        userPrompt: buildProposalDraftUserPrompt(input),
        schemaName: "proposal_ai_draft",
        jsonSchema: proposalAiDraftJsonSchema,
        maxOutputTokens: complete ? 3500 : 1600,
      });
    },
  };
}
