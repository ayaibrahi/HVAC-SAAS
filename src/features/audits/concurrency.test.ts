import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isActiveAuditStatus,
  isUniqueViolation,
} from "@/features/audits/concurrency";

describe("audit concurrency helpers", () => {
  it("treats only pending and running audits as active", () => {
    expect(isActiveAuditStatus("pending")).toBe(true);
    expect(isActiveAuditStatus("running")).toBe(true);
    expect(isActiveAuditStatus("completed")).toBe(false);
    expect(isActiveAuditStatus("failed")).toBe(false);
  });

  it("detects database unique violations for duplicate active audit claims", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "PGRST116" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("keeps the database invariant to one active audit per prospect", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20261008084137_enforce_single_active_audit_per_prospect.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("audits_one_active_per_prospect_idx");
    expect(migration).toContain("on public.audits(agency_id, prospect_id)");
    expect(migration).toContain("where status in ('pending', 'running')");
  });
});
