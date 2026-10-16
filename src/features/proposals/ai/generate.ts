import type { ProposalAiProvider } from "@/features/proposals/ai/types";
import { assertProposalAiDraftIsSafe } from "@/features/proposals/ai/safety";
import { assertAiSerializedInputWithinBudget } from "@/lib/ai/input-budget";
import {
  AiProviderError,
  isRetryableAiProviderError,
} from "@/lib/ai/provider-errors";
import { AppError } from "@/lib/errors";
import { parseProposalAiDraftOutput } from "@/lib/validation/proposal-ai";
import { buildProposalCopyOptions } from "../sales-content";

export const defaultProposalAiProviderTimeoutMs = 30_000;

export async function generateValidatedProposalAiDraft(
  input: Parameters<ProposalAiProvider["generateProposalDraft"]>[0],
  provider: ProposalAiProvider,
  options: {
    maxAttempts?: number;
    attemptTimeoutMs?: number;
  } = {},
) {
  assertAiSerializedInputWithinBudget("proposal AI payload", input);
  buildProposalCopyOptions(input);

  const maxAttempts = options.maxAttempts ?? 2;
  const attemptTimeoutMs =
    options.attemptTimeoutMs ?? defaultProposalAiProviderTimeoutMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const rawResponse = await callProviderWithTimeout({
        input,
        provider,
        timeoutMs: attemptTimeoutMs,
      });
      const draft = parseProposalAiDraftOutput(rawResponse);

      assertProposalAiDraftIsSafe(draft, input);

      return draft;
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

  throw new AppError("Proposal draft could not be generated safely.", 502);
}

async function callProviderWithTimeout(input: {
  input: Parameters<ProposalAiProvider["generateProposalDraft"]>[0];
  provider: ProposalAiProvider;
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
      input.provider.generateProposalDraft(input.input, {
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
