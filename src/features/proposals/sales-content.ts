import type { ProposalAiInput } from "./ai/types";
import type { OpportunityEvidence } from "@/domain/opportunities/types";
import { getSalesAiTextSafetyIssues } from "@/features/opportunities/ai/safety";
import { AppError } from "@/lib/errors";
import {
  proposalAiDraftOutputSchema,
  type ProposalAiDraftOutput,
} from "@/lib/validation/proposal-ai";

export type ProposalCopyOptions = Record<keyof ProposalAiDraftOutput, string[]>;

const clientBenefits: Record<string, string> = {
  "contactConversion.ctaCount":
    "A visitor looking for HVAC help may be ready to call or request service. Clear contact choices can make it easier to take that next step without searching for a way to reach you.",
  "contactConversion.phoneDetected":
    "A visitor looking for HVAC help may be ready to call or request service. Clear contact choices can make it easier to take that next step without searching for a way to reach you.",
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

const serviceRelevance: Record<string, string> = {
  "contactConversion.ctaCount":
    "reviewing and clarifying the page's contact path",
  "contactConversion.phoneDetected":
    "reviewing and clarifying the page's contact path",
  "hvac.onlineBooking":
    "reviewing how the page directs visitors to request an appointment",
  "hvac.emergencyService":
    "reviewing how the page directs visitors seeking urgent help",
  "hvac.financing": "reviewing how the page presents payment information",
  "hvac.maintenancePlan":
    "reviewing how the page presents ongoing-care information",
  "hvac.serviceArea":
    "reviewing how the page explains location and coverage information",
  "hvac.hvacServicePages":
    "reviewing how the page links to relevant service information",
};

function formatList(items: string[]) {
  if (items.length < 2) return items[0];
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

function describePageObservation(evidence: OpportunityEvidence[]) {
  const contactLabels: Record<string, string> = {
    "contactConversion.ctaCount": "contact or request-service action",
    "contactConversion.phoneDetected": "phone number",
    "contactConversion.contactLinkDetected": "contact link",
    "contactConversion.contactFormDetected": "inquiry form",
  };
  const missingInformation: Record<string, string> = {
    "hvac.onlineBooking": "an appointment-request link or action",
    "hvac.emergencyService":
      "emergency-service messaging or an urgent-contact action",
    "hvac.financing": "financing or payment-plan information",
    "hvac.maintenancePlan": "maintenance-plan information",
    "hvac.serviceArea": "service-area information",
  };
  const contact: string[] = [];
  const observations: string[] = [];
  for (const item of evidence) {
    const label = contactLabels[item.signal];
    const absent =
      item.signal === "contactConversion.ctaCount"
        ? item.observed_value === 0
        : item.observed_value === false;
    if (label && absent) contact.push(label);
    else if (missingInformation[item.signal] && absent)
      observations.push(
        `The page analysis did not detect ${missingInformation[item.signal]} on the analyzed page.`,
      );
    else if (item.signal === "hvac.hvacServicePages")
      observations.push(item.details);
    else
      throw new AppError(
        "Verified page evidence needs review before proposal drafting.",
        422,
      );
  }
  if (contact.length)
    observations.unshift(
      `The page analysis did not detect a ${formatList([...new Set(contact)])} on the analyzed page.`,
    );
  return [...new Set(observations)].join(" ");
}

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
    .map((item) => describePageObservation(item.evidence))
    .filter((value, index, values) => values.indexOf(value) === index)
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
        `${item.service.name} is relevant to ${serviceRelevance[item.evidence[0].signal] ?? "reviewing the page information described above"}. Specific changes are limited to the scope you agree with the agency.`,
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
  const narrative = `Page reviewed\n${input.audit.analyzedUrl}\nThe observations below concern this inspected page only, not what the business offers elsewhere.\n\nWhat we observed\n${observations}\n\nWhy this matters\n${relevance}\n\nRecommended approach\n${solutions}`;
  let scope =
    "SCOPE DRAFT - AGENCY CONFIRMATION REQUIRED\n\n" +
    input.selectedItems
      .map((item) => {
        const catalog = item.service.description?.trim();
        const configured = item.service.approvedScope?.trim();
        return [
          item.service.name,
          configured && configured !== catalog
            ? `Agency-entered work for review:\n${configured}`
            : "[Agency to specify included work, deliverables and completion checks.]\nSpecific deliverables need to be agreed before work begins.",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n") +
    "\n\nScope to confirm together\nConfirm the included work, exclusions, client inputs/access and completion checks before client delivery. Catalog capabilities alone do not define this proposal's commitments. Any schedule must be agreed separately.";

  const options: ProposalCopyOptions = {
    summary: [
      `For ${input.prospect.businessName}, we recommend ${selectedServices} to support ${goals}.\n\n${narrative}`,
      `Prepared by ${input.agency.name} for ${input.prospect.businessName}, this recommendation focuses on ${goals}.\n\n${narrative}`,
    ],
    scope: [scope],
    nextStep: [
      "Review the proposed work and quoted investment with the agency. Confirm the deliverables, exclusions and required client inputs, then agree how to proceed before authorizing work.",
      "Discuss the proposed scope and investment with the agency. Confirm what is included, how completion will be checked and what the agency needs from you before agreeing to proceed.",
    ],
  };
  if (input.mode === "complete") {
    const seen = new Set<string>();
    const approvedOffer = [
      ...new Map(
        input.selectedItems.map((item) => [item.service.id, item.service]),
      ).values(),
    ]
      .map(
        (service) =>
          `${service.name}: ${service.contractScope?.deliverables ?? ""}`,
      )
      .join("\n");
    scope =
      input.selectedItems
        .filter(
          (item) =>
            !seen.has(item.service.id) && Boolean(seen.add(item.service.id)),
        )
        .map((item) => {
          const approved = item.service.contractScope;
          if (!approved)
            throw new AppError(
              "Approved service scope is required for complete generation.",
              422,
            );
          return `${item.service.name}\nIncluded deliverables\n${approved.deliverables}\nExclusions and qualifications\n${approved.exclusions}\nClient inputs and access\n${approved.clientInputs}\nCompletion checks\n${approved.completionChecks}`;
        })
        .join("\n\n") +
      "\n\nOnly the deliverables listed here are included. A service title does not add unlisted work. The investment table states the quoted quantities, unit prices, discount and total. Scheduling and any work outside this scope require separate agreement. No performance outcome is promised.";
    const clientNarrative = `What we found on your page\n${observations}\n\nWhy this matters to your customers\n${relevance}\n\nPage reviewed\n${input.audit.analyzedUrl}\nThese observations concern this inspected page only, not what your business offers elsewhere.`;
    options.summary = [
      `Dear ${input.prospect.businessName} team,\n\n${input.agency.name} recommends a focused project to support ${goals}. For visitors looking for HVAC help, the aim is a clearer next step, guided by the page observations below and limited to the work you agree.\n\nYour proposed project\n${approvedOffer}\n\nThe quotation for ${selectedServices} is limited to the deliverables in Scope and is subject to its exclusions. The service title does not imply additional features, software or a wider implementation.\n\n${clientNarrative}\n\nReview limits\nThis review inspected the returned HTML of the identified page. Other pages, interactive behavior and actual contact or booking functionality were not tested. Non-detection is not proof that a service or feature is unavailable.`,
      `Prepared for ${input.prospect.businessName} by ${input.agency.name}\n\nWe propose a defined piece of work to support ${goals}, based on the observations below. The investment pays for the agreed work, not a promised number of leads or a financial return.\n\nYour proposed project\n${approvedOffer}\n\n${selectedServices} identifies the proposed service. Only the deliverables and exclusions in Scope define what is included; the name does not imply a larger package.\n\n${clientNarrative}\n\nReview limits\nOnly the returned HTML of the identified page was inspected. Other pages and interactive contact or booking functionality were not tested. Non-detection does not establish an unavailable business service.`,
    ];
    options.scope = [scope];
    options.nextStep = [
      "Please confirm whether this defined project fits your priorities. Review the deliverables, exclusions and quoted investment with the agency, confirm the required access and completion checks, then agree the schedule and authorize the scope before work begins.",
      "Discuss the proposed project and quoted investment with the agency. Confirm what is included, provide the agreed inputs and resolve questions about exclusions or completion checks before agreeing the schedule and authorizing work.",
    ];
  }
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
  for (const summary of options.summary) {
    const result = proposalAiDraftOutputSchema.safeParse({
      summary,
      scope,
      nextStep: options.nextStep[0],
    });
    if (!result.success) {
      throw new AppError(
        "Selected findings and scope exceed proposal draft limits. Shorten approved scope or select fewer findings before generating.",
        413,
      );
    }
  }
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
