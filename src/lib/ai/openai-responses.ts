import "server-only";

import {
  AI_PROVIDER_REQUEST_TOTAL_BYTES,
  assertAiSerializedInputWithinBudget,
} from "@/lib/ai/input-budget";
import { AppError } from "@/lib/errors";
import { getOpenAiConfig } from "@/lib/supabase/server-config";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";

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
    throw new AppError("AI provider request failed.", 502);
  }

  return extractResponseText((await response.json()) as unknown);
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
