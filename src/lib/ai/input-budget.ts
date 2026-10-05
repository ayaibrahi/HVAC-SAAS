import { AppError } from "@/lib/errors";

export const AI_INPUT_TOTAL_SERIALIZED_BYTES = 32_000;
export const AI_PROVIDER_REQUEST_TOTAL_BYTES = 64_000;

// Server-side prompt-input limits. These mirror realistic MVP field sizes and
// protect provider calls from values created outside the browser/UI validators.
export const AI_INPUT_TEXT_LIMITS = {
  id: 80,
  url: 2048,
  version: 32,
  agencyName: 120,
  prospectBusinessName: 160,
  proposalTitle: 160,
  serviceName: 120,
  serviceDescription: 1000,
  opportunityRuleKey: 120,
  opportunityTitle: 160,
  opportunityDescription: 1000,
  opportunityBusinessImpact: 1000,
  opportunityRankingRationale: 400,
  recommendedServiceCategory: 160,
  evidenceSignal: 160,
  evidenceDetails: 600,
  aiInsightText: 1600,
  aiTalkingPoint: 300,
} as const;

export const AI_INPUT_COLLECTION_LIMITS = {
  evidenceItems: 10,
  proposalSelectedItems: 10,
  agencyTalkingPoints: 4,
} as const;

export const AI_INPUT_JSON_VALUE_LIMITS = {
  observedValueBytes: 1000,
} as const;

const aiInputTooLargeMessage =
  "is too large to process safely. Shorten saved agency, prospect, service, or proposal text and try again.";

export function budgetAiText(
  value: string,
  input: {
    field: string;
    maxLength: number;
    truncate?: boolean;
  },
) {
  if (value.length <= input.maxLength) {
    return value;
  }

  if (input.truncate) {
    return value.slice(0, input.maxLength).trimEnd();
  }

  throw createAiInputBudgetError(input.field);
}

export function budgetNullableAiText(
  value: string | null,
  input: {
    field: string;
    maxLength: number;
    truncate?: boolean;
  },
) {
  return value === null ? null : budgetAiText(value, input);
}

export function assertAiArrayWithinLimit<T>(
  value: T[],
  input: {
    field: string;
    maxItems: number;
  },
) {
  if (value.length > input.maxItems) {
    throw createAiInputBudgetError(input.field);
  }
}

export function assertAiJsonValueWithinBudget(
  value: unknown,
  input: {
    field: string;
    maxBytes: number;
  },
) {
  if (byteLength(JSON.stringify(value)) > input.maxBytes) {
    throw createAiInputBudgetError(input.field);
  }
}

export function assertAiSerializedInputWithinBudget(
  label: string,
  value: unknown,
  maxBytes = AI_INPUT_TOTAL_SERIALIZED_BYTES,
) {
  if (byteLength(JSON.stringify(value)) > maxBytes) {
    throw createAiInputBudgetError(label);
  }
}

function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function createAiInputBudgetError(context: string) {
  return new AppError(`AI input ${context} ${aiInputTooLargeMessage}`, 413);
}
