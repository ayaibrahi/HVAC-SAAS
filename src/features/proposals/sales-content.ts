import type { ProposalAiInput } from "./ai/types";
import { getSalesAiTextSafetyIssues } from "@/features/opportunities/ai/safety";
import { AppError } from "@/lib/errors";
import {
  proposalAiDraftOutputSchema,
  type ProposalAiDraftOutput,
} from "@/lib/validation/proposal-ai";

export type ProposalCopyOptions = Record<keyof ProposalAiDraftOutput, string[]>;

const clientBenefits: Record<string, string> = {
  "contactConversion.ctaCount":
    "Clear contact choices can make it easier for visitors to ask for help without searching for a way to reach you.",
  "contactConversion.phoneDetected":
    "Clear contact choices can make it easier for visitors to ask for help without searching for a way to reach you.",
  "hvac.onlineBooking":
    "Clear appointment navigation may reduce the effort needed to request service.",
  "hvac.emergencyService":
    "Clear urgent-service information may help visitors who need prompt help find the appropriate contact path.",
  "hvac.financing":
    "Clear payment information may help visitors understand their options before discussing a larger repair or replacement.",
  "hvac.maintenancePlan":
    "Clear ongoing-care information may help visitors understand maintenance options and discuss their needs.",
  "hvac.serviceArea":
    "Clear coverage information may help visitors check whether their location is relevant before contacting you.",
  "hvac.hvacServicePages":
    "Clear service navigation may help visitors find the information relevant to their heating or cooling needs.",
};

const clientGoals: Record<string, string> = {
  "contactConversion.ctaCount": "a clearer path for customers to contact you",
  "contactConversion.phoneDetected":
    "a clearer path for customers to contact you",
  "hvac.onlineBooking": "clearer appointment navigation",
  "hvac.emergencyService": "clearer guidance for visitors seeking urgent help",
  "hvac.financing": "more visible payment information",
  "hvac.maintenancePlan": "more visible maintenance information",
  "hvac.serviceArea": "clearer location and coverage information",
  "hvac.hvacServicePages": "easier navigation to relevant service information",
};

// The model may select wording, not add facts or implementation commitments.
// These same bounded choices supply the editable, no-provider starting draft.
export function buildProposalCopyOptions(
  input: ProposalAiInput,
): ProposalCopyOptions {
  if (
    !input.selectedItems.length ||
    input.selectedItems.some(
      (item) =>
        !item.evidence.length ||
        item.evidence.some(
          (e) =>
            e.scope !== "analyzed_page" ||
            e.source !== "deterministic_analyzer",
        ),
    )
  )
    throw new AppError(
      "Verified page evidence and selected services are required for proposal copy.",
      422,
    );

  const observations = input.selectedItems
    .map((item) => item.evidence.map((e) => e.details).join(" "))
    .join("\n");
  const relevance = [
    ...new Set(
      input.selectedItems.map(
        (item) =>
          clientBenefits[item.evidence[0].signal] ?? item.businessImpact,
      ),
    ),
  ].join("\n");
  const solutions = input.selectedItems
    .map(
      (item) =>
        `${item.service.name}: the selected agency service for this page observation.`,
    )
    .join("\n");
  const goals = [
    ...new Set(
      input.selectedItems.map(
        (item) =>
          clientGoals[item.evidence[0].signal] ??
          "clearer information on the inspected page",
      ),
    ),
  ].join("; ");
  const selectedServices = [
    ...new Set(input.selectedItems.map((item) => item.service.name)),
  ].join(", ");
  const narrative = `What we observed\nWe inspected ${input.audit.analyzedUrl} only. These observations do not establish what the business offers elsewhere.\n${observations}\n\nWhy this matters\n${relevance}\n\nRecommended solution\n${solutions}`;
  const scope =
    input.selectedItems
      .map((item) => {
        const catalog = item.service.description?.trim();
        const configured = item.service.approvedScope?.trim();
        return [
          item.service.name,
          catalog
            ? `Service focus: ${catalog}`
            : "Specific deliverables need to be agreed before work begins.",
          configured && configured !== catalog
            ? `Proposed work: ${configured}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n") +
    "\n\nScope to confirm together: specific deliverables, implementation details, responsibilities and schedule. The service focus above is not a confirmed delivery schedule or a promise of results.";

  const options: ProposalCopyOptions = {
    summary: [
      `For ${input.prospect.businessName}, we recommend ${selectedServices} to support ${goals}.\n\n${narrative}`,
      `Prepared by ${input.agency.name} for ${input.prospect.businessName}, this recommendation focuses on ${goals}.\n\n${narrative}`,
    ],
    scope: [scope],
    nextStep: [
      "Review the recommended work and investment together. Confirm the deliverables and responsibilities, then agree a schedule before authorizing work.",
      "Discuss the proposed scope and your priorities with the agency. Agree the deliverables, pricing and schedule before work begins.",
    ],
  };
  for (const field of Object.keys(options) as (keyof ProposalAiDraftOutput)[]) {
    for (const value of options[field]) {
      if (
        getSalesAiTextSafetyIssues(value, {
          hasAnalyzedPageEvidence: true,
          allowedServiceNames: input.selectedItems.map(
            (item) => item.service.name,
          ),
        }).length ||
        /ignore (?:previous|prior|all) instructions|\b(?:system|assistant)\s*:|\bbearer\s+\S+/i.test(
          value,
        )
      ) {
        throw new AppError(
          "Saved source text needs agency review before automatic proposal drafting.",
          422,
        );
      }
    }
  }
  // Reject excessive copy instead of silently dropping evidence or truncating scope.
  for (const summary of options.summary)
    proposalAiDraftOutputSchema.parse({
      summary,
      scope,
      nextStep: options.nextStep[0],
    });
  return options;
}

export function firstProposalCopy(
  options: ProposalCopyOptions,
): ProposalAiDraftOutput {
  return {
    summary: options.summary[0],
    scope: options.scope[0],
    nextStep: options.nextStep[0],
  };
}

export function fillEmptyProposalCopy(
  current: ProposalAiDraftOutput,
  suggestion: ProposalAiDraftOutput,
): ProposalAiDraftOutput {
  return {
    summary: current.summary.trim() ? current.summary : suggestion.summary,
    scope: current.scope.trim() ? current.scope : suggestion.scope,
    nextStep: current.nextStep.trim() ? current.nextStep : suggestion.nextStep,
  };
}
