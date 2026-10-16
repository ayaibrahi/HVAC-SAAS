import type { ProposalBuilderData } from "./data";
import { createProposalAiInput } from "./ai/input";
import { buildProposalCopyOptions, firstProposalCopy } from "./sales-content";

export function getProposalContentSuggestion(data: ProposalBuilderData) {
  if (data.proposal.status !== "draft") return null;
  try {
    return firstProposalCopy(
      buildProposalCopyOptions(
        createProposalAiInput({
          agency: data.agency,
          builderData: data,
        }),
      ),
    );
  } catch {
    // Historical/unverified or incomplete work stays manually editable.
    return null;
  }
}
