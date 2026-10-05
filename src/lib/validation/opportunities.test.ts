import { describe, expect, it } from "vitest";
import {
  generateOpportunitiesInputSchema,
  opportunityEvidenceSchema,
} from "@/lib/validation/opportunities";

describe("opportunity validation", () => {
  it("accepts valid generation input and structured evidence", () => {
    expect(
      generateOpportunitiesInputSchema.parse({
        auditId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      auditId: "11111111-1111-4111-8111-111111111111",
    });

    expect(
      opportunityEvidenceSchema.parse({
        signal: "hvac.onlineBooking",
        observed_value: false,
        scope: "analyzed_page",
        source: "deterministic_analyzer",
        details: "No booking-related CTA was detected on the analyzed page.",
      }),
    ).toMatchObject({
      signal: "hvac.onlineBooking",
      scope: "analyzed_page",
      source: "deterministic_analyzer",
    });
  });

  it("rejects invalid audit IDs and unscoped evidence", () => {
    expect(
      generateOpportunitiesInputSchema.safeParse({ auditId: "audit-1" }).success,
    ).toBe(false);

    expect(
      opportunityEvidenceSchema.safeParse({
        signal: "hvac.onlineBooking",
        observed_value: false,
        scope: "whole_website",
        source: "deterministic_analyzer",
        details: "No booking found.",
      }).success,
    ).toBe(false);
  });
});
