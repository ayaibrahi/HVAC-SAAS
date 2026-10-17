import { AppError } from "@/lib/errors";
import { logoLimits } from "@/features/proposals/pdf/logo";

export const brandingResponseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function assertBrandingOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new AppError("This request is not allowed.", 403);
}

// A raw file avoids multipart overhead and never accepts client ownership fields.
export async function readLogoUpload(request: Request, timeoutMs = 10_000) {
  if (
    !["image/png", "image/jpeg"].includes(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new AppError("Use a PNG or JPEG logo.", 422);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > logoLimits.bytes))
    throw new AppError("Use a logo up to 1 MB.", 413);
  if (!request.body) throw new AppError("Choose a logo first.", 422);
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppError("Logo upload timed out. Try again.", 408)),
      timeoutMs,
    );
  });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > logoLimits.bytes)
        throw new AppError("Use a logo up to 1 MB.", 413);
      chunks.push(value);
    }
    if (!size) throw new AppError("Choose a logo first.", 422);
    return Buffer.concat(chunks, size);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
