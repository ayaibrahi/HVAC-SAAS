import "server-only";

import {
  AI_PROVIDER_REQUEST_TOTAL_BYTES,
  assertAiSerializedInputWithinBudget,
} from "@/lib/ai/input-budget";
import { AiProviderError, classifyOpenAiError } from "@/lib/ai/provider-errors";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getOpenAiConfig } from "@/lib/supabase/server-config";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";

type SafeProviderError = {
  code?: string;
  type?: string;
  param?: string;
  message?: string;
};

export type OpenAiStructuredJsonRequest = {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
};

export function getConfiguredOpenAiModel() {
  const config = getOpenAiConfig();

  if (!config) {
    throw new AppError("AI provider is not configured.", 500);
  }

  return config.model;
}

export async function callOpenAiStructuredJson(
  input: OpenAiStructuredJsonRequest,
) {
  const config = getOpenAiConfig();

  if (!config) {
    throw new AppError("AI provider is not configured.", 500);
  }

  const requestBody = {
    model: config.model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: input.systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input.userPrompt,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        schema: input.jsonSchema,
        strict: true,
      },
    },
    store: false,
    max_output_tokens: input.maxOutputTokens,
  };

  assertAiSerializedInputWithinBudget(
    "OpenAI request payload",
    requestBody,
    AI_PROVIDER_REQUEST_TOTAL_BYTES,
  );

  const response = await fetch(openAiResponsesUrl, {
    method: "POST",
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw await createOpenAiProviderError(response);
  }

  return extractResponseText((await response.json()) as unknown);
}

async function createOpenAiProviderError(response: Response) {
  const providerError = await readSafeProviderError(response);
  const classification = classifyOpenAiError({
    status: response.status,
    errorCode: providerError.code,
    errorType: providerError.type,
    errorParam: providerError.param,
    errorMessage: providerError.message,
  });

  logger.error("OpenAI provider request failed", {
    providerStatus: response.status,
    providerErrorCode: providerError.code,
    providerErrorType: providerError.type,
    providerErrorParam: providerError.param,
    category: classification.category,
  });

  return new AiProviderError({
    message: classification.message,
    statusCode: classification.statusCode,
    category: classification.category,
    providerStatus: response.status,
    providerErrorCode: providerError.code,
    providerErrorType: providerError.type,
    providerErrorParam: providerError.param,
  });
}

async function readSafeProviderError(
  response: Response,
): Promise<SafeProviderError> {
  try {
    const value = (await response.clone().json()) as unknown;

    if (!isRecord(value) || !isRecord(value.error)) {
      return {};
    }

    return {
      code: readProviderString(value.error.code),
      type: readProviderString(value.error.type),
      param: readProviderString(value.error.param),
      message: readProviderString(value.error.message),
    };
  } catch {
    return {};
  }
}

function readProviderString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 120) : undefined;
}

function extractResponseText(value: unknown) {
  if (!isRecord(value)) {
    throw new AppError("AI provider returned an unexpected response.", 502);
  }

  if (typeof value.output_text === "string" && value.output_text.length > 0) {
    return value.output_text;
  }

  const output = Array.isArray(value.output) ? value.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  if (textParts.length === 0) {
    throw new AppError("AI provider returned no structured content.", 502);
  }

  return textParts.join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
