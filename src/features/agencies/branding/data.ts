import "server-only";
import { requireCurrentAgency } from "@/features/agencies/data";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import {
  createSupabaseAdminClient,
  type SupabaseAdminClient,
} from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { brandingAssetSchema, brandingBucket } from "./assets";
import { loadFrozenLogo, type BrandingStore } from "./service";
import { logoLimits } from "@/features/proposals/pdf/logo";

export async function getBrandingContext() {
  const { agency, user } = await requireCurrentAgency();
  return {
    actor: {
      agencyId: agency.id,
      ownerUserId: agency.ownerUserId,
      userId: user.id,
    },
    store: createBrandingStore(),
  };
}

export async function getBrandingSettings() {
  const { actor, store } = await getBrandingContext();
  return store.current(actor.agencyId);
}

export async function loadSnapshotLogo(snapshot: ProposalDeliverySnapshot) {
  if (!snapshot.brandingAssetId) return null;
  try {
    return await loadFrozenLogo(
      snapshot.agencyId,
      snapshot.brandingAssetId,
      createBrandingStore(),
    );
  } catch {
    return null;
  }
}

export function createBrandingStore(
  admin: SupabaseAdminClient = createSupabaseAdminClient(),
): BrandingStore {
  const store: BrandingStore = {
    async current(agencyId) {
      const { data, error } = await admin
        .from("agency_branding")
        .select("active_asset_id")
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error && ["42P01", "PGRST205"].includes(error.code))
        return { available: false, activeAssetId: null };
      if (error)
        throw new AppError("Agency branding could not be loaded.", 503);
      return { available: true, activeAssetId: data?.active_asset_id ?? null };
    },
    async asset(agencyId, assetId) {
      const { data, error } = await admin
        .from("agency_branding_assets")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", assetId)
        .maybeSingle();
      if (error) throw new AppError("Agency logo is not available.", 404);
      return data ? brandingAssetSchema.parse(data) : null;
    },
    async byHash(agencyId, hash) {
      const { data, error } = await admin
        .from("agency_branding_assets")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("sha256", hash)
        .maybeSingle();
      if (error) throw new AppError("Agency logo could not be saved.", 503);
      return data ? brandingAssetSchema.parse(data) : null;
    },
    async insertAsset(asset) {
      const { error } = await admin
        .from("agency_branding_assets")
        .upsert(asset, {
          onConflict: "agency_id,sha256",
          ignoreDuplicates: true,
        });
      if (error) throw new AppError("Agency logo could not be saved.", 503);
      const saved = await store.byHash(asset.agency_id, asset.sha256);
      if (!saved) throw new AppError("Agency logo could not be saved.", 503);
      return saved;
    },
    async upload(key, bytes) {
      const { error } = await admin.storage
        .from(brandingBucket)
        .upload(key, bytes, {
          contentType: "image/png",
          upsert: false,
          cacheControl: "0",
        });
      if (error && error.statusCode !== "409")
        throw new AppError("Agency logo could not be saved.", 503);
    },
    async download(key) {
      const { data, error } = await admin.storage
        .from(brandingBucket)
        .download(key);
      if (error || !data || data.size > logoLimits.bytes)
        throw new AppError("Agency logo is not available.", 404);
      return new Uint8Array(await data.arrayBuffer());
    },
    async select(actor, assetId) {
      const { error } = await admin.rpc("set_agency_branding_asset", {
        p_agency_id: actor.agencyId,
        p_user_id: actor.userId,
        p_asset_id: assetId,
      });
      if (error) throw new AppError("Agency logo could not be updated.", 503);
    },
  };
  return store;
}
