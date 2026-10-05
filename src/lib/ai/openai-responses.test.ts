import { afterEach, describe, expect, it, vi } from "vitest";
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
});
