"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  return createBrowserClient<Database>(config.url, config.anonKey);
}
