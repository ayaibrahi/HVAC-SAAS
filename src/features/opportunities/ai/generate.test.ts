import { describe, expect, it } from "vitest";
import { generateValidatedOpportunityAiInsight } from "@/features/opportunities/ai/generate";
import {
  makeOpportunityAiInput,
  makeOpportunityAiInsight,
} from "@/features/opportunities/ai/test-fixtures";
import type { OpportunityAiProvider } from "@/features/opportunities/ai/types";

const metadata = {
  provider: "test",
  model: "test-model",
  promptVersion: "v1",
  schemaVersion: "1.0.0",
};

describe("generateValidatedOpportunityAiInsight", () => {
  it("returns a valid provider response", async () => {
    const insight = makeOpportunityAiInsight();
    const provider = makeProvider([insight]);

    await expect(
      generateValidatedOpportunityAiInsight(makeOpportunityAiInput(), provider),
    ).resolves.toEqual(insight);
  });

  it("fails safely when the provider throws", async () => {
    const provider: OpportunityAiProvider = {
      metadata,
      generateOpportunityInsight: async () => {
        throw new Error("provider unavailable");
      },
    };

    await expect(
      generateValidatedOpportunityAiInsight(makeOpportunityAiInput(), provider, {
        maxAttempts: 1,
      }),
    ).rejects.toThrow("AI insight could not be generated safely.");
  });

  it("fails safely when the provider returns malformed output", async () => {
    const provider = makeProvider(["{broken"]);

    await expect(
      generateValidatedOpportunityAiInsight(makeOpportunityAiInput(), provider, {
        maxAttempts: 1,
      }),
    ).rejects.toThrow("AI insight could not be generated safely.");
  });

  it("aborts a provider call that exceeds the configured timeout", async () => {
    const input = makeOpportunityAiInput();
    const before = structuredClone(input);
    let wasAborted = false;
    const provider: OpportunityAiProvider = {
      metadata,
      generateOpportunityInsight: async (_input, options) => {
        options?.signal?.addEventListener("abort", () => {
          wasAborted = true;
        });

        return new Promise(() => {});
      },
    };

    await expect(
      generateValidatedOpportunityAiInsight(input, provider, {
        maxAttempts: 1,
        attemptTimeoutMs: 5,
      }),
    ).rejects.toThrow("AI provider request timed out.");
    expect(wasAborted).toBe(true);
    expect(input).toEqual(before);
  });

  it("allows one controlled retry for invalid structured output", async () => {
    const insight = makeOpportunityAiInsight();
    const provider = makeProvider([
      JSON.stringify({ salesSummary: "missing fields" }),
      insight,
    ]);

    await expect(
      generateValidatedOpportunityAiInsight(makeOpportunityAiInput(), provider),
    ).resolves.toEqual(insight);
  });

  it("does not mutate deterministic input fields", async () => {
    const input = makeOpportunityAiInput();
    const before = structuredClone(input);
    const provider = makeProvider([makeOpportunityAiInsight()]);

    await generateValidatedOpportunityAiInsight(input, provider);

    expect(input).toEqual(before);
  });

  it("rejects oversized serialized input before calling the provider", async () => {
    const baseInput = makeOpportunityAiInput();
    const input = {
      ...baseInput,
      opportunity: {
        ...baseInput.opportunity,
        recommendedService: {
          ...baseInput.opportunity.recommendedService!,
          description: "X".repeat(40_000),
        },
      },
    };
    let providerCalls = 0;
    const provider: OpportunityAiProvider = {
      metadata,
      generateOpportunityInsight: async () => {
        providerCalls += 1;
        return makeOpportunityAiInsight();
      },
    };

    await expect(
      generateValidatedOpportunityAiInsight(input, provider),
    ).rejects.toThrow("AI input opportunity AI payload is too large");
    expect(providerCalls).toBe(0);
  });
});

function makeProvider(responses: unknown[]): OpportunityAiProvider {
  let callIndex = 0;

  return {
    metadata,
    async generateOpportunityInsight() {
      const response = responses[Math.min(callIndex, responses.length - 1)];
      callIndex += 1;

      return response;
    },
  };
}
