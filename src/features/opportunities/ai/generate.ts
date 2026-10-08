import type { OpportunityAiProvider } from "@/features/opportunities/ai/types";
import { assertOpportunityAiInsightIsSafe } from "@/features/opportunities/ai/safety";
import { assertAiSerializedInputWithinBudget } from "@/lib/ai/input-budget";
import {
  AiProviderError,
  isRetryableAiProviderError,
} from "@/lib/ai/provider-errors";
import { AppError } from "@/lib/errors";
import { parseOpportunityAiInsightOutput } from "@/lib/validation/opportunity-ai-insights";

export const defaultOpportunityAiProviderTimeoutMs = 30_000;

export async function generateValidatedOpportunityAiInsight(
  input: Parameters<OpportunityAiProvider["generateOpportunityInsight"]>[0],
  provider: OpportunityAiProvider,
  options: {
    maxAttempts?: number;
    attemptTimeoutMs?: number;
  } = {},
) {
  assertAiSerializedInputWithinBudget("opportunity AI payload", input);

  const maxAttempts = options.maxAttempts ?? 2;
  const attemptTimeoutMs =
    options.attemptTimeoutMs ?? defaultOpportunityAiProviderTimeoutMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const rawResponse = await callProviderWithTimeout({
        input,
        provider,
        timeoutMs: attemptTimeoutMs,
      });
      const insight = parseOpportunityAiInsightOutput(rawResponse);

      assertOpportunityAiInsightIsSafe(insight, input);

      return insight;
    } catch (error) {
      lastError = error;
      if (
        error instanceof AiProviderError &&
        !isRetryableAiProviderError(error)
      ) {
        throw error;
      }
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError("AI insight could not be generated safely.", 502);
}

async function callProviderWithTimeout(input: {
  input: Parameters<OpportunityAiProvider["generateOpportunityInsight"]>[0];
  provider: OpportunityAiProvider;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new AppError("AI provider request timed out.", 504));
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([
      input.provider.generateOpportunityInsight(input.input, {
        signal: controller.signal,
      }),
      timeout,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
