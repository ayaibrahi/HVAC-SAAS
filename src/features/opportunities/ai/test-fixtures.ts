import type { OpportunityAiInput } from "@/features/opportunities/ai/types";
import type { OpportunityAiInsightOutput } from "@/lib/validation/opportunity-ai-insights";

export function makeOpportunityAiInput(
  overrides: Partial<OpportunityAiInput> = {},
): OpportunityAiInput {
  return {
    verticalKey: "hvac",
    audit: {
      id: "11111111-1111-4111-8111-111111111111",
      analyzedUrl: "https://example.com",
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
      signalSchemaVersion: "1.0.0",
    },
    opportunity: {
      id: "22222222-2222-4222-8222-222222222222",
      ruleKey: "missing_online_booking",
      title: "Missing Online Booking",
      shortDescription:
        "Online booking or scheduling was not detected on the analyzed page.",
      businessImpact:
        "Clear booking paths can reduce friction for high-intent visitors.",
      priority: "high",
      confidence: "high",
      rankingScore: 91,
      rankingRationale:
        "Priority 35, confidence 25, evidence 6, HVAC relevance 16, service match present.",
      evidence: [
        {
          signal: "hvac.onlineBooking",
          observedValue: false,
          scope: "analyzed_page",
          source: "deterministic_analyzer",
          details:
            "No booking-related link or CTA was detected on the analyzed page.",
        },
      ],
      recommendedServiceCategory: "Online Booking Integration",
      recommendedService: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Online Booking Integration",
        description: "Connect scheduling software and booking CTAs.",
      },
    },
    ...overrides,
  };
}

export function makeOpportunityAiInsight(
  overrides: Partial<OpportunityAiInsightOutput> = {},
): OpportunityAiInsightOutput {
  return {
    salesSummary:
      "The analyzed page does not surface a clear online booking path.",
    whyItMatters:
      "This may create extra friction for visitors who are ready to request HVAC service.",
    clientFacingExplanation:
      "The analyzed page did not show a direct booking option. Surfacing a clearer booking path can make the next action easier for high-intent visitors.",
    agencyTalkingPoints: [
      "The observation is limited to the analyzed page.",
      "A clearer booking CTA can reduce friction for ready-to-book visitors.",
      "The agency can address this through Online Booking Integration.",
    ],
    recommendedNextStep:
      "Review the current CTA path and map the best place to surface Online Booking Integration.",
    ...overrides,
  };
}
