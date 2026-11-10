import { describe, expect, it } from "vitest";
import { approvedServiceScopeSchema, readApprovedServiceScope } from "./service-scope";

describe("approved scope optional fields", () => {
  it.each([undefined, null, "", "  "])("normalizes optional %s without inventing commitments", value => {
    expect(readApprovedServiceScope({ deliverables: " Review contact CTA wording. ", exclusions: value, clientInputs: value, completionChecks: value })).toEqual({
      deliverables: "Review contact CTA wording.", exclusions: "", clientInputs: "", completionChecks: "",
    });
  });
  it.each([undefined, null, "", "   "])("requires deliverables with friendly feedback: %s", deliverables => {
    const result = approvedServiceScopeSchema.safeParse({ deliverables });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Please enter the included deliverables before approving this scope.");
  });
  it.each(["deliverables", "exclusions", "clientInputs", "completionChecks"])("still rejects oversized or non-text %s", field => {
    expect(readApprovedServiceScope({ deliverables: "CTA review", [field]: "x".repeat(801) })).toBeNull();
    expect(readApprovedServiceScope({ deliverables: "CTA review", [field]: 42 })).toBeNull();
  });
  it("does not create approval from null or unexpected fields", () => {
    expect(readApprovedServiceScope(null)).toBeNull();
    expect(readApprovedServiceScope({ deliverables: "CTA review", extra: "unapproved" })).toBeNull();
  });
});
