import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { inspectRenderedSite, readRenderedAudit, describeRenderedCoverage } from "./pipeline";
import { parseRenderedCapture, type RenderedCapture, type RenderedAuditWorker } from "./contract";
import { discoverPages, sameSitePage } from "./discovery";
import { projectRenderedDocument } from "./dom";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { makeAudit, makeDetectedSignals } from "@/features/opportunities/test-fixtures";
import { assertAuditReadyForOpportunityGeneration } from "@/features/opportunities/authorization";

const url = "https://example.com/";
export function capture(overrides: Partial<RenderedCapture> = {}): RenderedCapture {
  return {
    requestedUrl: url, finalUrl: url, viewport: "desktop", status: "observed", reasons: [], httpStatus: 200, elapsedMs: 10,
    document: {
      title: "Example heating and cooling", headings: ["Heating and cooling services"],
      text: "Our experienced technicians provide heating and cooling repair for homeowners. We explain the available options and help customers choose an appropriate repair or replacement. Explore the service information and contact our team to discuss your needs and arrange an appointment at a convenient time.",
      links: [], buttons: [], forms: [], truncated: false,
    }, ...overrides,
  };
}
function worker(make: (url: string, viewport: "desktop" | "mobile") => RenderedCapture = (url, viewport) => capture({ requestedUrl: url, finalUrl: url, viewport })) {
  return { capture: vi.fn(async (i: Parameters<RenderedAuditWorker["capture"]>[0]) => JSON.stringify(make(i.url, i.viewport))), close: vi.fn(async () => {}) };
}
const fallback = () => vi.fn(async () => ({
  analyzedUrl: url, finalUrl: url, html: readFileSync(new URL("../analyzer/fixtures/representative.html", import.meta.url), "utf8"),
  status: 200, responseTimeMs: 1, responseSizeBytes: 1000, redirectCount: 0, contentType: "text/html",
}));

describe("rendered audit integration (no browser or external network)", () => {
  it("closes the allocated worker if the initial URL is unsupported", async () => {
    const renderer = worker(); const staticFallback = fallback();
    await expect(inspectRenderedSite({ url: "file:///private", worker: renderer, staticFallback })).rejects.toThrow("Unsupported audit URL");
    expect(renderer.close).toHaveBeenCalledOnce();
    expect(renderer.capture).not.toHaveBeenCalled();
    expect(staticFallback).not.toHaveBeenCalled();
  });
  it.each(["https://evil.example/contact", "//evil.example/contact", "file:///etc/passwd", "http://127.0.0.1/", "https://example.com:8443/", "/logout", "/%6cogout", "/contact?token=secret", "/logo.png", "https://user:pass@example.com/"])("rejects discovery target %s", target => {
    expect(sameSitePage(target, url)).toBeNull();
  });
  it("normalizes fragments, preserves meaningful trailing slashes and prioritizes important pages", () => {
    expect(sameSitePage("/services/#repair", url)).toBe("https://example.com/services/");
    expect(discoverPages([
      { href: "/booking", text: "Book" }, { href: "/contact#top", text: "Contact" },
      { href: "/contact", text: "Contact" }, { href: "/services", text: "Services" }, { href: "/news", text: "News" },
    ], url).map(p => p.url)).toEqual(["https://example.com/services", "https://example.com/contact", "https://example.com/booking"]);
  });
  it("limits to five pages/ten viewports, covers categories and records skipped pages", async () => {
    const renderer = worker((url, viewport) => {
      const data = capture({ requestedUrl: url, finalUrl: url, viewport });
      data.document.links = ["/services", "/heating", "/contact", "/quote", "/booking", "/services#top"].map(href => ({ href, text: href }));
      return data;
    });
    const staticFallback = fallback();
    const result = await inspectRenderedSite({ url, worker: renderer, staticFallback });
    expect(renderer.capture).toHaveBeenCalledTimes(10);
    expect(new Set(result.pages.map(p => p.url))).toEqual(new Set([url, "https://example.com/heating", "https://example.com/contact", "https://example.com/quote", "https://example.com/booking"]));
    expect(result.skipped).toEqual([{ url: "https://example.com/services", reason: "page_limit" }]);
    expect(describeRenderedCoverage(result)).toMatchObject({ scanned: 5, skipped: 1, fullSiteCoverage: false });
    expect(renderer.close).toHaveBeenCalledOnce();
    expect(staticFallback).not.toHaveBeenCalled();
  });
  it("feeds page-scoped rules, deduplicates rules/viewports and keeps the top five", async () => {
    const result = await inspectRenderedSite({ url, worker: worker(), staticFallback: fallback() });
    const audit = makeAudit(makeDetectedSignals(), { websiteUrl: url, normalizedSignals: { renderedAudit: result } });
    expect(() => assertAuditReadyForOpportunityGeneration(audit, audit.agencyId)).not.toThrow();
    expect(() => assertAuditReadyForOpportunityGeneration(audit, "other-agency")).toThrow("Audit not found");
    expect(() => assertAuditReadyForOpportunityGeneration({ ...audit, websiteUrl: "https://other.example/" }, audit.agencyId)).toThrow("could not be reliably verified");
    const findings = evaluateOpportunitiesForAudit({ audit, agencyServices: [] });
    expect(findings).toHaveLength(5);
    expect(new Set(findings.map(o => o.ruleKey)).size).toBe(5);
    expect(findings.every(o => o.agencyServiceId === null)).toBe(true);
    for (const finding of findings) for (const evidence of finding.evidence) {
      expect(evidence.scope).toBe("analyzed_page");
      expect(evidence.details).toContain(`Observed page: ${url}`);
      expect(evidence.analyzer_evidence?.[0].url).toBe(url);
    }
  });
  it("dynamic booking, phone and form positives suppress unsupported absence findings", async () => {
    const renderer = worker((url, viewport) => {
      const data = capture({ requestedUrl: url, finalUrl: url, viewport });
      data.document.links = [{ href: "tel:+12025550123", text: "Call" }];
      data.document.buttons = ["Book a visit"];
      data.document.forms = ["Request an estimate"];
      return data;
    });
    const result = await inspectRenderedSite({ url, worker: renderer, staticFallback: fallback() });
    const findings = evaluateOpportunitiesForAudit({ audit: makeAudit(makeDetectedSignals(), { websiteUrl: url, normalizedSignals: { renderedAudit: result } }), agencyServices: [] });
    expect(findings.some(o => ["missing_online_booking", "weak_lead_capture"].includes(o.ruleKey))).toBe(false);
    expect(result.pages[0].signals).not.toHaveProperty("page.imageCount");
    expect(result.pages[0].signals).not.toHaveProperty("fetch.responseSizeBytes");
  });
  it.each(["script_error", "blocked_request", "limit"] as const)("does not infer missing features from %s", reason => {
    const data = capture({ status: "incomplete", reasons: [reason] });
    expect(parseRenderedCapture(JSON.stringify(data)).status).toBe("incomplete");
  });
  it("returns no opportunities for incomplete rendering and an unusable fallback", async () => {
    const renderer = worker((url, viewport) => capture({ requestedUrl: url, finalUrl: url, viewport, status: "incomplete", reasons: ["script_error"] }));
    const result = await inspectRenderedSite({ url, worker: renderer, staticFallback: vi.fn().mockRejectedValue(new Error("static failed")) });
    expect(result.pages.every(p => p.signals === null)).toBe(true);
    expect(evaluateOpportunitiesForAudit({ audit: makeAudit(makeDetectedSignals(), { normalizedSignals: { renderedAudit: result }, websiteUrl: url }), agencyServices: [] })).toEqual([]);
  });
  it("preserves static fallback identity instead of claiming a rendered scan", async () => {
    const renderer = worker(); renderer.capture.mockRejectedValueOnce(new Error("worker failed"));
    const staticFallback = fallback();
    const result = await inspectRenderedSite({ url, worker: renderer, staticFallback });
    expect(renderer.capture).toHaveBeenCalledOnce();
    expect(staticFallback).toHaveBeenCalledOnce();
    expect(result.pages[0]).toMatchObject({ source: "static_html", reason: "static_fallback", status: "observed" });
    expect(describeRenderedCoverage(result).staticFallback).toBe(true);
  });
  it("rejects malformed, oversized and foreign worker responses before generating findings", async () => {
    expect(() => parseRenderedCapture("x".repeat(131073))).toThrow();
    expect(() => parseRenderedCapture('{"password":"secret"}')).toThrow();
    expect(() => parseRenderedCapture("not json")).toThrow();
    const renderer = worker(() => capture({ finalUrl: "https://evil.example/" }));
    const result = await inspectRenderedSite({ url, worker: renderer, staticFallback: vi.fn().mockRejectedValue(new Error("no fallback")) });
    expect(result.pages[0]).toMatchObject({ status: "failed", reason: "worker_error", signals: null });
    expect(renderer.capture).toHaveBeenCalledOnce();
  });
  it("fails closed on cleanup failure without a fallback request", async () => {
    const renderer = worker(); renderer.close.mockRejectedValueOnce(new Error("cleanup failed"));
    const staticFallback = fallback();
    await expect(inspectRenderedSite({ url, worker: renderer, staticFallback })).rejects.toThrow("cleanup failed");
    expect(staticFallback).not.toHaveBeenCalled();
  });
  it("aborts a hanging capture once and cleans up before static fallback", async () => {
    vi.useFakeTimers();
    try {
      const renderer = worker(); renderer.capture.mockImplementation(() => new Promise(() => {}));
      const operation = inspectRenderedSite({ url, worker: renderer, staticFallback: fallback() });
      await vi.advanceTimersByTimeAsync(8001);
      const result = await operation;
      expect(renderer.capture.mock.calls[0][0].signal.aborted).toBe(true);
      expect(renderer.close).toHaveBeenCalledOnce();
      expect(result.pages[0].reason).toBe("static_fallback");
    } finally { vi.useRealTimers(); }
  });
  it("bounds cleanup failure and never starts fallback when termination is uncertain", async () => {
    vi.useFakeTimers();
    try {
      const renderer = worker(); renderer.close.mockImplementation(() => new Promise(() => {}));
      const staticFallback = fallback();
      const rejected = expect(inspectRenderedSite({ url, worker: renderer, staticFallback })).rejects.toThrow("Worker deadline");
      await vi.advanceTimersByTimeAsync(5001);
      await rejected;
      expect(staticFallback).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("fails closed on malformed stored coverage, duplicate viewports and cross-origin pages", async () => {
    const result = await inspectRenderedSite({ url, worker: worker(), staticFallback: fallback() });
    expect(readRenderedAudit({ renderedAudit: result })).not.toBeNull();
    result.pages[0].signals!.analyzedUrl = "https://example.com/other";
    expect(readRenderedAudit({ renderedAudit: result })).toBeNull();
    result.pages[0].signals!.analyzedUrl = url;
    result.pages.push(result.pages[0]);
    expect(readRenderedAudit({ renderedAudit: result })).toBeNull();
    result.pages.pop(); result.pages[0].finalUrl = "https://evil.example/";
    expect(readRenderedAudit({ renderedAudit: result })).toBeNull();
    expect(evaluateOpportunitiesForAudit({ audit: makeAudit(makeDetectedSignals(), { normalizedSignals: { ...makeDetectedSignals(), renderedAudit: {} } }), agencyServices: [] })).toEqual([]);
  });
  it("escapes DOM projections and never embeds executable source", () => {
    const document = capture().document;
    document.title = '<script>alert(1)</script>';
    document.links = [{ text: "<img>", href: '\" onclick=\"steal()' }];
    const html = projectRenderedDocument(document);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot; onclick=&quot;');
  });
});
