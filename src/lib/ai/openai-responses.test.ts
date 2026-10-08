import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderError } from "@/lib/ai/provider-errors";
import { callOpenAiStructuredJson } from "@/lib/ai/openai-responses";

vi.mock("server-only", () => ({}));

describe("callOpenAiStructuredJson", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects oversized serialized request bodies before calling OpenAI", async () => {
    const fetchMock = vi.fn();

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callOpenAiStructuredJson({
        systemPrompt: "System prompt",
        userPrompt: "x".repeat(80_000),
        schemaName: "test_schema",
        jsonSchema: { type: "object", additionalProperties: false },
        maxOutputTokens: 100,
      }),
    ).rejects.toThrow("AI input OpenAI request payload is too large");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies provider quota failures without exposing raw payloads", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "Your account secret-ish quota payload",
              type: "billing_error",
              code: "insufficient_quota",
              param: null,
            },
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      callOpenAiStructuredJson({
        systemPrompt: "System prompt",
        userPrompt: "User prompt",
        schemaName: "test_schema",
        jsonSchema: { type: "object", additionalProperties: false },
        maxOutputTokens: 100,
      }),
    ).rejects.toMatchObject({
      category: "quota",
      providerStatus: 429,
      providerErrorCode: "insufficient_quota",
      message:
        "AI usage or quota is unavailable right now. Please check provider billing or limits.",
    } satisfies Partial<AiProviderError>);
  });

  it("classifies model request failures as OPENAI_MODEL issues", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "unsupported-model");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "The requested model is unsupported.",
              type: "invalid_request_error",
              code: "model_not_found",
              param: "model",
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      callOpenAiStructuredJson({
        systemPrompt: "System prompt",
        userPrompt: "User prompt",
        schemaName: "test_schema",
        jsonSchema: { type: "object", additionalProperties: false },
        maxOutputTokens: 100,
      }),
    ).rejects.toMatchObject({
      category: "model",
      providerStatus: 400,
      providerErrorParam: "model",
      message:
        "The configured AI model is not available for this request. Please check OPENAI_MODEL.",
    } satisfies Partial<AiProviderError>);
  });
});
