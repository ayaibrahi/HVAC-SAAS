import { z } from "zod";

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function getSupabasePublicConfig() {
  const result = publicSupabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    return null;
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseConfigured() {
  return getSupabasePublicConfig() !== null;
}
