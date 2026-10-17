import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { GET, PUT, DELETE } from "./route";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  replace: vi.fn(),
  remove: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@/features/agencies/branding/data", () => ({
  getBrandingContext: mocks.context,
}));
vi.mock("@/features/agencies/branding/service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/agencies/branding/service")
  >()),
  replaceAgencyLogo: mocks.replace,
  removeAgencyLogo: mocks.remove,
  loadFrozenLogo: mocks.load,
}));
let sequence = 0;
let actor: { agencyId: string; ownerUserId: string; userId: string };
let store: { current: ReturnType<typeof vi.fn> };
const assetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function request(
  body = "test bytes",
  origin = "https://preview.example",
  suffix = "",
) {
  return new Request(`https://preview.example/api/agency-branding${suffix}`, {
    method: "PUT",
    headers: { origin, "Content-Type": "image/png" },
    body,
  });
}
describe("owner-only branding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor = {
      agencyId: `agency-${++sequence}`,
      ownerUserId: "owner-a",
      userId: "owner-a",
    };
    store = {
      current: vi
        .fn()
        .mockResolvedValue({ available: true, activeAssetId: assetId }),
    };
    mocks.context.mockResolvedValue({ actor, store });
    mocks.replace.mockResolvedValue(assetId);
    mocks.remove.mockResolvedValue(undefined);
    mocks.load.mockResolvedValue({ png: Buffer.from("test PNG bytes") });
  });
  it("ignores all alternate client ownership, asset and storage-path identifiers", async () => {
    const response = await PUT(
      request(
        "bounded bytes",
        undefined,
        "?agency_id=other&assetId=foreign&object_key=private",
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assetId });
    expect(mocks.replace).toHaveBeenCalledWith(
      actor,
      Buffer.from("bounded bytes"),
      store,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("authenticates before body processing or mutation", async () => {
    mocks.context.mockRejectedValueOnce(
      new AppError("Sign in to continue.", 401),
    );
    expect((await PUT(request())).status).toBe(401);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("blocks cross-origin mutations before privileged context creation", async () => {
    expect((await PUT(request("bytes", "https://evil.example"))).status).toBe(
      403,
    );
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("blocks unauthorized ownership even when a client reaches the handler", async () => {
    mocks.context.mockResolvedValue({
      actor: { ...actor, userId: "foreign-owner" },
      store,
    });
    expect((await PUT(request())).status).toBe(403);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("does not invoke persistence for oversized files", async () => {
    expect((await PUT(request("x".repeat(1_048_577)))).status).toBe(413);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("removal uses only the current agency and never a client-selected asset", async () => {
    expect(
      (await DELETE(request('{"agencyId":"other","assetId":"foreign"}')))
        .status,
    ).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith(actor, store);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("serves only the authenticated agency's current private PNG without caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(store.current).toHaveBeenCalledWith(actor.agencyId);
    expect(mocks.load).toHaveBeenCalledWith(actor.agencyId, assetId, store);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("returns controlled errors without internal payloads", async () => {
    mocks.replace.mockRejectedValueOnce(
      new Error("PRIVATE test provider credential or database error"),
    );
    const response = await PUT(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("PRIVATE");
  });
  it("bounds mutation attempts per authenticated agency in this server instance", async () => {
    for (let i = 0; i < 10; i++)
      expect((await PUT(request())).status).toBe(200);
    expect((await PUT(request())).status).toBe(429);
    expect(mocks.replace).toHaveBeenCalledTimes(10);
  });
});
