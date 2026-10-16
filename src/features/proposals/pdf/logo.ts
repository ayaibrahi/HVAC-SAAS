import { createHash } from "node:crypto";
import sharp from "sharp";
import { AppError } from "@/lib/errors";

// Small raster logos only; decoding is bounded before PDF embedding.
export const logoLimits = {
  bytes: 1_048_576,
  pixels: 2_000_000,
  dimension: 2048,
  minDimension: 16,
} as const;

/** Local rendering foundation, NOT an upload or storage authorization API. */
export class ValidatedAgencyLogo {
  readonly #rgba: Buffer;

  private constructor(
    readonly agencyId: string,
    readonly width: number,
    readonly height: number,
    rgba: Buffer,
  ) {
    this.#rgba = Buffer.from(rgba);
    Object.freeze(this);
  }

  get digest() {
    return createHash("sha256")
      .update(`${this.width}:${this.height}:`)
      .update(this.#rgba)
      .digest("hex");
  }

  pixels() {
    return Buffer.from(this.#rgba);
  }

  static belongsTo(
    value: unknown,
    agencyId: string,
  ): value is ValidatedAgencyLogo {
    return (
      value instanceof ValidatedAgencyLogo &&
      #rgba in value &&
      value.agencyId === agencyId
    );
  }

  static async decode(input: {
    bytes: Uint8Array;
    ownerAgencyId: string;
    requestingAgencyId: string;
  }) {
    // Future callers must derive these IDs from session + owned asset metadata.
    if (
      !input.ownerAgencyId ||
      input.ownerAgencyId !== input.requestingAgencyId
    )
      throw new AppError("Agency logo is not available.", 404);
    if (
      !(input.bytes instanceof Uint8Array) ||
      !input.bytes.byteLength ||
      input.bytes.byteLength > logoLimits.bytes
    )
      throw new AppError("Use a valid PNG or JPEG logo up to 1 MB.", 422);

    const bytes = Buffer.from(input.bytes);
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (!png && !jpeg) throw new AppError("Use a valid PNG or JPEG logo.", 422);

    try {
      const image = sharp(bytes, {
        failOn: "warning",
        limitInputPixels: logoLimits.pixels,
        limitInputChannels: 4,
        autoOrient: true,
      });
      const metadata = await image.metadata();
      const { width = 0, height = 0 } = metadata;
      if (
        !["png", "jpeg"].includes(metadata.format ?? "") ||
        (metadata.pages ?? 1) !== 1 ||
        Math.min(width, height) < logoLimits.minDimension ||
        Math.max(width, height) > logoLimits.dimension ||
        width * height > logoLimits.pixels ||
        Math.max(width / height, height / width) > 8
      )
        throw new Error("Invalid raster bounds");

      const { data, info } = await image
        .timeout({ seconds: 3 })
        .resize({
          width: 600,
          height: 240,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toColourspace("srgb")
        .ensureAlpha()
        .raw({ depth: "uchar" })
        .toBuffer({ resolveWithObject: true });
      if (info.channels !== 4 || data.length !== info.width * info.height * 4)
        throw new Error("Invalid decoded pixels");
      return new ValidatedAgencyLogo(
        input.ownerAgencyId,
        info.width,
        info.height,
        data,
      );
    } catch {
      throw new AppError(
        "This logo could not be read safely. Use a valid PNG or JPEG.",
        422,
      );
    }
  }
}

export function fitLogo(width: number, height: number) {
  const scale = Math.min(120 / width, 56 / height);
  return { width: width * scale, height: height * scale };
}
