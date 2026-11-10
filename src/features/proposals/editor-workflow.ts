import "server-only";
import type { UpdateProposalInput } from "@/lib/validation/proposals";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import { getProposalBuilderData, updateProposalDraft } from "./data";
import { getCompleteProposalRevision } from "./ai/complete-revision";
import { generateCompleteProposalForProposal } from "./ai/data";
import { createDeliverySnapshotForProposal } from "./delivery/data";

// Both actions submit the actual editor fields; catalog approval still comes
// exclusively from the authenticated tenant's persisted services.
export async function runProposalEditorWorkflow(
  input: UpdateProposalInput,
  revision: FormDataEntryValue | null,
  intent: "generate" | "prepare",
) {
  const before = await getProposalBuilderData(input.proposalId);
  if (
    typeof revision !== "string" ||
    revision !== getCompleteProposalRevision(before)
  ) {
    throw new AppError(
      "This proposal or its catalog changed. Reload and review before continuing. No changes were saved.",
      409,
    );
  }
  if (intent === "generate" && before.proposal.status !== "draft") {
    throw new AppError(
      "Only a Draft can receive AI copy. Your Ready proposal is preserved.",
      422,
    );
  }
  if (
    intent === "generate" &&
    input.summary.trim() &&
    input.scope.trim() &&
    input.nextStep.trim()
  ) {
    throw new AppError(
      "All proposal text fields are filled. Review your text and use Save as Ready & Prepare Client Version; AI will not overwrite it.",
      422,
    );
  }
  if (intent === "generate" && input.lineItems.length === 0) {
    throw new AppError(
      "Select at least one finding and its catalog service before generating a complete proposal.",
      422,
    );
  }
  const saved = await updateProposalDraft(input);
  try {
    if (intent === "generate") {
      const current = await getProposalBuilderData(input.proposalId);
      if (current.proposal.updatedAt !== saved.updatedAt) {
        throw new AppError(
          "The draft changed after saving. Reload before generating.",
          409,
        );
      }
      const selectedScopes = (data: typeof before) =>
        input.lineItems.map((line) =>
          data.services.find((service) => service.id === line.agencyServiceId),
        );
      if (
        JSON.stringify(selectedScopes(current)) !==
        JSON.stringify(selectedScopes(before))
      ) {
        throw new AppError(
          "A selected catalog service changed while saving. Reload and review its scope and price before generating.",
          409,
        );
      }
      await generateCompleteProposalForProposal(
        input.proposalId,
        undefined,
        getCompleteProposalRevision(current),
        true,
      );
    } else {
      await createDeliverySnapshotForProposal(
        input.proposalId,
        saved.updatedAt,
      );
    }
  } catch (error) {
    throw new AppError(
      `Your proposal was saved${intent === "prepare" ? " as Ready" : " as Draft"}, but ${intent === "generate" ? "generation" : "client-version preparation"} did not complete. ${getPublicErrorMessage(error, "The operation could not be confirmed.")} Reload this proposal to check its saved state before trying again.`,
      409,
    );
  }
}
