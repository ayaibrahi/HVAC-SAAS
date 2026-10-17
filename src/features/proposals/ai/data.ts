import "server-only";

import { createProposalAiInput } from "@/features/proposals/ai/input";
import { createProposalAiProvider } from "@/features/proposals/ai/provider";
import { generateValidatedProposalAiDraft } from "@/features/proposals/ai/generate";
import type { ProposalAiProvider } from "@/features/proposals/ai/types";
import { requireCurrentAgency } from "@/features/agencies/data";
import {
  applyProposalAiDraft,
  getProposalBuilderData,
  claimCompleteProposalGeneration,
  releaseCompleteProposalGeneration,
} from "@/features/proposals/data";
import { createCompleteProposalInput } from "./complete-input";
import { buildProposalCopyOptions } from "../sales-content";
import { getCompleteProposalRevision } from "./complete-revision";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { AiProviderError } from "@/lib/ai/provider-errors";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function generateProposalAiDraftForProposal(
  proposalId: string,
  provider?: ProposalAiProvider,
) {
  const { agency, user } = await requireCurrentAgency();
  const builderData = await getProposalBuilderData(proposalId);
  const saved = builderData.proposal;
  const expectedUpdatedAt = saved.updatedAt;
  const lease = saved.content?.proposalAiLease as
    { startedAt?: unknown } | undefined;
  if (
    typeof lease?.startedAt === "number" &&
    Date.now() - lease.startedAt < 90_000
  ) {
    throw new AppError(
      "This proposal is already generating. Wait before trying again.",
      409,
    );
  }
  if (
    saved.status !== "draft" ||
    saved.summary.trim() ||
    saved.scope.trim() ||
    saved.nextStep.trim()
  ) {
    throw new AppError(
      "Existing proposal text is preserved. Edit it manually, or save an empty draft before requesting new AI copy.",
      409,
    );
  }
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
      expectedUpdatedAt,
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

export async function generateCompleteProposalForProposal(
  proposalId: string,
  provider?: ProposalAiProvider,
  expectedRevision?: string,
) {
  const { agency, user } = await requireCurrentAgency();
  const data = await getProposalBuilderData(proposalId);
  if (
    expectedRevision &&
    expectedRevision !== getCompleteProposalRevision(data)
  ) {
    throw new AppError(
      "Saved selections, approved scope or prices changed since this page was opened. Reload and confirm them again.",
      409,
    );
  }
  if (
    data.agency.id !== agency.id ||
    data.proposal.status !== "draft" ||
    data.proposal.summary.trim() ||
    data.proposal.scope.trim() ||
    data.proposal.nextStep.trim()
  ) {
    throw new AppError(
      "Existing text is preserved. Complete generation requires an empty saved Draft.",
      409,
    );
  }
  const input = createCompleteProposalInput(data);
  buildProposalCopyOptions(input); // Reject unsafe source text before reserving/provider usage.
  const effectiveProvider = provider ?? createProposalAiProvider(true);
  if (effectiveProvider.metadata.provider !== "groq") {
    throw new AppError(
      "Complete proposal generation requires Groq; no alternate provider will be used.",
      422,
    );
  }
  const fingerprint = (current: typeof data) =>
    JSON.stringify({
      input: createCompleteProposalInput(current),
      prices: [...current.lineItemsByOpportunityId.values()].map(
        ({ opportunityId, quantity, unitPrice, lineTotal, position }) => ({
          opportunityId,
          quantity,
          unitPrice,
          lineTotal,
          position,
        }),
      ),
      totals: [
        current.proposal.currency,
        current.proposal.subtotal,
        current.proposal.discountType,
        current.proposal.discountValue,
        current.proposal.discountAmount,
        current.proposal.total,
      ],
    });
  const original = fingerprint(data);
  const lease = await claimCompleteProposalGeneration(
    proposalId,
    data.proposal.updatedAt,
  );
  try {
    await enforceAgencyUsageLimit({
      agencyId: agency.id,
      userId: user.id,
      action: "proposal_ai",
    });
    const draft = await generateValidatedProposalAiDraft(
      input,
      effectiveProvider,
    );
    const current = await getProposalBuilderData(proposalId);
    if (
      current.proposal.updatedAt !== lease.updatedAt ||
      fingerprint(current) !== original
    ) {
      throw new AppError(
        "Selections, scope or prices changed during generation. Reload; saved edits are preserved.",
        409,
      );
    }
    return await applyProposalAiDraft({
      proposalId,
      expectedUpdatedAt: lease.updatedAt,
      generationToken: lease.token,
      ...draft,
      metadata: {
        ...effectiveProvider.metadata,
        generatedAt: new Date().toISOString(),
        mode: "complete",
        approvedScopes: input.selectedItems.map((item) => ({
          serviceId: item.service.id,
          ...item.service.contractScope,
        })),
      },
    });
  } finally {
    // Cleanup is conditional and never rewrites narrative or successful content.
    try {
      await releaseCompleteProposalGeneration(proposalId, lease.token);
    } catch {
      logger.error("Proposal generation lease cleanup deferred", {
        proposalId,
      });
    }
  }
}
