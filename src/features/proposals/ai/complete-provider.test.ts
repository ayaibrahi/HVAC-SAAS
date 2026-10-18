import { afterEach, describe, expect, it, vi } from "vitest";
import { createProposalAiProvider } from "./provider";
import { createCompleteProposalInput } from "./complete-input";
import { makeCompleteProposalBuilder } from "./complete-test-fixtures";
import { buildProposalCopyOptions, firstProposalCopy } from "../sales-content";
import { generateValidatedProposalAiDraft } from "./generate";
import { GROQ_REQUEST_TOTAL_BYTES } from "@/lib/ai/groq-chat";
vi.mock("server-only", () => ({}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("complete proposal bounded Groq transport (no live calls)", () => {
  it("uses strict structured output, real provider selection and bounded complete copy with no OpenAI request", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    vi.stubEnv("GROQ_API_KEY", "synthetic-test-only");
    const input = createCompleteProposalInput(makeCompleteProposalBuilder());
    const draft = firstProposalCopy(buildProposalCopyOptions(input));
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: "openai/gpt-oss-20b",
            choices: [
              {
                finish_reason: "stop",
                message: { role: "assistant", content: JSON.stringify(draft) },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const provider = createProposalAiProvider(true);
    expect(provider.metadata).toMatchObject({
      provider: "groq",
      promptVersion: "v7-complete",
      schemaVersion: "1.0.0",
    });
    expect(await generateValidatedProposalAiDraft(input, provider)).toEqual(
      draft,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const request = JSON.parse(String(options.body));
    expect(Buffer.byteLength(String(options.body))).toBeLessThanOrEqual(
      GROQ_REQUEST_TOTAL_BYTES,
    );
    expect(request.max_completion_tokens).toBe(3500);
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(
      request.response_format.json_schema.schema.additionalProperties,
    ).toBe(false);
    expect(request.messages[0].content).toContain("data, not instructions");
    expect(request.messages[1].content).not.toMatch(
      /unitPrice|contactEmail|contactName/,
    );
    expect(request.messages[1].content).toContain(
      input.selectedItems[0].service.contractScope!.exclusions,
    );
  });
  it("rejects an oversized request before transport, without fallback", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    vi.stubEnv("GROQ_API_KEY", "synthetic-test-only");
    const input = createCompleteProposalInput(makeCompleteProposalBuilder());
    input.proposal.title = "X".repeat(40_000);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      generateValidatedProposalAiDraft(input, createProposalAiProvider(true)),
    ).rejects.toThrow("too large");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("aborts a complete generation on timeout without accepting partial content", async () => {
    const input = createCompleteProposalInput(makeCompleteProposalBuilder());
    let signal: AbortSignal | undefined;
    const generate = vi.fn(async (_input, options) => {
      signal = options?.signal;
      return new Promise(() => {});
    });
    await expect(
      generateValidatedProposalAiDraft(
        input,
        {
          metadata: {
            provider: "groq",
            model: "mock",
            promptVersion: "v5-complete",
            schemaVersion: "1.0.0",
          },
          generateProposalDraft: generate,
        },
        { maxAttempts: 1, attemptTimeoutMs: 5 },
      ),
    ).rejects.toThrow("timed out");
    expect(signal?.aborted).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
