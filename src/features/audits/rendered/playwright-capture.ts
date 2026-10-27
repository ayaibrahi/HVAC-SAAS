import { collectRenderedDocument } from "./dom";
import { renderedLimits, type RenderViewport } from "./contract";

// Structural Playwright Page contract keeps Chromium/dependencies OUT of Next.js.
// A separate isolated worker supplies the real Page, after its egress boundary
// and fresh context have been established. This function does not launch a browser.
export interface CapturePage {
  goto(url: string, options: { waitUntil: "domcontentloaded"; timeout: number }): Promise<{ status(): number } | null>;
  evaluate<T>(callback: () => T): Promise<Awaited<T>>;
  url(): string;
  on(event: "pageerror", listener: () => void): unknown;
  off(event: "pageerror", listener: () => void): unknown;
  close(): Promise<void>;
}

export async function capturePlaywrightPage(input: {
  page: CapturePage; url: string; viewport: RenderViewport; signal: AbortSignal;
  // Must include subresource denials as well as navigation denials.
  hasBlockedRequests: () => boolean;
}): Promise<string> {
  const start = Date.now();
  let scriptError = false;
  const onError = () => { scriptError = true; };
  const onAbort = () => { void input.page.close().catch(() => {}); };
  if (input.signal.aborted) {
    await input.page.close();
    throw new Error("Capture cancelled");
  }
  input.signal.addEventListener("abort", onAbort, { once: true });
  input.page.on("pageerror", onError);
  try {
    const response = await input.page.goto(input.url, { waitUntil: "domcontentloaded", timeout: renderedLimits.pageTimeoutMs });
    // Bounded observation window, not networkidle and never a claim that all JS
    // finished. No fixture-only data-render-ready attribute in the real adapter.
    await input.page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 500)));
    const document = await input.page.evaluate(collectRenderedDocument);
    const reasons: string[] = [];
    if (scriptError) reasons.push("script_error");
    if (input.hasBlockedRequests()) reasons.push("blocked_request");
    if (!response || response.status() < 200 || response.status() >= 300 || [204, 206].includes(response.status())) reasons.push("http_error");
    if (document.truncated) reasons.push("limit");
    if (input.signal.aborted || Date.now() - start > renderedLimits.pageTimeoutMs) throw new Error("Capture cancelled");
    const serialized = JSON.stringify({
      requestedUrl: input.url, finalUrl: input.page.url(), viewport: input.viewport,
      status: reasons.length ? "incomplete" : "observed", reasons,
      httpStatus: response?.status() ?? 500, elapsedMs: Date.now() - start, document,
    });
    if (Buffer.byteLength(serialized) > renderedLimits.documentBytes) throw new Error("Capture exceeds budget");
    return serialized;
  } finally {
    input.signal.removeEventListener("abort", onAbort);
    input.page.off("pageerror", onError);
    await input.page.close();
  }
}
