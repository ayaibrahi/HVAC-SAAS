import "server-only";

import { z } from "zod";
import {
  AI_PROVIDER_REQUEST_TOTAL_BYTES,
  assertAiSerializedInputWithinBudget,
} from "@/lib/ai/input-budget";
import { AiProviderError } from "@/lib/ai/provider-errors";
import type { StructuredJsonRequest } from "@/lib/ai/types";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const groqChatUrl = "https://api.groq.com/openai/v1/chat/completions";
// A smaller payload envelope than OpenAI, not a tokenizer or an organization
// TPM allowance. Concurrent requests can still exhaust Free Tier limits.
export const GROQ_REQUEST_TOTAL_BYTES = 24_000;
const groqResponseTotalBytes = 64_000;
const groqTimeoutMs = 30_000;
const groqEnvSchema = z.object({
  apiKey: z.string().trim().min(1),
  model: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9/._-]+$/),
});
type GroqConfig = z.infer<typeof groqEnvSchema>;

export function getGroqConfig(): GroqConfig {
  const result = groqEnvSchema.safeParse({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
  });

  if (!result.success) {
    throw new AppError(
      "Groq is not configured. Check GROQ_API_KEY and GROQ_MODEL.",
      500,
    );
  }

  return result.data;
}

export async function callGroqStructuredJson(
  input: StructuredJsonRequest,
  config: GroqConfig,
) {
  const requestBody = {
    model: config.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: input.schemaName,
        schema: input.jsonSchema,
        strict: true,
      },
    },
    reasoning_effort: "low",
    max_completion_tokens: input.maxOutputTokens,
    stream: false,
  };

  assertAiSerializedInputWithinBudget(
    "Groq request payload",
    requestBody,
    Math.min(GROQ_REQUEST_TOTAL_BYTES, AI_PROVIDER_REQUEST_TOTAL_BYTES),
  );

  const timeout = AbortSignal.timeout(groqTimeoutMs);
  const signal = input.signal
    ? AbortSignal.any([input.signal, timeout])
    : timeout;

  try {
    const response = await fetch(groqChatUrl, {
      method: "POST",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    // Error bodies are untrusted too. Never log or return their contents.
    if (!response.ok) {
      const error = await createGroqError(response);
      logger.error("Groq provider request failed", {
        providerStatus: response.status,
        category: error.category,
      });
      throw error;
    }

    const value = await readBoundedJson(response);
    if (!isRecord(value)) {
      throw new AppError("Groq returned an unexpected response.", 502);
    }
    if (value.model !== config.model) {
      throw new AiProviderError({
        message: "Groq returned a different model than configured.",
        statusCode: 502,
        category: "model",
      });
    }

    const choice = Array.isArray(value.choices) ? value.choices[0] : undefined;
    if (
      !isRecord(choice) ||
      choice.finish_reason !== "stop" ||
      !isRecord(choice.message) ||
      choice.message.role !== "assistant" ||
      choice.message.refusal ||
      choice.message.tool_calls ||
      typeof choice.message.content !== "string" ||
      !choice.message.content.trim()
    ) {
      throw new AppError(
        "Groq returned incomplete or invalid structured content.",
        502,
      );
    }

    return choice.message.content;
  } catch (error) {
    if (signal.aborted) {
      throw new AiProviderError({
        message: "Groq request timed out or was cancelled. Please retry later.",
        statusCode: 504,
        category: "timeout",
      });
    }
    if (error instanceof AppError) {
      throw error;
    }
    throw new AiProviderError({
      message: "Groq is temporarily unavailable. Please retry shortly.",
      statusCode: 502,
      category: "temporary",
    });
  }
}

async function createGroqError(response: Response) {
  let code = "";
  try {
    const value = await readBoundedJson(response);
    if (isRecord(value) && isRecord(value.error)) {
      code = typeof value.error.code === "string" ? value.error.code : "";
    }
  } catch {
    // HTTP status remains useful even if the error body is malformed.
  }

  const status = response.status;
  const retryAfterSeconds = parseRetryAfter(
    response.headers.get("retry-after"),
  );
  if (status === 429) {
    return new AiProviderError({
      message:
        retryAfterSeconds === undefined
          ? "Groq rate limit reached. Please wait before retrying."
          : `Groq rate limit reached. Wait at least ${retryAfterSeconds} seconds before retrying.`,
      statusCode: 429,
      category: "rate_limit",
      providerStatus: status,
      retryAfterSeconds,
    });
  }
  const category =
    status === 401
      ? "configuration"
      : status === 403
        ? "permission"
        : status === 404 ||
            code === "model_not_found" ||
            code === "model_decommissioned"
          ? "model"
          : status >= 500
            ? "temporary"
            : "request";
  const messages = {
    configuration: "Groq configuration needs attention. Check the API key.",
    permission:
      "Groq permission is unavailable. Check organization and model access.",
    model:
      "The configured Groq model is unavailable. Check GROQ_MODEL and model access.",
    temporary: "Groq is temporarily unavailable. Please retry shortly.",
    request:
      "Groq rejected the structured request. Check provider configuration.",
  };
  return new AiProviderError({
    message: messages[category],
    statusCode: 502,
    category,
    providerStatus: status,
  });
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = /^\d+(?:\.\d+)?$/.test(value)
    ? Number(value)
    : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds)
    : undefined;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) {
    throw new AppError("Groq returned an empty response.", 502);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > groqResponseTotalBytes) {
        await reader.cancel();
        throw new AppError("Groq response exceeded the safe size limit.", 502);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Groq returned malformed structured content.", 502);
  } finally {
    reader.releaseLock();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
