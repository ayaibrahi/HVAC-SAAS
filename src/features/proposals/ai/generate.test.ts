import { describe, expect, it } from "vitest";
import { generateValidatedProposalAiDraft } from "@/features/proposals/ai/generate";
import {
  makeProposalAiDraft,
  makeProposalAiInput,
} from "@/features/proposals/ai/test-fixtures";
import type { ProposalAiProvider } from "@/features/proposals/ai/types";

const metadata = {
  provider: "test",
  model: "test-model",
  promptVersion: "v1",
  schemaVersion: "1.0.0",
};

describe("generateValidatedProposalAiDraft", () => {
  it("returns a valid provider response", async () => {
    const draft = makeProposalAiDraft();
    const provider = makeProvider([draft]);

    await expect(
      generateValidatedProposalAiDraft(makeProposalAiInput(), provider),
    ).resolves.toEqual(draft);
  });

  it("rejects malformed output and unsafe claims", async () => {
    await expect(
      generateValidatedProposalAiDraft(makeProposalAiInput(), makeProvider(["{broken"]), {
        maxAttempts: 1,
      }),
    ).rejects.toThrow();

    await expect(
      generateValidatedProposalAiDraft(
        makeProposalAiInput(),
        makeProvider([
          makeProposalAiDraft({
            summary: "This will create a 30% uplift.",
          }),
        ]),
        { maxAttempts: 1 },
      ),
    ).rejects.toThrow("safety validation");
  });

  it("aborts provider requests that exceed the configured timeout", async () => {
    let wasAborted = false;
    const provider: ProposalAiProvider = {
      metadata,
      generateProposalDraft: async (_input, options) => {
        options?.signal?.addEventListener("abort", () => {
          wasAborted = true;
        });

        return new Promise(() => {});
      },
    };

    await expect(
      generateValidatedProposalAiDraft(makeProposalAiInput(), provider, {
        maxAttempts: 1,
        attemptTimeoutMs: 5,
      }),
    ).rejects.toThrow("timed out");
    expect(wasAborted).toBe(true);
  });

  it("rejects oversized serialized input before calling the provider", async () => {
    const baseInput = makeProposalAiInput();
    const input = {
      ...baseInput,
      proposal: {
        ...baseInput.proposal,
        title: "T".repeat(40_000),
      },
    };
    let providerCalls = 0;
    const provider: ProposalAiProvider = {
      metadata,
      generateProposalDraft: async () => {
        providerCalls += 1;
        return makeProposalAiDraft();
      },
    };

    await expect(generateValidatedProposalAiDraft(input, provider)).rejects.toThrow(
      "AI input proposal AI payload is too large",
    );
    expect(providerCalls).toBe(0);
  });
});

function makeProvider(responses: unknown[]): ProposalAiProvider {
  let callIndex = 0;

  return {
    metadata,
    async generateProposalDraft() {
      const response = responses[Math.min(callIndex, responses.length - 1)];
      callIndex += 1;

      return response;
    },
  };
}
