import { AppError } from "@/lib/errors";

export type AiProviderErrorCategory =
  | "configuration"
  | "model"
  | "permission"
  | "quota"
  | "timeout"
  | "temporary"
  | "request"
  | "unknown";

export class AiProviderError extends AppError {
  readonly category: AiProviderErrorCategory;
  readonly providerStatus?: number;
  readonly providerErrorCode?: string;
  readonly providerErrorType?: string;
  readonly providerErrorParam?: string;

  constructor(input: {
    message: string;
    statusCode: number;
    category: AiProviderErrorCategory;
    providerStatus?: number;
    providerErrorCode?: string;
    providerErrorType?: string;
    providerErrorParam?: string;
  }) {
    super(input.message, input.statusCode);
    this.name = "AiProviderError";
    this.category = input.category;
    this.providerStatus = input.providerStatus;
    this.providerErrorCode = input.providerErrorCode;
    this.providerErrorType = input.providerErrorType;
    this.providerErrorParam = input.providerErrorParam;
  }
}

export function isRetryableAiProviderError(error: AiProviderError) {
  return error.category === "temporary" || error.category === "unknown";
}

export function classifyOpenAiError(input: {
  status: number;
  errorCode?: string | null;
  errorType?: string | null;
  errorParam?: string | null;
  errorMessage?: string | null;
}) {
  const message = input.errorMessage?.toLowerCase() ?? "";
  const code = input.errorCode?.toLowerCase() ?? "";
  const param = input.errorParam?.toLowerCase() ?? "";

  if (input.status === 401) {
    return {
      category: "configuration" as const,
      message:
        "AI provider configuration needs attention. Please check the API key.",
      statusCode: 502,
    };
  }

  if (input.status === 403) {
    return {
      category: "permission" as const,
      message:
        "AI provider permission is unavailable for this request. Please check provider access.",
      statusCode: 502,
    };
  }

  if (input.status === 429) {
    return {
      category: "quota" as const,
      message:
        "AI usage or quota is unavailable right now. Please check provider billing or limits.",
      statusCode: 429,
    };
  }

  if (
    input.status === 400 &&
    (param === "model" ||
      code.includes("model") ||
      message.includes("model") ||
      message.includes("unsupported"))
  ) {
    return {
      category: "model" as const,
      message:
        "The configured AI model is not available for this request. Please check OPENAI_MODEL.",
      statusCode: 502,
    };
  }

  if (input.status === 400) {
    return {
      category: "request" as const,
      message:
        "AI provider rejected the structured request. Please check provider configuration.",
      statusCode: 502,
    };
  }

  if (input.status >= 500) {
    return {
      category: "temporary" as const,
      message: "AI provider is temporarily unavailable. Please retry shortly.",
      statusCode: 502,
    };
  }

  return {
    category: "unknown" as const,
    message: "AI provider request failed. Please retry shortly.",
    statusCode: 502,
  };
}
