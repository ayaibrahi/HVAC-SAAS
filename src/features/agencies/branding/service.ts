import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import {
  brandingAssetSchema,
  normalizeLogo,
  verifyLogo,
  type BrandingAsset,
} from "./assets";

export type BrandingState = {
  available: boolean;
  activeAssetId: string | null;
};
export type BrandingActor = {
  agencyId: string;
  ownerUserId: string;
  userId: string;
};
export type BrandingStore = {
  current(agencyId: string): Promise<BrandingState>;
  asset(agencyId: string, assetId: string): Promise<BrandingAsset | null>;
  byHash(agencyId: string, hash: string): Promise<BrandingAsset | null>;
  insertAsset(asset: BrandingAsset): Promise<BrandingAsset>;
  upload(key: string, bytes: Uint8Array): Promise<void>;
  download(key: string): Promise<Uint8Array>;
  select(actor: BrandingActor, assetId: string | null): Promise<void>;
};

export function assertBrandingActor(actor: BrandingActor) {
  if (!actor.userId || actor.ownerUserId !== actor.userId)
    throw new AppError("Sign in as the agency owner.", 403);
}

export async function replaceAgencyLogo(
  actor: BrandingActor,
  bytes: Uint8Array,
  store: BrandingStore,
) {
  assertBrandingActor(actor);
  if (!(await store.current(actor.agencyId)).available)
    throw new AppError("Agency branding setup is awaiting approval.", 503);
  const normalized = await normalizeLogo(bytes, actor.agencyId);
  let asset = await store.byHash(actor.agencyId, normalized.sha256);
  if (!asset) {
    const key = `${actor.agencyId}/${normalized.sha256}.png`;
    // Append-only object upload. Collisions are verified, never overwritten.
    await store.upload(key, normalized.bytes);
    asset = await store.insertAsset({
      id: randomUUID(),
      agency_id: actor.agencyId,
      object_key: key,
      sha256: normalized.sha256,
      mime_type: "image/png",
      byte_length: normalized.bytes.length,
      width: normalized.width,
      height: normalized.height,
    });
  }
  asset = ownedAsset(asset, actor.agencyId);
  await verifyLogo(
    asset,
    await store.download(asset.object_key),
    actor.agencyId,
  );
  await store.select(actor, asset.id);
  return asset.id;
}

export async function removeAgencyLogo(
  actor: BrandingActor,
  store: BrandingStore,
) {
  assertBrandingActor(actor);
  if (!(await store.current(actor.agencyId)).available)
    throw new AppError("Agency branding setup is awaiting approval.", 503);
  // Never delete an object: historical snapshots may still reference it.
  await store.select(actor, null);
}

export async function loadFrozenLogo(
  agencyId: string,
  assetId: string | null | undefined,
  store: BrandingStore,
) {
  if (!assetId) return null; // Legacy snapshots never use today's active logo.
  try {
    const asset = await store.asset(agencyId, assetId);
    if (!asset || asset.agency_id !== agencyId) return null;
    const checked = ownedAsset(asset, agencyId);
    const bytes = await store.download(checked.object_key);
    const logo = await verifyLogo(checked, bytes, agencyId);
    return { logo, png: Buffer.from(bytes) };
  } catch {
    // Unavailable/tampered assets degrade to the frozen name, not current branding.
    return null;
  }
}

function ownedAsset(value: BrandingAsset, agencyId: string) {
  const parsed = brandingAssetSchema.safeParse(value);
  if (!parsed.success || parsed.data.agency_id !== agencyId)
    throw new AppError("Agency logo is not available.", 404);
  return parsed.data;
}
