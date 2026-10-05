import { describe, expect, it } from "vitest";
import {
  assertAiJsonValueWithinBudget,
  assertAiSerializedInputWithinBudget,
  budgetAiText,
} from "@/lib/ai/input-budget";

describe("AI input budget", () => {
  it("truncates explicitly safe text fields deterministically", () => {
    expect(
      budgetAiText("abcdefgh", {
        field: "service.description",
        maxLength: 5,
        truncate: true,
      }),
    ).toBe("abcde");
  });

  it("rejects fields that cannot be safely truncated", () => {
    expect(() =>
      budgetAiText("abcdefgh", {
        field: "opportunity.evidence.0.details",
        maxLength: 5,
      }),
    ).toThrow("AI input opportunity.evidence.0.details is too large");
  });

  it("rejects oversized nested JSON values", () => {
    expect(() =>
      assertAiJsonValueWithinBudget(
        { repeated: "x".repeat(100) },
        {
          field: "opportunity.evidence.0.observedValue",
          maxBytes: 25,
        },
      ),
    ).toThrow("AI input opportunity.evidence.0.observedValue is too large");
  });

  it("rejects oversized serialized payloads", () => {
    expect(() =>
      assertAiSerializedInputWithinBudget(
        "proposal AI payload",
        { repeated: "x".repeat(100) },
        25,
      ),
    ).toThrow("AI input proposal AI payload is too large");
  });
});
