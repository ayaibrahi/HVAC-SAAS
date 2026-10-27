import { z } from "zod";
import { extractNormalizedAuditSignals, type SignalEvidence } from "../analyzer/signals";
import { hasVerifiedPageContent } from "../analyzer/content-quality";
import type { SafeFetchResult } from "../analyzer/safe-fetch";
import { parseRenderedCapture, renderedLimits, viewportSchema, type RenderedAuditWorker } from "./contract";
import { discoverPages, sameSitePage } from "./discovery";
import { projectRenderedDocument } from "./dom";

export const renderedAuditSchema = z.object({
  version: z.literal("rendered-1"),
  scope: z.literal("sampled_pages"),
  completeSite: z.literal(false),
  entryUrl: z.string().max(2048).url(),
  pages: z.array(z.object({
    url: z.string().max(2048).url(), finalUrl: z.string().max(2048).url(),
    viewport: viewportSchema,
    source: z.enum(["rendered_dom", "static_html"]),
    status: z.enum(["observed", "incomplete", "failed"]),
    reason: z.enum(["none", "render_incomplete", "content_unverified", "worker_error", "deadline", "static_fallback"]),
    signals: z.record(z.string(), z.unknown()).nullable(),
  }).strict()).max(10),
  discovered: z.array(z.string().max(2048).url()).max(200),
  skipped: z.array(z.object({ url: z.string().max(2048).url(), reason: z.enum(["page_limit", "deadline", "worker_error"]) }).strict()).max(200),
  discoveryTruncated: z.boolean(),
}).strict();
export type RenderedAudit = z.infer<typeof renderedAuditSchema>;

export function readRenderedAudit(signals: Record<string, unknown>): RenderedAudit | null {
  const parsed = renderedAuditSchema.safeParse(signals.renderedAudit);
  if (!parsed.success) return null;
  const result = parsed.data;
  const seen = new Set<string>();
  for (const page of result.pages) {
    const key = `${page.url}|${page.viewport}`;
    if ((page.status === "observed" ? !page.signals || !hasVerifiedPageContent(page.signals) ||
        page.signals.analyzedUrl !== page.url || page.signals.finalUrl !== page.finalUrl : page.signals !== null) ||
        seen.has(key) || sameSitePage(page.url, result.entryUrl) !== page.url ||
        sameSitePage(page.finalUrl, result.entryUrl) !== page.finalUrl) return null;
    seen.add(key);
  }
  if (new Set(result.pages.map(p => p.url)).size > 5) return null;
  if ([...result.discovered, ...result.skipped.map(p => p.url)].some(url => sameSitePage(url, result.entryUrl) !== url)) return null;
  return result;
}

export function hasVerifiedRenderedContent(signals: Record<string, unknown>, websiteUrl: string): boolean {
  const result = readRenderedAudit(signals);
  return !!result && result.entryUrl === sameSitePage(websiteUrl, websiteUrl) && result.pages.some(p => p.status === "observed");
}

async function bounded<T>(operation: Promise<T>, milliseconds: number, abort: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { abort.abort(); reject(new Error("Worker deadline")); }, milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

// Application orchestration only. Caller supplies a server-owned isolated worker,
// never a URL/client-supplied executable. Real-worker activation remains disabled.
export async function inspectRenderedSite(input: {
  url: string;
  worker: RenderedAuditWorker;
  staticFallback: (url: string) => Promise<SafeFetchResult>;
}): Promise<RenderedAudit> {
  const entryUrl = sameSitePage(input.url, input.url);
  if (!entryUrl) {
    await bounded(input.worker.close(), 5000, new AbortController());
    throw new Error("Unsupported audit URL");
  }
  const result: RenderedAudit = {
    version: "rendered-1", scope: "sampled_pages", completeSite: false, entryUrl,
    pages: [], discovered: [entryUrl], skipped: [], discoveryTruncated: false,
  };
  const candidates = new Map<string, number>([[entryUrl, -1]]);
  const visited = new Set<string>();
  const started = Date.now();
  let stopped = false;
  let stopReason: "deadline" | "worker_error" = "deadline";
  const addLinks = (links: { href: string; text: string }[], base: string) => {
    for (const candidate of discoverPages(links, base)) {
      if (candidates.has(candidate.url)) continue;
      if (candidates.size >= renderedLimits.discovered) { result.discoveryTruncated = true; break; }
      candidates.set(candidate.url, candidate.priority);
      result.discovered.push(candidate.url);
    }
  };
  try {
    while (visited.size < renderedLimits.pages && !stopped) {
      const remaining = [...candidates].filter(([url]) => !visited.has(url));
      // Prefer a new page category before a second service page.
      const categories = new Set([...visited].map(url => candidates.get(url)));
      remaining.sort((a, b) => Number(categories.has(a[1])) - Number(categories.has(b[1])) || a[1] - b[1] || a[0].localeCompare(b[0]));
      const next = remaining[0]?.[0];
      if (!next) break;
      if (Date.now() - started >= renderedLimits.jobTimeoutMs) { stopped = true; break; }
      visited.add(next);
      for (const viewport of ["desktop", "mobile"] as const) {
        const abort = new AbortController();
        try {
          const remainingMs = renderedLimits.jobTimeoutMs - (Date.now() - started);
          if (remainingMs <= 0) { stopped = true; break; }
          const capture = parseRenderedCapture(await bounded(input.worker.capture({ url: next, viewport, signal: abort.signal }), Math.min(renderedLimits.pageTimeoutMs, remainingMs), abort));
          if (capture.requestedUrl !== next || capture.viewport !== viewport ||
              sameSitePage(capture.finalUrl, entryUrl) !== capture.finalUrl) throw new Error("Worker identity mismatch");
          const html = projectRenderedDocument(capture.document);
          const normalized = extractNormalizedAuditSignals({ fetchResult: {
            analyzedUrl: next, finalUrl: capture.finalUrl, html, status: capture.httpStatus,
            responseTimeMs: capture.elapsedMs, responseSizeBytes: Buffer.byteLength(html),
            redirectCount: 0, contentType: "text/html",
          }, verticalKey: "hvac", playbookVersion: "1.0.0" });
          // Only fields the visible-DOM projection can actually establish. Do not
          // pretend projected metadata/image/byte counts are network observations.
          const signals: Record<string, unknown> = {
            quality: normalized.quality, schemaVersion: normalized.schemaVersion,
            verticalKey: normalized.verticalKey, playbookVersion: normalized.playbookVersion,
            analyzedUrl: next, finalUrl: capture.finalUrl, fetchedAt: normalized.fetchedAt,
            fetch: { httpStatus: normalized.fetch.httpStatus },
            contactConversion: normalized.contactConversion, hvac: normalized.hvac,
          };
          for (const group of [normalized.contactConversion, normalized.hvac]) {
            for (const signal of Object.values(group)) {
              signal.evidence = signal.evidence.map((e: SignalEvidence) => ({ ...e, source: "rendered_dom",
                detail: e.detail.replace(/in static HTML; rendered visibility is not assessed\./g, "in the rendered page snapshot; functionality was not tested.")
                  .replace(/static HTML/g, "the rendered page snapshot").replace(/fetched page/g, "rendered page snapshot"),
              }));
            }
          }
          const observed = capture.status === "observed" && capture.reasons.length === 0 &&
            !capture.document.truncated && hasVerifiedPageContent(signals);
          result.pages.push({ url: next, finalUrl: capture.finalUrl, viewport, source: "rendered_dom",
            status: observed ? "observed" : "incomplete",
            reason: observed ? "none" : capture.status !== "observed" || capture.document.truncated || capture.reasons.length ? "render_incomplete" : "content_unverified",
            signals: observed ? signals : null });
          // Discovery is allowed even if content is thin; never bypass an error,
          // challenge or truncated capture to expand a scan.
          if (observed) addLinks(capture.document.links, capture.finalUrl);
        } catch {
          result.pages.push({ url: next, finalUrl: next, viewport, source: "rendered_dom", status: "failed",
            reason: abort.signal.aborted ? "deadline" : "worker_error", signals: null });
          // A worker failure cannot be retried safely in a possibly live browser.
          stopped = true;
          stopReason = abort.signal.aborted ? "deadline" : "worker_error";
          break;
        }
      }
    }
  } finally {
    // A cleanup failure propagates: never fetch fallback while browser containment
    // is uncertain. The deployed worker must also enforce an independent hard TTL.
    await bounded(input.worker.close(), 5000, new AbortController());
  }
  result.skipped = [...candidates.keys()].filter(url => !visited.has(url))
    .map(url => ({ url, reason: stopped ? stopReason : "page_limit" }));
  // One homepage-only static fallback; never call unknown/failed rendering absence.
  if (!result.pages.some(p => p.status === "observed")) {
    try {
      const fetched = await input.staticFallback(entryUrl);
      if (sameSitePage(fetched.finalUrl, entryUrl) !== fetched.finalUrl) throw new Error("Off-origin fallback");
      const signals = extractNormalizedAuditSignals({ fetchResult: fetched, verticalKey: "hvac", playbookVersion: "1.0.0" });
      if (hasVerifiedPageContent(signals as unknown as Record<string, unknown>)) {
        result.pages = result.pages.filter(p => !(p.url === entryUrl && p.viewport === "desktop"));
        result.pages.unshift({ url: entryUrl, finalUrl: fetched.finalUrl, viewport: "desktop", source: "static_html",
          status: "observed", reason: "static_fallback", signals: signals as unknown as Record<string, unknown> });
      }
    } catch { /* Controlled failure remains explicit; no fabricated findings. */ }
  }
  return result;
}

export function describeRenderedCoverage(result: RenderedAudit) {
  return {
    discovered: result.discovered.length,
    scanned: new Set(result.pages.filter(p => p.status === "observed").map(p => p.url)).size,
    failed: new Set(result.pages.filter(p => p.status === "failed").map(p => p.url)).size,
    incomplete: new Set(result.pages.filter(p => p.status === "incomplete").map(p => p.url)).size,
    skipped: result.skipped.length,
    fullSiteCoverage: false as const,
    staticFallback: result.pages.some(p => p.source === "static_html"),
    observedViewports: result.pages.filter(p => p.status === "observed").length,
    unattemptedViewports: new Set(result.pages.map(p => p.url)).size * 2 - result.pages.length,
    discoveryTruncated: result.discoveryTruncated,
  };
}
