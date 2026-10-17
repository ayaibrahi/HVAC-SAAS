import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { type BrandingAsset, normalizeLogo } from "./assets";
import {
  loadFrozenLogo,
  removeAgencyLogo,
  replaceAgencyLogo,
  type BrandingActor,
  type BrandingStore,
} from "./service";
import { renderProposalPdf } from "@/features/proposals/pdf/renderer";
import { buildProposalPdfView } from "@/features/proposals/pdf/view-model";
import { getProposalContentSuggestion } from "@/features/proposals/content-suggestion";
import {
  makeIllustrativeContactOffer,
  makeLocalContentSnapshot,
} from "@/features/proposals/sales-test-fixtures";
import { renderPublicAgencyLogo } from "@/features/proposals/share-links/agency-logo";

const actor: BrandingActor = {
  agencyId: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  ownerUserId: "11111111-1111-4111-8111-111111111111",
};
async function image(red = 20, format: "png" | "jpeg" = "png") {
  return sharp({
    create: {
      width: 320,
      height: 100,
      channels: 4,
      background: { r: red, g: 90, b: 100, alpha: 0.5 },
    },
  })
    [format]()
    .toBuffer();
}
function memoryStore() {
  const assets = new Map<string, BrandingAsset>();
  const objects = new Map<string, Uint8Array>();
  let current: string | null = null;
  const store: BrandingStore = {
    current: vi.fn(async () => ({ available: true, activeAssetId: current })),
    asset: vi.fn<BrandingStore["asset"]>(async (agencyId, id) => {
      const a = assets.get(id);
      return a && a.agency_id === agencyId ? a : null;
    }),
    byHash: vi.fn(
      async (agencyId, hash) =>
        [...assets.values()].find(
          (a) => a.agency_id === agencyId && a.sha256 === hash,
        ) ?? null,
    ),
    insertAsset: vi.fn(async (a) => {
      const old = [...assets.values()].find(
        (v) => v.agency_id === a.agency_id && v.sha256 === a.sha256,
      );
      if (old) return old;
      assets.set(a.id, structuredClone(a));
      return a;
    }),
    upload: vi.fn(async (key, bytes) => {
      if (!objects.has(key)) objects.set(key, Buffer.from(bytes));
    }),
    download: vi.fn(async (key) => {
      const bytes = objects.get(key);
      if (!bytes) throw new Error("missing");
      return Buffer.from(bytes);
    }),
    select: vi.fn(async (who, id) => {
      if (
        who.agencyId !== actor.agencyId ||
        who.userId !== actor.userId ||
        (id && assets.get(id)?.agency_id !== who.agencyId)
      )
        throw new Error("denied");
      current = id;
    }),
  };
  return { store, assets, objects };
}

describe("persistent logo lifecycle (isolated store, no Supabase writes)", () => {
  it.each(["png", "jpeg"] as const)(
    "normalizes real %s input to a private canonical PNG",
    async (format) => {
      const { store, assets, objects } = memoryStore();
      const id = await replaceAgencyLogo(actor, await image(20, format), store);
      const a = assets.get(id)!;
      expect(a.mime_type).toBe("image/png");
      expect(a.object_key).toBe(`${actor.agencyId}/${a.sha256}.png`);
      expect(Array.from(objects.get(a.object_key)!.slice(0, 8))).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
      expect((await store.current(actor.agencyId)).activeAssetId).toBe(id);
      const loaded = await loadFrozenLogo(actor.agencyId, id, store);
      expect(loaded).not.toBeNull();
      expect(loaded!.logo.width / loaded!.logo.height).toBe(3.2);
    },
  );

  it("deduplicates repeated uploads without replacing an existing object", async () => {
    const { store, assets } = memoryStore();
    const bytes = await image();
    const first = await replaceAgencyLogo(actor, bytes, store);
    expect(await replaceAgencyLogo(actor, bytes, store)).toBe(first);
    expect(assets.size).toBe(1);
    expect(store.upload).toHaveBeenCalledTimes(1);
  });

  it("concurrent identical uploads converge on one immutable asset", async () => {
    const { store, assets, objects } = memoryStore();
    const bytes = await image();
    const [first, second] = await Promise.all([
      replaceAgencyLogo(actor, bytes, store),
      replaceAgencyLogo(actor, bytes, store),
    ]);
    expect(first).toBe(second);
    expect(assets.size).toBe(1);
    expect(objects.size).toBe(1);
  });

  it("failed activation preserves the previously selected logo", async () => {
    const { store } = memoryStore();
    const first = await replaceAgencyLogo(actor, await image(), store);
    vi.mocked(store.select).mockRejectedValueOnce(
      new Error("activation failed"),
    );
    await expect(
      replaceAgencyLogo(actor, await image(240), store),
    ).rejects.toThrow("activation failed");
    expect((await store.current(actor.agencyId)).activeAssetId).toBe(first);
    expect(await loadFrozenLogo(actor.agencyId, first, store)).not.toBeNull();
  });

  it("replacement and removal retain historical logo bytes, frozen narrative and exact PDF pricing", async () => {
    const { store, assets, objects } = memoryStore();
    const first = await replaceAgencyLogo(actor, await image(), store);
    const data = makeIllustrativeContactOffer();
    data.agency.name = "TEST ONLY - Frozen Agency";
    const snapshot = {
      ...makeLocalContentSnapshot(data, getProposalContentSuggestion(data)!),
      brandingAssetId: first,
    };
    const frozen = JSON.stringify(snapshot);
    const old = (await loadFrozenLogo(
      actor.agencyId,
      snapshot.brandingAssetId,
      store,
    ))!;
    const pdf = renderProposalPdf(buildProposalPdfView(snapshot), {
      agencyId: actor.agencyId,
      logo: old.logo,
    });
    const second = await replaceAgencyLogo(actor, await image(200), store);
    expect(second).not.toBe(first);
    await removeAgencyLogo(actor, store);
    expect((await store.current(actor.agencyId)).activeAssetId).toBeNull();
    const reread = (await loadFrozenLogo(actor.agencyId, first, store))!;
    expect(
      renderProposalPdf(buildProposalPdfView(snapshot), {
        agencyId: actor.agencyId,
        logo: reread.logo,
      }).equals(pdf),
    ).toBe(true);
    expect(pdf.toString("latin1")).toContain("USD 500.00");
    expect(JSON.stringify(snapshot)).toBe(frozen);
    expect(assets.size).toBe(2);
    expect(objects.size).toBe(2);
    expect(
      renderPublicAgencyLogo(
        `data:image/png;base64,${reread.png.toString("base64")}`,
      ),
    ).toContain('<img class="agency-logo"');
  });

  it("legacy snapshots never look up the current branding or download any asset", async () => {
    const { store } = memoryStore();
    expect(await loadFrozenLogo(actor.agencyId, undefined, store)).toBeNull();
    expect(await loadFrozenLogo(actor.agencyId, null, store)).toBeNull();
    expect(store.current).not.toHaveBeenCalled();
    expect(store.download).not.toHaveBeenCalled();
  });

  it("rejects non-owners before mutation or decoding", async () => {
    const { store } = memoryStore();
    const wrong = { ...actor, userId: "someone-else" };
    await expect(
      replaceAgencyLogo(wrong, await image(), store),
    ).rejects.toThrow("agency owner");
    await expect(removeAgencyLogo(wrong, store)).rejects.toThrow(
      "agency owner",
    );
    expect(store.current).not.toHaveBeenCalled();
    expect(store.upload).not.toHaveBeenCalled();
    expect(store.select).not.toHaveBeenCalled();
  });

  it.each([
    Buffer.from('<svg onload="unsafe"/>'),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(1_048_577),
  ])("invalid input leaves existing selection untouched", async (bytes) => {
    const { store } = memoryStore();
    await expect(replaceAgencyLogo(actor, bytes, store)).rejects.toThrow();
    expect(store.upload).not.toHaveBeenCalled();
    expect(store.select).not.toHaveBeenCalled();
  });

  it("fails closed before Storage writes when migration is unavailable", async () => {
    const { store } = memoryStore();
    vi.mocked(store.current).mockResolvedValue({
      available: false,
      activeAssetId: null,
    });
    await expect(
      replaceAgencyLogo(actor, await image(), store),
    ).rejects.toThrow("awaiting approval");
    await expect(removeAgencyLogo(actor, store)).rejects.toThrow(
      "awaiting approval",
    );
    expect(store.upload).not.toHaveBeenCalled();
    expect(store.select).not.toHaveBeenCalled();
  });

  it("does not download foreign agency assets or malformed object paths", async () => {
    const { store, assets } = memoryStore();
    const id = await replaceAgencyLogo(actor, await image(), store);
    vi.mocked(store.download).mockClear();
    expect(
      await loadFrozenLogo("33333333-3333-4333-8333-333333333333", id, store),
    ).toBeNull();
    expect(store.download).not.toHaveBeenCalled();
    assets.get(id)!.object_key = "other-agency/private.png";
    expect(await loadFrozenLogo(actor.agencyId, id, store)).toBeNull();
    expect(store.download).not.toHaveBeenCalled();
  });

  it("tampered or unavailable objects fall back without using today's logo", async () => {
    const { store, assets, objects } = memoryStore();
    const id = await replaceAgencyLogo(actor, await image(), store);
    objects.set(assets.get(id)!.object_key, await image(250));
    expect(await loadFrozenLogo(actor.agencyId, id, store)).toBeNull();
    objects.clear();
    expect(await loadFrozenLogo(actor.agencyId, id, store)).toBeNull();
  });

  it("never activates a partial upload after metadata or verification failure", async () => {
    const { store } = memoryStore();
    vi.mocked(store.insertAsset).mockRejectedValue(
      new Error("internal test error"),
    );
    await expect(
      replaceAgencyLogo(actor, await image(), store),
    ).rejects.toThrow();
    expect(store.select).not.toHaveBeenCalled();
  });

  it("strips source metadata and deterministically preserves transparency", async () => {
    const source = await sharp(await image())
      .withMetadata({ exif: { IFD0: { Artist: "PRIVATE TEST DATA" } } })
      .png()
      .toBuffer();
    const a = await normalizeLogo(source, actor.agencyId);
    const b = await normalizeLogo(source, actor.agencyId);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.sha256).toBe(b.sha256);
    expect((await sharp(a.bytes).metadata()).exif).toBeUndefined();
    expect(
      (await sharp(a.bytes).ensureAlpha().raw().toBuffer())[3],
    ).toBeLessThan(255);
  });
});
