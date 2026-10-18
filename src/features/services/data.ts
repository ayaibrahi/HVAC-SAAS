import type { AgencyService } from "@/domain/services/types";
import type { AgencyServiceInput } from "@/lib/validation/services";
import type { Database } from "@/lib/supabase/database.types";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCurrentAgency } from "@/features/agencies/data";
import { readApprovedServiceScope } from "@/lib/validation/service-scope";

type ServiceRow = Database["public"]["Tables"]["agency_services"]["Row"];

export async function isApprovedServiceScopeAvailable() {
  const { supabase, agency } = await requireCurrentAgency();
  const { error } = await supabase
    .from("agency_services")
    .select("approved_scope")
    .eq("agency_id", agency.id)
    .limit(0);
  if (error && ["42703", "PGRST204"].includes(error.code)) return false;
  if (error)
    throw new AppError(
      "We could not verify service scope availability. No changes were saved.",
      503,
    );
  return true;
}

async function approvedScopeWrite(input: AgencyServiceInput) {
  // Older API callers that do not supply scope preserve any existing approval.
  if (input.approvedScope === undefined) return {};
  const available = await isApprovedServiceScopeAvailable();
  if (!available && input.approvedScope !== null) {
    throw new AppError(
      "Approved service scope requires the pending database migration. No service changes were saved.",
      409,
    );
  }
  return available ? { approved_scope: input.approvedScope } : {};
}

function mapService(row: ServiceRow): AgencyService {
  return {
    id: row.id,
    agencyId: row.agency_id,
    name: row.name,
    description: row.description,
    approvedScope: readApprovedServiceScope(row.approved_scope),
    price: Number(row.price),
    currency: row.currency,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAgencyServices(agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agency_services")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load your services.", 500);
  }

  return data.map(mapService);
}

export async function getAgencyService(serviceId: string, agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agency_services")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that service.", 500);
  }

  return data ? mapService(data) : null;
}

export async function createAgencyService(input: AgencyServiceInput) {
  const { supabase, agency } = await requireCurrentAgency();
  const scopeWrite = await approvedScopeWrite(input);
  const { data, error } = await supabase
    .from("agency_services")
    .insert({
      agency_id: agency.id,
      name: input.name,
      description: input.description ?? null,
      ...scopeWrite,
      price: input.price,
      currency: input.currency,
      is_active: input.isActive,
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not create that service.", 500);
  }

  return mapService(data);
}

export async function updateAgencyService(
  serviceId: string,
  input: AgencyServiceInput,
) {
  const { supabase, agency } = await requireCurrentAgency();
  const scopeWrite = await approvedScopeWrite(input);
  const { data, error } = await supabase
    .from("agency_services")
    .update({
      name: input.name,
      description: input.description ?? null,
      ...scopeWrite,
      price: input.price,
      currency: input.currency,
      is_active: input.isActive,
    })
    .eq("agency_id", agency.id)
    .eq("id", serviceId)
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not update that service.", 500);
  }

  return mapService(data);
}

export async function setAgencyServiceActive(
  serviceId: string,
  isActive: boolean,
) {
  const { supabase, agency } = await requireCurrentAgency();
  const { error } = await supabase
    .from("agency_services")
    .update({ is_active: isActive })
    .eq("agency_id", agency.id)
    .eq("id", serviceId);

  if (error) {
    throw new AppError("We could not update that service.", 500);
  }
}

export async function deleteAgencyService(serviceId: string) {
  const { supabase, agency } = await requireCurrentAgency();
  const { error } = await supabase
    .from("agency_services")
    .delete()
    .eq("agency_id", agency.id)
    .eq("id", serviceId);

  if (error) {
    throw new AppError("We could not delete that service.", 500);
  }
}
