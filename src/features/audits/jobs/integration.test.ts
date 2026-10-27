import { describe, expect, it, vi } from "vitest";
import type { Prospect } from "@/domain/prospects/types";
import type { Json } from "@/lib/supabase/database.types";
import type { AuditJob, AuditJobStore, AuditLease } from "./repository";
import { submitRenderedAuditJob } from "./submit";
import { executeRenderedAuditJob, WorkerUnavailableBeforeStart } from "./execute";
import { readRenderedAudit, describeRenderedCoverage } from "../rendered/pipeline";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { makeAudit, makeDetectedSignals, makeService } from "@/features/opportunities/test-fixtures";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RenderedCoverage } from "@/features/prospects/components/rendered-coverage";

// Deterministic store models the contract only; it does not substitute for a
// concurrent PostgreSQL/RLS test of the unapplied migration.
function fixtureStore() {
  const job: AuditJob = { job_id: "job", audit_id: "audit", status: "pending" };
  let attempts = 0, token = "", result: Json | null = null, owner = "agency";
  const store: AuditJobStore = {
    async enqueue(input) { if (input.agencyId !== owner || input.prospectId !== "prospect") throw new Error("not owned"); return job; },
    async claim(input) {
      if (input.agencyId !== owner || input.jobId !== job.job_id || job.status !== "pending") return null;
      attempts++; token = `lease-${attempts}`; job.status = "running";
      return { job_id: job.job_id, audit_id: job.audit_id, lease_token: token, website_url: "https://example.com/", attempts } as AuditLease;
    },
    async finish(input) {
      if (input.agencyId !== owner || input.jobId !== job.job_id || input.leaseToken !== token || job.status !== "running") return false;
      result = input.result; job.status = result ? "completed" : input.retry && attempts < 2 ? "pending" : "failed"; return true;
    },
  };
  return { store, job, result: () => result, replaceLease: () => { token = "newer"; }, setOwner: (value: string) => { owner = value; } };
}
const prospect: Prospect = { id: "prospect", agencyId: "agency", businessName: "Fixture", websiteUrl: "https://example.com/", contactName: null, contactEmail: null, notes: null, createdAt: "", updatedAt: "" };
function fixtureWorker() {
  return {
    capture: vi.fn(async ({ url, viewport }: { url: string; viewport: "desktop" | "mobile" }) => JSON.stringify({
      requestedUrl: url, finalUrl: url, viewport, status: "observed", reasons: [], httpStatus: 200, elapsedMs: 1,
      document: { title: "Heating and cooling", headings: ["Heating services"],
        text: "Our experienced technicians provide heating and cooling repair for homeowners. We explain available options and help customers choose an appropriate repair or replacement. Explore our service information and contact our team to discuss your needs and arrange a convenient appointment.",
        links: url === "https://example.com/" ? [{ href: "/services", text: "Services" }, { href: "/contact", text: "Contact" }, { href: "/quote", text: "Quote" }, { href: "/booking", text: "Booking" }, { href: "/heating", text: "Heating" }] : [], buttons: [], forms: [], truncated: false },
    })), close: vi.fn(async () => {}),
  };
}

describe("rendered audit application orchestration (local contract fixtures)", () => {
  it("submits once, claims, stores five pages and maps evidence to approved scope", async () => {
    const db = fixtureStore(), worker = fixtureWorker();
    const submit = { agencyId: "agency", userId: "owner", prospect, requestKey: "request", store: db.store };
    expect(await submitRenderedAuditJob(submit)).toBe(await submitRenderedAuditJob(submit));
    expect(await executeRenderedAuditJob({ agencyId: "agency", jobId: "job", store: db.store, createWorker: async () => worker, staticFallback: vi.fn() })).toBe("completed");
    expect(worker.capture).toHaveBeenCalledTimes(10);
    const rendered = readRenderedAudit(db.result() as Record<string, unknown>);
    expect(rendered).not.toBeNull();
    expect(describeRenderedCoverage(rendered!)).toMatchObject({ scanned: 5, skipped: 1, fullSiteCoverage: false });
    const markup = renderToStaticMarkup(createElement(RenderedCoverage, { coverage: describeRenderedCoverage(rendered!), locale: "en" }));
    expect(markup).toContain("inspected: 5");
    expect(markup).toContain("not a complete website scan");
    const service = makeService({ id: "service", name: "Conversion", approvedScope: {
      deliverables: "Review contact CTA wording.", exclusions: "Booking integration.", clientInputs: "Approved page.", completionChecks: "Client review.",
    } });
    const audit = makeAudit(makeDetectedSignals(), { agencyId: "agency", websiteUrl: prospect.websiteUrl, normalizedSignals: db.result() as Record<string, unknown> });
    const findings = evaluateOpportunitiesForAudit({ audit, agencyServices: [service] });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every(f => f.evidence.every(e => e.details.includes("https://example.com/")))).toBe(true);
    expect(findings.find(f => f.ruleKey === "missing_online_booking")?.agencyServiceId).not.toBe("service");
    expect(findings.find(f => f.ruleKey === "weak_lead_capture")?.agencyServiceId).toBe("service");
    expect(await db.store.claim({ agencyId: "agency", jobId: "job" })).toBeNull();
  });
  it("rejects cross-tenant submission and claim", async () => {
    const db = fixtureStore();
    await expect(submitRenderedAuditJob({ agencyId: "other", userId: "owner", prospect, requestKey: "request", store: db.store })).rejects.toThrow();
    expect(await db.store.claim({ agencyId: "other", jobId: "job" })).toBeNull();
  });
  it("fences a stale result and permits at most two failed attempts", async () => {
    const db = fixtureStore();
    const lease = await db.store.claim({ agencyId: "agency", jobId: "job" });
    db.replaceLease();
    expect(await db.store.finish({ agencyId: "agency", jobId: "job", leaseToken: lease!.lease_token, result: {}, retry: false })).toBe(false);
    expect(db.result()).toBeNull();
    const other = fixtureStore();
    for (let i = 0; i < 2; i++) expect(await executeRenderedAuditJob({ agencyId: "agency", jobId: "job", store: other.store, createWorker: async () => { throw new WorkerUnavailableBeforeStart("not allocated"); }, staticFallback: vi.fn() })).toBe("retry_or_failed");
    expect(other.job.status).toBe("failed");
  });
  it("does not retry if worker termination is uncertain", async () => {
    const db = fixtureStore(), worker = fixtureWorker();
    worker.close.mockRejectedValueOnce(new Error("termination not confirmed"));
    expect(await executeRenderedAuditJob({ agencyId: "agency", jobId: "job", store: db.store, createWorker: async () => worker, staticFallback: vi.fn() })).toBe("retry_or_failed");
    expect(db.job.status).toBe("failed");
    expect(await db.store.claim({ agencyId: "agency", jobId: "job" })).toBeNull();
  });
});
