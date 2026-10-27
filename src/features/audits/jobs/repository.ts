import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { Json } from "@/lib/supabase/database.types";

const uuid = z.uuid();
const jobSchema = z.object({ job_id: uuid, audit_id: uuid, status: z.enum(["pending", "running", "completed", "failed"]) });
const leaseSchema = z.object({ job_id: uuid, audit_id: uuid, lease_token: uuid, website_url: z.string().url().max(2048), attempts: z.number().int().min(1).max(2) });
export type AuditJob = z.infer<typeof jobSchema>;
export type AuditLease = z.infer<typeof leaseSchema>;
export interface AuditJobStore {
  enqueue(input: { agencyId: string; userId: string; prospectId: string; requestKey: string }): Promise<AuditJob>;
  claim(input: { agencyId: string; jobId: string }): Promise<AuditLease | null>;
  finish(input: { agencyId: string; jobId: string; leaseToken: string; result: Json | null; retry: boolean }): Promise<boolean>;
}

// Only the authenticated server calls enqueue; workers use a separate server
// identity. No DB credential or lease is supplied to a browser sandbox.
export function createAuditJobStore(): AuditJobStore {
  const admin = createSupabaseAdminClient();
  return {
    async enqueue(input) {
      const { data, error } = await admin.rpc("enqueue_rendered_audit", {
        p_agency: uuid.parse(input.agencyId), p_user: uuid.parse(input.userId),
        p_prospect: uuid.parse(input.prospectId), p_request: uuid.parse(input.requestKey),
      });
      if (error || !data || data.length !== 1) throw new AppError("Could not start the website analysis.", 409);
      return jobSchema.parse(data[0]);
    },
    async claim(input) {
      const { data, error } = await admin.rpc("claim_rendered_audit", { p_agency: uuid.parse(input.agencyId), p_job: uuid.parse(input.jobId) });
      if (error || !data || data.length > 1) throw new AppError("Could not claim the website analysis.", 500);
      return data.length ? leaseSchema.parse(data[0]) : null;
    },
    async finish(input) {
      const { data, error } = await admin.rpc("finish_rendered_audit", {
        p_agency: uuid.parse(input.agencyId), p_job: uuid.parse(input.jobId), p_lease: uuid.parse(input.leaseToken),
        p_result: input.result, p_retry: input.retry,
      });
      if (error || typeof data !== "boolean") throw new AppError("Could not finish the website analysis.", 500);
      return data;
    },
  };
}
