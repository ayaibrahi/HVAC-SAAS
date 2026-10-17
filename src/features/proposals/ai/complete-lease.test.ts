import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimCompleteProposalGeneration,
  releaseCompleteProposalGeneration,
  applyProposalAiDraft,
} from "../data";
import { makeCompleteProposalBuilder } from "./complete-test-fixtures";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ agency: vi.fn(), admin: vi.fn() }));
vi.mock("@/features/agencies/data", () => ({
  requireCurrentAgency: mocks.agency,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
let row: Record<string, unknown>;
let clock: number;
let writes: Record<string, unknown>[];
let replaceTokenOnWrite: boolean;

function query() {
  const filters: [string, unknown][] = [];
  let change: Record<string, unknown> | undefined;
  const execute = async () => {
    if (change && replaceTokenOnWrite) {
      row.content = {
        proposalAiLease: { token: "replacement", startedAt: Date.now() },
      };
      replaceTokenOnWrite = false;
    }
    if (
      filters.some(
        ([key, value]) =>
          (key === "content->proposalAiLease->>token"
            ? (row.content as { proposalAiLease?: { token?: string } } | null)
                ?.proposalAiLease?.token
            : row[key]) !== value,
      )
    )
      return { data: null, error: { code: "PGRST116" } };
    if (change) {
      writes.push(change);
      Object.assign(row, change, {
        updated_at: new Date(++clock).toISOString(),
      });
    }
    return { data: { ...row }, error: null };
  };
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return builder;
    },
    update: (value: Record<string, unknown>) => {
      change = value;
      return builder;
    },
    single: execute,
    maybeSingle: execute,
    then: <T>(resolve: (value: Awaited<ReturnType<typeof execute>>) => T) =>
      execute().then(resolve),
  };
  return builder;
}
beforeEach(() => {
  vi.clearAllMocks();
  clock = Date.parse("2026-10-18T12:00:00Z");
  writes = [];
  replaceTokenOnWrite = false;
  const data = makeCompleteProposalBuilder();
  row = {
    id: data.proposal.id,
    agency_id: data.agency.id,
    prospect_id: data.prospect.id,
    audit_id: data.audit.id,
    title: data.proposal.title,
    status: "draft",
    summary: "",
    scope: "",
    next_step: "",
    content: null,
    currency: "USD",
    subtotal_amount: 500,
    total_amount: 500,
    discount_type: "none",
    discount_amount: 0,
    discount_value: 0,
    updated_at: new Date(clock).toISOString(),
    created_at: new Date(clock).toISOString(),
  };
  const client = { from: () => query() };
  mocks.agency.mockResolvedValue({ agency: data.agency, supabase: client });
  mocks.admin.mockReturnValue(client);
});
describe("complete generation cross-process CAS reservation and cleanup", () => {
  it("checks the reservation token in the atomic write, even if the timestamp were unchanged", async () => {
    const lease = await claimCompleteProposalGeneration(
      String(row.id),
      String(row.updated_at),
    );
    replaceTokenOnWrite = true;
    await expect(
      applyProposalAiDraft({
        proposalId: String(row.id),
        expectedUpdatedAt: lease.updatedAt,
        generationToken: lease.token,
        summary: "Old generation",
        scope: "Old scope",
        nextStep: "Review",
        metadata: {},
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(row.summary).toBe("");
    expect(
      (row.content as { proposalAiLease: { token: string } }).proposalAiLease
        .token,
    ).toBe("replacement");
  });
  it("only one of two simultaneous requests can reserve the same version", async () => {
    const expected = String(row.updated_at);
    const results = await Promise.allSettled([
      claimCompleteProposalGeneration(String(row.id), expected),
      claimCompleteProposalGeneration(String(row.id), expected),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0])).toEqual(["content"]);
  });
  it("blocks a fresh duplicate even when it loaded the updated version", async () => {
    await claimCompleteProposalGeneration(
      String(row.id),
      String(row.updated_at),
    );
    await expect(
      claimCompleteProposalGeneration(String(row.id), String(row.updated_at)),
    ).rejects.toThrow("already generating");
  });
  it("permits recovery of an expired lease and prevents old cleanup from releasing its replacement", async () => {
    row.content = {
      proposalAiLease: { token: "expired", startedAt: Date.now() - 91_000 },
    };
    const current = await claimCompleteProposalGeneration(
      String(row.id),
      String(row.updated_at),
    );
    await releaseCompleteProposalGeneration(String(row.id), "expired");
    expect(
      (row.content as { proposalAiLease: { token: string } }).proposalAiLease
        .token,
    ).toBe(current.token);
  });
  it("conditionally clears a failed request without touching newer human text or prices", async () => {
    const lease = await claimCompleteProposalGeneration(
      String(row.id),
      String(row.updated_at),
    );
    row.summary = "Human review in another tab";
    row.total_amount = 600;
    row.updated_at = new Date(++clock).toISOString();
    await releaseCompleteProposalGeneration(String(row.id), lease.token);
    expect(row.summary).toBe("Human review in another tab");
    expect(row.total_amount).toBe(600);
    expect(
      (row.content as { proposalAiLease: unknown }).proposalAiLease,
    ).toBeNull();
  });
  it("only applies the current reserved generation and clears its lease in the same narrative write", async () => {
    const lease = await claimCompleteProposalGeneration(
      String(row.id),
      String(row.updated_at),
    );
    const args = {
      proposalId: String(row.id),
      expectedUpdatedAt: lease.updatedAt,
      generationToken: "foreign-token",
      summary: "Complete reviewed draft",
      scope: "Approved deliverables",
      nextStep: "Review with agency",
      metadata: { mode: "complete" },
    };
    await expect(applyProposalAiDraft(args)).rejects.toThrow(
      "no longer current",
    );
    await applyProposalAiDraft({ ...args, generationToken: lease.token });
    const saved = JSON.stringify(row);
    await releaseCompleteProposalGeneration(String(row.id), lease.token);
    expect(JSON.stringify(row)).toBe(saved);
    expect(row.status).toBe("draft");
    expect(row.total_amount).toBe(500);
  });
  it("rejects cross-tenant access without any reservation or mutation", async () => {
    row.agency_id = "another-agency";
    await expect(
      claimCompleteProposalGeneration(String(row.id), String(row.updated_at)),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
});
