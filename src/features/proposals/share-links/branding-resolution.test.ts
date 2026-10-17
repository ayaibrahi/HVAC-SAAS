import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicShareToken } from "./data";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), logo: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
vi.mock("@/features/agencies/branding/data", () => ({
  loadSnapshotLogo: mocks.logo,
}));
const token = "A".repeat(43);
const row = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  agency_id: "22222222-2222-4222-8222-222222222222",
  proposal_id: "44444444-4444-4444-8444-444444444444",
  branding_asset_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  status: "active",
  title: "TEST ONLY",
  summary: "Page-scoped observation.",
  scope: "Manual scope.",
  next_step: "Review.",
  currency: "USD",
  subtotal_amount: 500,
  discount_type: "none",
  discount_value: 0,
  discount_amount: 0,
  total_amount: 500,
  agency_display_name: "Frozen Agency",
  prospect_display_name: "TEST ONLY Client",
  prospect_website_url: null,
  line_items: [
    {
      position: 0,
      serviceName: "Selected Service",
      serviceDescription: null,
      description: "Manual work.",
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
    },
  ],
  created_by: "11111111-1111-4111-8111-111111111111",
  source_proposal_updated_at: "2026-10-17T00:00:00Z",
  created_at: "2026-10-17T00:00:00Z",
  superseded_at: null,
};
function setup(link: unknown, snapshot: unknown = row) {
  const links = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: link, error: null }),
  };
  const snapshots = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: snapshot, error: null }),
  };
  const from = vi.fn((table: string) =>
    table === "proposal_share_links" ? links : snapshots,
  );
  mocks.admin.mockReturnValue({ from });
  return { links, snapshots, from };
}
const active = {
  agency_id: row.agency_id,
  delivery_snapshot_id: row.id,
  status: "active",
  expires_at: "2026-11-17T00:00:00Z",
};
describe("public logo stays behind the existing share token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logo.mockResolvedValue({
      png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
  });
  it.each([
    null,
    { ...active, status: "revoked" },
    { ...active, expires_at: "2026-01-01T00:00:00Z" },
  ])("does not load any private logo for unavailable tokens", async (link) => {
    setup(link);
    expect(
      await resolvePublicShareToken(token, new Date("2026-10-17")),
    ).toBeNull();
    expect(mocks.logo).not.toHaveBeenCalled();
  });
  it("rejects malformed tokens before any privileged lookup", async () => {
    expect(await resolvePublicShareToken("invalid")).toBeNull();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.logo).not.toHaveBeenCalled();
  });
  it("loads only the token-owned snapshot and frozen asset; projection has no private identifiers", async () => {
    const { snapshots } = setup(active);
    const view = await resolvePublicShareToken(token, new Date("2026-10-17"));
    expect(snapshots.eq).toHaveBeenCalledWith("agency_id", row.agency_id);
    expect(snapshots.eq).toHaveBeenCalledWith("id", row.id);
    expect(mocks.logo).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: row.agency_id,
        brandingAssetId: row.branding_asset_id,
      }),
    );
    expect(view?.agency.logoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(view?.pricing.total).toBe(500);
    expect(view?.scope).toBe(row.scope);
    expect(JSON.stringify(view)).not.toContain(row.branding_asset_id);
    expect(JSON.stringify(view)).not.toContain(row.agency_id);
  });
  it("leaves historical or missing-asset public views name-only", async () => {
    setup(active, { ...row, branding_asset_id: null });
    mocks.logo.mockResolvedValue(null);
    const view = await resolvePublicShareToken(token, new Date("2026-10-17"));
    expect(view?.agency).toEqual({ displayName: "Frozen Agency" });
  });
});
