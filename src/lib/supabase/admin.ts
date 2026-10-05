import "server-only";

import { createClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/server-config";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
  const publicConfig = getSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!publicConfig || !serviceRoleKey) {
    throw new AppError(
      "Supabase server credentials are not configured for audit processing.",
      500,
    );
  }

  return createClient<Database>(publicConfig.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
