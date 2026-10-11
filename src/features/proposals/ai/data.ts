import "server-only";

import { createProposalAiInput } from "@/features/proposals/ai/input";
import { createProposalAiProvider } from "@/features/proposals/ai/provider";
import { generateValidatedProposalAiDraft } from "@/features/proposals/ai/generate";
import type { ProposalAiProvider } from "@/features/proposals/ai/types";
import { requireCurrentAgency } from "@/features/agencies/data";
import {
  applyProposalAiDraft,
  getProposalBuilderData,
} from "@/features/proposals/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { AiProviderError } from "@/lib/ai/provider-errors";
import { getPublicErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function generateProposalAiDraftForProposal(
  proposalId: string,
  provider?: ProposalAiProvider,
) {
  const { agency, user } = await requireCurrentAgency();
  const builderData = await getProposalBuilderData(proposalId);
  const aiInput = createProposalAiInput({ agency, builderData });

  await enforceAgencyUsageLimit({
    agencyId: agency.id,
    userId: user.id,
    action: "proposal_ai",
  });

  const effectiveProvider = provider ?? createProposalAiProvider();
  const startedAt = Date.now();

  try {
    const draft = await generateValidatedProposalAiDraft(
      aiInput,
      effectiveProvider,
    );

    const proposal = await applyProposalAiDraft({
      proposalId,
      summary: draft.summary,
      scope: draft.scope,
      nextStep: draft.nextStep,
      metadata: {
        provider: effectiveProvider.metadata.provider,
        model: effectiveProvider.metadata.model,
        promptVersion: effectiveProvider.metadata.promptVersion,
        schemaVersion: effectiveProvider.metadata.schemaVersion,
        generatedAt: new Date().toISOString(),
      },
    });

    logger.info("Proposal AI draft completed", {
      proposalId,
      agencyId: agency.id,
      provider: effectiveProvider.metadata.provider,
      model: effectiveProvider.metadata.model,
      promptVersion: effectiveProvider.metadata.promptVersion,
      schemaVersion: effectiveProvider.metadata.schemaVersion,
      latencyMs: Date.now() - startedAt,
    });

    return proposal;
  } catch (error) {
    logger.error("Proposal AI draft failed", {
      proposalId,
      agencyId: agency.id,
      provider: effectiveProvider.metadata.provider,
      model: effectiveProvider.metadata.model,
      promptVersion: effectiveProvider.metadata.promptVersion,
      schemaVersion: effectiveProvider.metadata.schemaVersion,
      latencyMs: Date.now() - startedAt,
      errorCategory:
        error instanceof AiProviderError ? error.category : undefined,
      providerStatus:
        error instanceof AiProviderError ? error.providerStatus : undefined,
      publicError: getPublicErrorMessage(
        error,
        "Proposal draft could not be generated safely.",
      ),
    });

    throw error;
  }
}
