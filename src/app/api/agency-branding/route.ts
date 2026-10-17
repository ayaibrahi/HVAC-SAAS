import { NextResponse } from "next/server";
import { getBrandingContext } from "@/features/agencies/branding/data";
import {
  loadFrozenLogo,
  removeAgencyLogo,
  replaceAgencyLogo,
  assertBrandingActor,
} from "@/features/agencies/branding/service";
import {
  assertBrandingOrigin,
  brandingResponseHeaders,
  readLogoUpload,
} from "@/features/agencies/branding/http";
import { AppError } from "@/lib/errors";
import { jsonError } from "@/lib/api-response";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limiter = new InMemoryRateLimiter({
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000,
});

export async function GET() {
  try {
    const { actor, store } = await getBrandingContext();
    assertBrandingActor(actor);
    const state = await store.current(actor.agencyId);
    const image = await loadFrozenLogo(
      actor.agencyId,
      state.activeAssetId,
      store,
    );
    if (!image) throw new AppError("Agency logo is not available.", 404);
    return new Response(new Uint8Array(image.png), {
      headers: { ...brandingResponseHeaders, "Content-Type": "image/png" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  return mutate(request, false);
}
export async function DELETE(request: Request) {
  return mutate(request, true);
}

async function mutate(request: Request, remove: boolean) {
  try {
    assertBrandingOrigin(request);
    const { actor, store } = await getBrandingContext();
    assertBrandingActor(actor);
    if (!limiter.check(actor.agencyId).allowed)
      throw new AppError("Too many logo changes. Try again later.", 429);
    let assetId: string | null = null;
    if (remove) await removeAgencyLogo(actor, store);
    else
      assetId = await replaceAgencyLogo(
        actor,
        await readLogoUpload(request),
        store,
      );
    return NextResponse.json({ assetId }, { headers: brandingResponseHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const response = jsonError(error);
  for (const [key, value] of Object.entries(brandingResponseHeaders))
    response.headers.set(key, value);
  return response;
}
