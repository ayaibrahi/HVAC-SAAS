import "server-only";

import type { Audit } from "@/domain/audits/types";
import type { Json, Database } from "@/lib/supabase/database.types";
import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";
import { isUniqueViolation } from "@/features/audits/concurrency";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

export function mapAudit(row: AuditRow): Audit {
  return {
    id: row.id,
    agencyId: row.agency_id,
    prospectId: row.prospect_id,
    status: row.status,
    websiteUrl: row.website_url,
    finalUrl: row.final_url,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    normalizedSignals:
      row.normalized_signals && typeof row.normalized_signals === "object"
        ? (row.normalized_signals as Record<string, unknown>)
        : {},
    signalSchemaVersion: row.signal_schema_version,
    verticalKey: row.vertical_key,
    playbookVersion: row.playbook_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAuditsForAgency(agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load audits.", 500);
  }

  return data.map(mapAudit);
}

export async function getActiveAuditForProspect(input: {
  agencyId: string;
  prospectId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("agency_id", input.agencyId)
    .eq("prospect_id", input.prospectId)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not check the current audit state.", 500);
  }

  return data ? mapAudit(data) : null;
}

export async function createPendingAudit(input: {
  agencyId: string;
  prospectId: string;
  websiteUrl: string;
  verticalKey: VerticalPlaybookKey;
  playbookVersion: string;
  signalSchemaVersion: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .insert({
      agency_id: input.agencyId,
      prospect_id: input.prospectId,
      status: "pending",
      website_url: input.websiteUrl,
      final_url: null,
      normalized_signals: {},
      signal_schema_version: input.signalSchemaVersion,
      vertical_key: input.verticalKey,
      playbook_version: input.playbookVersion,
    })
    .select("*")
    .single();

  if (isUniqueViolation(error)) {
    throw new AppError(
      "Analysis is already in progress for this prospect.",
      409,
    );
  }

  if (error) {
    throw new AppError("We could not create the audit record.", 500);
  }

  return mapAudit(data);
}

export async function markAuditRunning(auditId: string, agencyId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq("id", auditId)
    .eq("agency_id", agencyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not start the audit.", 500);
  }

  return mapAudit(data);
}

export async function markAuditCompleted(input: {
  auditId: string;
  agencyId: string;
  finalUrl: string;
  normalizedSignals: Json;
  signalSchemaVersion: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
      final_url: input.finalUrl,
      normalized_signals: input.normalizedSignals,
      signal_schema_version: input.signalSchemaVersion,
    })
    .eq("id", input.auditId)
    .eq("agency_id", input.agencyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not complete the audit.", 500);
  }

  return mapAudit(data);
}

export async function markAuditFailed(input: {
  auditId: string;
  agencyId: string;
  errorCode: string;
  errorMessage: string;
  normalizedSignals?: Json;
  finalUrl?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: input.errorCode,
      error_message: input.errorMessage,
      ...(input.normalizedSignals
        ? { normalized_signals: input.normalizedSignals }
        : {}),
      ...(input.finalUrl ? { final_url: input.finalUrl } : {}),
    })
    .eq("id", input.auditId)
    .eq("agency_id", input.agencyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not record the audit failure.", 500);
  }

  return mapAudit(data);
}
