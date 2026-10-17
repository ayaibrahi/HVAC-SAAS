import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { logoLimits, ValidatedAgencyLogo } from "@/features/proposals/pdf/logo";

export const brandingBucket = "agency-branding";
export const brandingAssetSchema = z
  .object({
    id: z.uuid(),
    agency_id: z.uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    object_key: z.string(),
    mime_type: z.literal("image/png"),
    byte_length: z.number().int().min(1).max(logoLimits.bytes),
    width: z.number().int().min(1).max(600),
    height: z.number().int().min(1).max(240),
  })
  .refine((a) => a.object_key === `${a.agency_id}/${a.sha256}.png`);
export type BrandingAsset = z.infer<typeof brandingAssetSchema>;

export async function normalizeLogo(bytes: Uint8Array, agencyId: string) {
  const logo = await ValidatedAgencyLogo.decode({
    bytes,
    ownerAgencyId: agencyId,
    requestingAgencyId: agencyId,
  });
  const png = await sharp(logo.pixels(), {
    raw: { width: logo.width, height: logo.height, channels: 4 },
  })
    .timeout({ seconds: 3 })
    .png({ compressionLevel: 9, progressive: false, palette: false })
    .toBuffer();
  if (png.length > logoLimits.bytes)
    throw new AppError("Logo is too large after processing.", 422);
  return {
    bytes: png,
    sha256: hashLogo(png),
    width: logo.width,
    height: logo.height,
  };
}

export function hashLogo(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyLogo(
  asset: BrandingAsset,
  bytes: Uint8Array,
  agencyId: string,
) {
  const parsed = brandingAssetSchema.safeParse(asset);
  if (
    !parsed.success ||
    parsed.data.agency_id !== agencyId ||
    bytes.length !== asset.byte_length ||
    bytes.length > logoLimits.bytes ||
    hashLogo(bytes) !== asset.sha256 ||
    !Buffer.from(bytes)
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new AppError("Agency logo is not available.", 404);
  const logo = await ValidatedAgencyLogo.decode({
    bytes,
    ownerAgencyId: asset.agency_id,
    requestingAgencyId: agencyId,
  });
  if (logo.width !== asset.width || logo.height !== asset.height)
    throw new AppError("Agency logo is not available.", 404);
  return logo;
}
