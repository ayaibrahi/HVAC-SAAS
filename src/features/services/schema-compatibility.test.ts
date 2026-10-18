import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCurrentAgency } from "@/features/agencies/data";
import {
  createAgencyService,
  isApprovedServiceScopeAvailable,
  updateAgencyService,
} from "./data";
import { agencyServiceInputSchema } from "@/lib/validation/services";
import { makeCompleteProposalBuilder } from "../proposals/ai/complete-test-fixtures";

vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const probe = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const saved = vi.fn();
const query = {
  select: vi.fn(),
  eq,
  limit: probe,
  insert,
  update,
  single: saved,
};
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  eq.mockReturnValue(query);
  insert.mockReturnValue(query);
  update.mockReturnValue(query);
  probe.mockResolvedValue({ error: null });
  const service = makeCompleteProposalBuilder().services[0];
  saved.mockResolvedValue({
    data: {
      id: service.id,
      agency_id: service.agencyId,
      name: service.name,
      description: service.description,
      price: 500,
      currency: "USD",
      is_active: true,
      created_at: service.createdAt,
      updated_at: service.updatedAt,
    },
    error: null,
  });
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    agency: { id: service.agencyId },
    supabase: { from: vi.fn(() => query) },
  } as unknown as Awaited<ReturnType<typeof requireCurrentAgency>>);
});

function input(scope: "approved" | "null" | "omitted") {
  const service = makeCompleteProposalBuilder().services[0];
  return agencyServiceInputSchema.parse({
    name: service.name,
    price: 500,
    ...(scope === "omitted"
      ? {}
      : { approvedScope: scope === "null" ? null : service.approvedScope }),
    isActive: true,
  });
}

describe("service writes on deployed and pending schemas", () => {
  it.each(["42703", "PGRST204"])(
    "recognizes missing scope column %s using a tenant-scoped zero-row query",
    async (code) => {
      probe.mockResolvedValue({ error: { code } });
      expect(await isApprovedServiceScopeAvailable()).toBe(false);
      expect(query.select).toHaveBeenCalledWith("approved_scope");
      expect(eq).toHaveBeenCalledWith(
        "agency_id",
        makeCompleteProposalBuilder().agency.id,
      );
      expect(probe).toHaveBeenCalledWith(0);
    },
  );
  it("fails closed on unrelated database failures", async () => {
    probe.mockResolvedValue({ error: { code: "42501" } });
    await expect(
      updateAgencyService("owned", input("approved")),
    ).rejects.toThrow("No changes were saved");
    expect(update).not.toHaveBeenCalled();
  });
  it("keeps basic create/update available without pretending to persist approval", async () => {
    probe.mockResolvedValue({ error: { code: "42703" } });
    await createAgencyService(input("null"));
    await updateAgencyService("owned", input("null"));
    expect(insert.mock.calls[0][0]).not.toHaveProperty("approved_scope");
    expect(update.mock.calls[0][0]).not.toHaveProperty("approved_scope");
    expect(eq).toHaveBeenCalledWith("id", "owned");
  });
  it("rejects approved scope before create/update when the migration is absent", async () => {
    probe.mockResolvedValue({ error: { code: "42703" } });
    await expect(createAgencyService(input("approved"))).rejects.toThrow(
      "pending database migration",
    );
    await expect(
      updateAgencyService("owned", input("approved")),
    ).rejects.toThrow("pending database migration");
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it("persists approval and explicit withdrawal only on a supporting schema", async () => {
    await createAgencyService(input("approved"));
    await updateAgencyService("owned", input("null"));
    expect(insert.mock.calls[0][0].approved_scope).toEqual(
      input("approved").approvedScope,
    );
    expect(update.mock.calls[0][0]).toHaveProperty("approved_scope", null);
  });
  it("preserves existing approval for API callers that omit the optional field", async () => {
    await updateAgencyService("owned", input("omitted"));
    expect(probe).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0]).not.toHaveProperty("approved_scope");
  });
});
