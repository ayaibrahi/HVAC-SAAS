import { z } from "zod";
import type { ParsedHtmlDocument } from "./html";
import type { SafeFetchResult } from "./safe-fetch";

export const contentQualitySchema = z.object({
  version: z.literal(1),
  status: z.enum(["sufficient", "insufficient"]),
  reasons: z.array(
    z.enum(["http", "partial", "not_html", "challenge", "incomplete", "thin"]),
  ),
  visibleCharacters: z.number().int().nonnegative(),
});
export type ContentQuality = z.infer<typeof contentQualitySchema>;

export function assessContentQuality(
  fetch: SafeFetchResult,
  document: ParsedHtmlDocument,
): ContentQuality {
  const reasons: ContentQuality["reasons"] = [];
  if (fetch.status < 200 || fetch.status >= 300) reasons.push("http");
  if (fetch.status === 206 || fetch.status === 204) reasons.push("partial");
  if (!/<(?:html|body|main|article)\b/i.test(fetch.html))
    reasons.push("not_html");
  const title = document.title ?? "";
  // Check interstitial identity, not an ordinary business mention of security/cookies.
  if (
    /^(?:just a moment|access denied|attention required|verify (?:you|your)|robot check|security check|enable javascript|before you continue|consent required)/i.test(
      title.trim(),
    ) ||
    /(?:cf-chl-|challenge-platform|id\s*=\s*["'](?:challenge-form|px-captcha))/i.test(
      fetch.html,
    ) ||
    /(?:verify (?:that )?you are (?:a )?human|checking your browser|enable javascript and cookies to continue)/i.test(
      document.visibleText,
    )
  )
    reasons.push("challenge");
  if (
    (/<html\b/i.test(fetch.html) && !/<\/html\s*>/i.test(fetch.html)) ||
    (/<body\b/i.test(fetch.html) && !/<\/body\s*>/i.test(fetch.html))
  )
    reasons.push("incomplete");
  // Conservative static-page floor: don't infer absence from a header, JS shell,
  // or consent-only fragment. This is eligibility, not a promise of full rendering.
  if (
    document.mainText.length < 180 ||
    document.mainText.split(/\s+/).length < 24 ||
    (!document.h1.length &&
      !document.h2.length &&
      !/<(?:main|article|p)\b/i.test(fetch.html))
  )
    reasons.push("thin");
  return {
    version: 1,
    status: reasons.length ? "insufficient" : "sufficient",
    reasons,
    visibleCharacters: document.mainText.length,
  };
}

export function hasVerifiedPageContent(
  signals: Record<string, unknown>,
): boolean {
  const quality = contentQualitySchema.safeParse(signals.quality);
  if (
    !quality.success ||
    quality.data.status !== "sufficient" ||
    quality.data.reasons.length
  )
    return false;
  const fetch = signals.fetch;
  if (!fetch || typeof fetch !== "object" || !("httpStatus" in fetch))
    return false;
  const status = fetch.httpStatus;
  return Boolean(
    status &&
    typeof status === "object" &&
    "value" in status &&
    typeof status.value === "number" &&
    status.value >= 200 &&
    status.value < 300 &&
    status.value !== 204 &&
    status.value !== 206,
  );
}
