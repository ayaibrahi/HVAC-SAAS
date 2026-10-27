import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Static guardrails only. This does not execute PostgreSQL or validate RLS,
// transactions, locking or function resolution; a local DB rehearsal is required.
const sql = readFileSync(new URL("../../../../supabase/migrations/202610270001_rendered_audit_jobs.sql", import.meta.url), "utf8");
it("keeps lease tokens and all queue RPC writes server-only", () => {
  expect(sql).toMatch(/enable row level security/i);
  expect(sql).toMatch(/revoke all on public\.rendered_audit_jobs from public, anon, authenticated/i);
  for (const name of ["enqueue_rendered_audit", "claim_rendered_audit", "finish_rendered_audit"]) {
    expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${name}\\([^;]+from public, anon, authenticated`, "i"));
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]+to service_role`, "i"));
  }
  expect(sql).not.toMatch(/create policy[^;]+on public\.rendered_audit_jobs/i);
});
it("requires tenant ownership, bounded leases, two attempts and fenced completion", () => {
  expect(sql).toContain("a.owner_user_id = p_user");
  expect(sql).toContain("unique (agency_id, request_key)");
  expect(sql).toContain("for update");
  expect(sql).toContain("v_job.attempts >= 2");
  expect(sql).toContain("interval '120 seconds'");
  expect(sql).toContain("v_job.lease_token is distinct from p_lease");
  expect(sql).toContain("v_job.lease_expires_at <= clock_timestamp()");
});
