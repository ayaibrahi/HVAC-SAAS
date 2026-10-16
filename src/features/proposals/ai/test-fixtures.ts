import type { ProposalAiInput } from "@/features/proposals/ai/types";
import type { ProposalAiDraftOutput } from "@/lib/validation/proposal-ai";
import { buildProposalCopyOptions, firstProposalCopy } from "../sales-content";

export function makeProposalAiInput(
  overrides: Partial<ProposalAiInput> = {},
): ProposalAiInput {
  return {
    agency: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Example Agency",
    },
    prospect: {
      id: "33333333-3333-4333-8333-333333333333",
      businessName: "Example HVAC",
      websiteUrl: "https://example.com",
    },
    audit: {
      id: "11111111-1111-4111-8111-111111111111",
      analyzedUrl: "https://example.com",
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
      signalSchemaVersion: "1.0.0",
    },
    proposal: {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Proposal for Example HVAC",
      currency: "USD",
    },
    selectedItems: [
      {
        opportunityId: "55555555-5555-4555-8555-555555555555",
        title: "Missing Online Booking",
        shortDescription:
          "Online booking was not detected on the analyzed page.",
        businessImpact:
          "A clearer booking path can reduce friction for high-intent visitors.",
        priority: "high",
        confidence: "high",
        evidence: [
          {
            signal: "hvac.onlineBooking",
            observed_value: false,
            scope: "analyzed_page",
            source: "deterministic_analyzer",
            details:
              "No booking-related link or CTA was detected on the analyzed page.",
          },
        ],
        aiInsight: {
          salesSummary:
            "The analyzed page does not surface a clear online booking path.",
          whyItMatters:
            "This may create friction for visitors ready to request service.",
          clientFacingExplanation:
            "The analyzed page did not show a direct booking option.",
          agencyTalkingPoints: [
            "The observation is limited to the analyzed page.",
            "A clearer booking CTA can reduce friction.",
          ],
          recommendedNextStep:
            "Review the current CTA path and surface booking more clearly.",
        },
        service: {
          id: "66666666-6666-4666-8666-666666666666",
          name: "Online Booking Integration",
          description: "Connect scheduling software and booking CTAs.",
        },
      },
    ],
    ...overrides,
  };
}

export function makeProposalAiDraft(
  overrides: Partial<ProposalAiDraftOutput> = {},
): ProposalAiDraftOutput {
  return {
    ...firstProposalCopy(buildProposalCopyOptions(makeProposalAiInput())),
    ...overrides,
  };
}
