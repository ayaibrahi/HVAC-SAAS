import type { ProposalAiInput } from "@/features/proposals/ai/types";
import { getSalesAiTextSafetyIssues } from "@/features/opportunities/ai/safety";
import { AppError } from "@/lib/errors";
import type { ProposalAiDraftOutput } from "@/lib/validation/proposal-ai";
import { buildProposalCopyOptions } from "../sales-content";

export function assertProposalAiDraftIsSafe(
  draft: ProposalAiDraftOutput,
  input: ProposalAiInput,
) {
  const issues = getProposalAiDraftSafetyIssues(draft, input);

  if (issues.length > 0) {
    throw new AppError(
      `Proposal AI draft failed safety validation: ${issues[0]}`,
      422,
    );
  }
}

export function getProposalAiDraftSafetyIssues(
  draft: ProposalAiDraftOutput,
  input: ProposalAiInput,
) {
  const text = [draft.summary, draft.scope, draft.nextStep].join("\n");

  const issues = getSalesAiTextSafetyIssues(text, {
    hasAnalyzedPageEvidence: input.selectedItems.some((item) =>
      item.evidence.some((evidence) => evidence.scope === "analyzed_page"),
    ),
    allowedServiceNames: input.selectedItems.map((item) => item.service.name),
  });
  const options = buildProposalCopyOptions(input);
  for (const field of ["summary", "scope", "nextStep"] as const) {
    if (!options[field].includes(draft[field]))
      issues.push(`unsupported ${field} wording or commitment`);
  }
  return issues;
}
