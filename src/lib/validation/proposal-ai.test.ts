import { describe, expect, it } from "vitest";
import {
  parseProposalAiDraftOutput,
  proposalAiDraftOutputSchema,
} from "@/lib/validation/proposal-ai";

const validDraft = {
  summary:
    "The analyzed page shows several page-scoped opportunities to improve conversion clarity.",
  scope:
    "1. Improve the booking path using Online Booking Integration.\n2. Clarify the service area message using Local SEO Setup.",
  nextStep:
    "Review these recommendations together and confirm which improvements should be prioritized.",
};

describe("proposalAiDraftOutputSchema", () => {
  it("accepts valid proposal draft output", () => {
    expect(proposalAiDraftOutputSchema.parse(validDraft)).toEqual(validDraft);
  });

  it("rejects missing fields and extra trusted fields", () => {
    const { summary, ...missingSummary } = validDraft;

    expect(proposalAiDraftOutputSchema.safeParse(missingSummary).success).toBe(
      false,
    );
    expect(
      proposalAiDraftOutputSchema.safeParse({
        ...validDraft,
        total: "$1,000",
      }).success,
    ).toBe(false);
    expect(summary).toBeTypeOf("string");
  });

  it("does not repair malformed JSON", () => {
    expect(parseProposalAiDraftOutput(JSON.stringify(validDraft))).toEqual(
      validDraft,
    );
    expect(() => parseProposalAiDraftOutput("{broken")).toThrow();
  });
});
