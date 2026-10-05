import type { Prospect } from "@/domain/prospects/types";
import type { ProspectInput } from "@/lib/validation/prospects";
import type { Database } from "@/lib/supabase/database.types";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCurrentAgency } from "@/features/agencies/data";

type ProspectRow = Database["public"]["Tables"]["prospects"]["Row"];

function mapProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    agencyId: row.agency_id,
    businessName: row.business_name,
    websiteUrl: row.website_url,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProspects(agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load your prospects.", 500);
  }

  return data.map(mapProspect);
}

export async function getProspect(prospectId: string, agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("id", prospectId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that prospect.", 500);
  }

  return data ? mapProspect(data) : null;
}

export async function createProspect(input: ProspectInput) {
  const { supabase, agency } = await requireCurrentAgency();
  const { data, error } = await supabase
    .from("prospects")
    .insert({
      agency_id: agency.id,
      business_name: input.businessName,
      website_url: input.websiteUrl,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not create that prospect.", 500);
  }

  return mapProspect(data);
}

export async function updateProspect(prospectId: string, input: ProspectInput) {
  const { supabase, agency } = await requireCurrentAgency();
  const { data, error } = await supabase
    .from("prospects")
    .update({
      business_name: input.businessName,
      website_url: input.websiteUrl,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      notes: input.notes ?? null,
    })
    .eq("agency_id", agency.id)
    .eq("id", prospectId)
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not update that prospect.", 500);
  }

  return mapProspect(data);
}

export async function deleteProspect(prospectId: string) {
  const { supabase, agency } = await requireCurrentAgency();
  const { error } = await supabase
    .from("prospects")
    .delete()
    .eq("agency_id", agency.id)
    .eq("id", prospectId);

  if (error) {
    throw new AppError("We could not delete that prospect.", 500);
  }
}
