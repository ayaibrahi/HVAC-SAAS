import "server-only";

import { z } from "zod";

const serviceRoleEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const openAiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
});

export function getSupabaseServiceRoleKey() {
  const result = serviceRoleEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return result.success ? result.data.SUPABASE_SERVICE_ROLE_KEY : null;
}

export function getOpenAiConfig() {
  const result = openAiEnvSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  });

  if (!result.success) {
    return null;
  }

  return {
    apiKey: result.data.OPENAI_API_KEY,
    model: result.data.OPENAI_MODEL,
  };
}
