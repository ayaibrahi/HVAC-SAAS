import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrandingStore, getBrandingContext } from "./data";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { brandingBucket } from "./assets";

const mock = vi.hoisted(() => ({ requireAgency: vi.fn(), admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/agencies/data", () => ({
  requireCurrentAgency: mock.requireAgency,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mock.admin,
}));

function fakeAdmin() {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const storage = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    download: vi
      .fn()
      .mockResolvedValue({ data: new Blob(["test"]), error: null }),
  };
  const client = {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => storage) },
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    client,
    query,
    storage,
    store: createBrandingStore(client as unknown as SupabaseAdminClient),
  };
}
describe("branding private Supabase adapter", () => {
  beforeEach(() => vi.clearAllMocks());
  it("derives context only from the authenticated owner before creating the privileged client", async () => {
    mock.requireAgency.mockRejectedValueOnce(new Error("sign in"));
    await expect(getBrandingContext()).rejects.toThrow();
    expect(mock.admin).not.toHaveBeenCalled();
    mock.requireAgency.mockResolvedValue({
      agency: { id: "agency-a", ownerUserId: "owner-a" },
      user: { id: "owner-a" },
    });
    mock.admin.mockReturnValue(fakeAdmin().client);
    expect((await getBrandingContext()).actor).toEqual({
      agencyId: "agency-a",
      ownerUserId: "owner-a",
      userId: "owner-a",
    });
  });
  it.each(["42P01", "PGRST205"])(
    "reports absent migration %s without pretending branding is available",
    async (code) => {
      const { store, query } = fakeAdmin();
      query.maybeSingle.mockResolvedValue({ data: null, error: { code } });
      expect(await store.current("agency-a")).toEqual({
        available: false,
        activeAssetId: null,
      });
    },
  );
  it("scopes all asset lookups by agency as well as requested ID/hash", async () => {
    const { store, query } = fakeAdmin();
    await store.asset("agency-a", "asset-b");
    expect(query.eq).toHaveBeenCalledWith("agency_id", "agency-a");
    expect(query.eq).toHaveBeenCalledWith("id", "asset-b");
    await store.byHash("agency-a", "hash");
    expect(query.eq).toHaveBeenCalledWith("sha256", "hash");
  });
  it("uploads append-only canonical PNGs to the fixed private bucket", async () => {
    const { client, store, storage } = fakeAdmin();
    await store.upload("owned-key", new Uint8Array([1]));
    expect(client.storage.from).toHaveBeenCalledWith(brandingBucket);
    expect(storage.upload).toHaveBeenCalledWith(
      "owned-key",
      new Uint8Array([1]),
      { contentType: "image/png", cacheControl: "0", upsert: false },
    );
    expect(Object.keys(storage)).not.toContain("getPublicUrl");
  });
  it("never overwrites collisions; other storage failures stay sanitized", async () => {
    const { store, storage } = fakeAdmin();
    storage.upload.mockResolvedValueOnce({ error: { statusCode: "409" } });
    await expect(
      store.upload("owned", new Uint8Array([1])),
    ).resolves.toBeUndefined();
    storage.upload.mockResolvedValueOnce({
      error: { statusCode: "500", message: "sensitive test payload" },
    });
    await expect(store.upload("owned", new Uint8Array([1]))).rejects.toThrow(
      "Agency logo could not be saved.",
    );
    expect(storage.upload).toHaveBeenCalledTimes(2);
  });
  it("rejects oversized downloaded blobs and keeps mutation identifiers server-derived", async () => {
    const { store, storage, client } = fakeAdmin();
    storage.download.mockResolvedValue({
      data: new Blob([new Uint8Array(1_048_577)]),
      error: null,
    });
    await expect(store.download("owned-key")).rejects.toThrow("not available");
    await store.select(
      { agencyId: "agency-a", userId: "owner-a", ownerUserId: "owner-a" },
      null,
    );
    expect(client.rpc).toHaveBeenCalledWith("set_agency_branding_asset", {
      p_agency_id: "agency-a",
      p_user_id: "owner-a",
      p_asset_id: null,
    });
  });
});
