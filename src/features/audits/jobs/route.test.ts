import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/prospects/[prospectId]/audits/route";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import { runAuditForProspect } from "../run-audit";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import * as availability from "./availability";
import { createAuditJobStore } from "./repository";

vi.mock("server-only", () => ({}));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("@/features/prospects/data", () => ({ getProspect: vi.fn() }));
vi.mock("../run-audit", () => ({ runAuditForProspect: vi.fn() }));
vi.mock("@/features/usage/limits", () => ({ enforceAgencyUsageLimit: vi.fn() }));
vi.mock("./repository", () => ({ createAuditJobStore: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });
it("refuses requested rendered execution before usage, jobs, or worker calls while the boundary is unverified", async () => {
  vi.stubEnv("SCANVORO_RENDERED_AUDITS_ENABLED", "1");
  vi.mocked(requireCurrentAgency).mockResolvedValue({ agency: { id: "agency" }, user: { id: "user" } } as never);
  vi.mocked(getProspect).mockResolvedValue({ id: "prospect", agencyId: "agency", websiteUrl: "https://example.com" } as never);
  const response = await POST(new Request("https://app.test/api/prospects/prospect/audits", { method: "POST" }), { params: Promise.resolve({ prospectId: "prospect" }) });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "JavaScript-rendered analysis is not available yet." });
  expect(enforceAgencyUsageLimit).not.toHaveBeenCalled();
  expect(runAuditForProspect).not.toHaveBeenCalled();
});
it("passes only server-derived ownership and a UUID idempotency key to the job store when a verified boundary is injected in tests", async () => {
  vi.stubEnv("SCANVORO_RENDERED_AUDITS_ENABLED", "1");
  vi.spyOn(availability, "assertRenderedAuditAvailable").mockImplementation(() => {});
  vi.mocked(requireCurrentAgency).mockResolvedValue({ agency: { id: "agency" }, user: { id: "user" } } as never);
  vi.mocked(getProspect).mockResolvedValue({ id: "prospect", agencyId: "agency", websiteUrl: "https://example.com" } as never);
  const enqueue = vi.fn(async () => ({ job_id: "job", audit_id: "audit", status: "pending" }));
  vi.mocked(createAuditJobStore).mockReturnValue({ enqueue } as never);
  const key = "11111111-1111-4111-8111-111111111111";
  const response = await POST(new Request("https://app.test/api/prospects/prospect/audits", { method: "POST", headers: { "idempotency-key": key } }), { params: Promise.resolve({ prospectId: "prospect" }) });
  expect(response.status).toBe(202);
  expect(enqueue).toHaveBeenCalledWith({ agencyId: "agency", userId: "user", prospectId: "prospect", requestKey: key });
  expect(runAuditForProspect).not.toHaveBeenCalled();
});
