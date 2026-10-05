import "server-only";

import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UsageLimitAction =
  | "website_analyzer"
  | "opportunity_ai"
  | "proposal_ai";

type UsageLimitConfig = {
  maxRequests: number;
  windowMs: number;
  message: string;
};

type UsageLimitRpcClient = Pick<
  ReturnType<typeof createSupabaseAdminClient>,
  "rpc"
>;

const oneHourMs = 60 * 60 * 1000;

export const agencyUsageLimitConfig = {
  website_analyzer: {
    maxRequests: 10,
    windowMs: oneHourMs,
    message:
      "Analyzer usage limit reached. Please wait before analyzing another prospect.",
  },
  opportunity_ai: {
    maxRequests: 20,
    windowMs: oneHourMs,
    message:
      "AI insight usage limit reached. Please wait before generating more insights.",
  },
  proposal_ai: {
    maxRequests: 10,
    windowMs: oneHourMs,
    message:
      "Proposal AI usage limit reached. Please wait before generating another draft.",
  },
} satisfies Record<UsageLimitAction, UsageLimitConfig>;

export async function enforceAgencyUsageLimit(input: {
  agencyId: string;
  userId: string;
  action: UsageLimitAction;
  admin?: UsageLimitRpcClient;
  now?: () => number;
}) {
  const config = agencyUsageLimitConfig[input.action];
  const now = input.now?.() ?? Date.now();
  const windowStart = new Date(
    Math.floor(now / config.windowMs) * config.windowMs,
  ).toISOString();
  const admin = input.admin ?? createSupabaseAdminClient();
  const { data, error } = await admin
    .rpc("consume_agency_rate_limit", {
      p_agency_id: input.agencyId,
      p_action_key: input.action,
      p_window_start: windowStart,
      p_window_seconds: Math.floor(config.windowMs / 1000),
      p_max_requests: config.maxRequests,
      p_requested_by: input.userId,
    })
    .single();

  if (error) {
    throw new AppError("Usage limit could not be checked.", 500);
  }

  if (!data.allowed) {
    throw new AppError(config.message, 429);
  }

  return {
    remaining: data.remaining,
    resetAt: data.reset_at,
  };
}

export async function runWithAgencyUsageLimit<T>(
  input: Parameters<typeof enforceAgencyUsageLimit>[0],
  operation: () => Promise<T>,
) {
  await enforceAgencyUsageLimit(input);

  return operation();
}
