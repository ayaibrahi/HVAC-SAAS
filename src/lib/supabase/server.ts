import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { AppError } from "@/lib/errors";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new AppError(
      "Supabase is not configured. Add the Supabase environment variables to .env.local.",
      500,
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always set cookies; middleware handles refresh.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
