import { describe, expect, it } from "vitest";
import {
  AiProviderError,
  classifyOpenAiError,
  isRetryableAiProviderError,
} from "@/lib/ai/provider-errors";

describe("classifyOpenAiError", () => {
  it("classifies quota failures without exposing provider payloads", () => {
    const result = classifyOpenAiError({
      status: 429,
      errorCode: "insufficient_quota",
      errorType: "billing_error",
      errorMessage: "You have exceeded your quota.",
    });

    expect(result.category).toBe("quota");
    expect(result.message).toContain("quota");
    expect(result.message).not.toContain("You have exceeded your quota");
  });

  it("classifies invalid or unsupported model failures", () => {
    const result = classifyOpenAiError({
      status: 400,
      errorParam: "model",
      errorMessage: "The model does not exist.",
    });

    expect(result.category).toBe("model");
    expect(result.message).toContain("OPENAI_MODEL");
  });

  it("keeps provider diagnostics in server-only fields", () => {
    const error = new AiProviderError({
      message: "Safe message.",
      statusCode: 502,
      category: "permission",
      providerStatus: 403,
      providerErrorCode: "forbidden",
      providerErrorType: "permission_error",
      providerErrorParam: "model",
    });

    expect(error.message).toBe("Safe message.");
    expect(error.providerStatus).toBe(403);
    expect(error.providerErrorCode).toBe("forbidden");
    expect(error.providerErrorType).toBe("permission_error");
    expect(error.providerErrorParam).toBe("model");
  });

  it("only retries temporary or unknown provider failures", () => {
    const quota = new AiProviderError({
      message: "Quota",
      statusCode: 429,
      category: "quota",
    });
    const temporary = new AiProviderError({
      message: "Temporary",
      statusCode: 502,
      category: "temporary",
    });

    expect(isRetryableAiProviderError(quota)).toBe(false);
    expect(isRetryableAiProviderError(temporary)).toBe(true);
  });
});
