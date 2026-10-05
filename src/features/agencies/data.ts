import type { User } from "@supabase/supabase-js";
import type { Agency } from "@/domain/agencies/types";
import type { AgencyInput } from "@/lib/validation/agencies";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AgencyRow = Database["public"]["Tables"]["agencies"]["Row"];

export function mapAgency(row: AgencyRow): Agency {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    website: row.website,
    defaultCurrency: row.default_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function requireCurrentUser(supabase?: SupabaseServerClient) {
  const client = supabase ?? (await createSupabaseServerClient());
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new AppError("Sign in to continue.", 401);
  }

  return { supabase: client, user };
}

export async function ensureUserProfile(supabase: SupabaseServerClient, user: User) {
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name:
        typeof user.user_metadata.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new AppError("We could not prepare your user profile.", 500);
  }
}

export async function getAgencyForUser(
  userId: string,
  supabase?: SupabaseServerClient,
) {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("agencies")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load your agency profile.", 500);
  }

  return data ? mapAgency(data) : null;
}

export async function requireCurrentAgency() {
  const supabase = await createSupabaseServerClient();
  const { user } = await requireCurrentUser(supabase);
  const agency = await getAgencyForUser(user.id, supabase);

  if (!agency) {
    throw new AppError("Create your agency profile first.", 403);
  }

  return { supabase, user, agency };
}

export async function upsertAgencyForCurrentUser(input: AgencyInput) {
  const supabase = await createSupabaseServerClient();
  const { user } = await requireCurrentUser(supabase);

  await ensureUserProfile(supabase, user);

  const existingAgency = await getAgencyForUser(user.id, supabase);

  if (existingAgency) {
    const { data, error } = await supabase
      .from("agencies")
      .update({
        name: input.name,
        website: input.website ?? null,
        default_currency: input.defaultCurrency,
      })
      .eq("id", existingAgency.id)
      .select("*")
      .single();

    if (error) {
      throw new AppError("We could not update your agency profile.", 500);
    }

    return mapAgency(data);
  }

  const { data, error } = await supabase
    .from("agencies")
    .insert({
      owner_user_id: user.id,
      name: input.name,
      website: input.website ?? null,
      default_currency: input.defaultCurrency,
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not create your agency profile.", 500);
  }

  return mapAgency(data);
}
