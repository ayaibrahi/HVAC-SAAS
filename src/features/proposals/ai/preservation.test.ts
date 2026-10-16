import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyProposalAiDraft } from "../data";
import { makeBuilderData } from "../builder-test-fixtures";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  agency: vi.fn(),
  server: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/features/agencies/data", () => ({
  requireCurrentAgency: mocks.agency,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.server,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
let row: Record<string, unknown>;
let race = false;
let failure = false;
const updates = vi.fn();
const payload = {
  proposalId: "44444444-4444-4444-8444-444444444444",
  expectedUpdatedAt: "2026-09-25T00:00:00.000Z",
  summary: "Reviewed summary",
  scope: "Reviewed scope",
  nextStep: "Review together",
  metadata: { promptVersion: "v3" },
};
beforeEach(() => {
  vi.clearAllMocks();
  race = false;
  failure = false;
  const data = makeBuilderData();
  row = {
    id: data.proposal.id,
    agency_id: data.agency.id,
    prospect_id: data.prospect.id,
    audit_id: data.audit.id,
    title: "Saved title",
    status: "draft",
    summary: "",
    scope: "",
    next_step: "",
    currency: "USD",
    subtotal_amount: 350,
    discount_type: "none",
    discount_value: 0,
    discount_amount: 0,
    total_amount: 350,
    content: null,
    created_at: data.proposal.createdAt,
    updated_at: data.proposal.updatedAt,
  };
  const read = {
    select: () => read,
    eq: () => read,
    maybeSingle: async () => ({ data: { ...row }, error: null }),
  };
  mocks.agency.mockResolvedValue({
    agency: data.agency,
    supabase: { from: () => read },
  });
  mocks.admin.mockReturnValue({
    from: () => {
      const filters: Record<string, unknown> = {};
      let change: Record<string, unknown> = {};
      const write = {
        update: (p: Record<string, unknown>) => {
          updates(p);
          change = p;
          if (race) {
            row.title = "Human changed title";
            row.updated_at = "2026-10-16T01:00:00Z";
          }
          return write;
        },
        eq: (k: string, v: unknown) => {
          filters[k] = v;
          return write;
        },
        select: () => write,
        single: async () => {
          if (failure)
            return {
              data: null,
              error: { code: "XX000", message: "private failure" },
            };
          if (Object.entries(filters).some(([k, v]) => row[k] !== v))
            return { data: null, error: { code: "PGRST116" } };
          Object.assign(row, change);
          return { data: { ...row }, error: null };
        },
      };
      return write;
    },
  });
});
describe("AI narrative write protection", () => {
  it.each(["summary", "scope", "next_step", "ready"])(
    "does not overwrite saved %s",
    async (field) => {
      if (field === "ready") row.status = "ready";
      else row[field] = "Human text";
      const before = { ...row };
      await expect(applyProposalAiDraft(payload)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(updates).not.toHaveBeenCalled();
      expect(row).toEqual(before);
    },
  );
  it("uses optimistic concurrency to preserve an edit made during generation", async () => {
    race = true;
    await expect(applyProposalAiDraft(payload)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(row.title).toBe("Human changed title");
    expect(row.summary).toBe("");
  });
  it("rejects a stale generation even if the revised proposal still has empty text", async () => {
    row.updated_at = "2026-10-16T00:00:00Z";
    row.total_amount = 750;
    await expect(applyProposalAiDraft(payload)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(updates).not.toHaveBeenCalled();
    expect(row.total_amount).toBe(750);
  });
  it("updates only narrative and AI metadata, leaving manual money and state unchanged", async () => {
    await applyProposalAiDraft(payload);
    expect(Object.keys(updates.mock.calls[0][0]).sort()).toEqual([
      "content",
      "next_step",
      "scope",
      "summary",
    ]);
    expect(row).toMatchObject({
      status: "draft",
      currency: "USD",
      total_amount: 350,
      subtotal_amount: 350,
    });
  });
  it("returns a controlled error for actual storage failure", async () => {
    failure = true;
    await expect(applyProposalAiDraft(payload)).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(row.summary).toBe("");
  });
});
