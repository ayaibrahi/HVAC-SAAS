import { describe, expect, it } from "vitest";
import {
  opportunityAiInsightOutputSchema,
  parseOpportunityAiInsightOutput,
} from "@/lib/validation/opportunity-ai-insights";

const validInsight = {
  salesSummary:
    "The analyzed page does not surface a clear online booking path.",
  whyItMatters:
    "This may create extra friction for visitors who are ready to request service.",
  clientFacingExplanation:
    "The analyzed page did not show a direct booking option. Adding a clearer path can make the next action easier for high-intent visitors.",
  agencyTalkingPoints: [
    "The observation is limited to the analyzed page.",
    "A clearer booking path can reduce friction for service-ready visitors.",
  ],
  recommendedNextStep:
    "Review the current page CTA path and determine whether a booking flow should be surfaced.",
};

describe("opportunityAiInsightOutputSchema", () => {
  it("accepts a valid structured AI insight", () => {
    expect(opportunityAiInsightOutputSchema.parse(validInsight)).toEqual(
      validInsight,
    );
  });

  it("rejects a missing required field", () => {
    const { salesSummary, ...missingField } = validInsight;

    expect(
      opportunityAiInsightOutputSchema.safeParse(missingField).success,
    ).toBe(false);
    expect(salesSummary).toBeTypeOf("string");
  });

  it("rejects a wrong field type", () => {
    expect(
      opportunityAiInsightOutputSchema.safeParse({
        ...validInsight,
        whyItMatters: ["not a string"],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid talking point arrays", () => {
    expect(
      opportunityAiInsightOutputSchema.safeParse({
        ...validInsight,
        agencyTalkingPoints: ["Only one point"],
      }).success,
    ).toBe(false);

    expect(
      opportunityAiInsightOutputSchema.safeParse({
        ...validInsight,
        agencyTalkingPoints: ["One", "Two", "Three", "Four", "Five"],
      }).success,
    ).toBe(false);
  });

  it("parses JSON strings without repairing malformed output", () => {
    expect(parseOpportunityAiInsightOutput(JSON.stringify(validInsight))).toEqual(
      validInsight,
    );

    expect(() => parseOpportunityAiInsightOutput("{broken")).toThrow();
  });
});
