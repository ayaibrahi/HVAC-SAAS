import { expect, it, vi } from "vitest";
import { capturePlaywrightPage, type CapturePage } from "./playwright-capture";
import { parseRenderedCapture } from "./contract";

function harness() {
  let pageError: (() => void) | undefined;
  const page = {
    goto: vi.fn(async () => ({ status: () => 200 })),
    evaluate: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ title: "Test", text: "Visible text", headings: [], links: [{ href: "tel:+12025550123", text: "Call" }], buttons: ["Book now"], forms: ["Contact"], truncated: false }),
    url: () => "https://example.com/",
    on: vi.fn((_event, listener) => { pageError = listener; }), off: vi.fn(), close: vi.fn(async () => {}),
  } satisfies CapturePage;
  return { page, error: () => pageError?.(), input: { page, url: page.url(), viewport: "desktop" as const, signal: new AbortController().signal, hasBlockedRequests: () => false } };
}
it("runs DOM extraction and closes a successful page", async () => {
  const h = harness(); const result = parseRenderedCapture(await capturePlaywrightPage(h.input));
  expect(result.status).toBe("observed");
  expect(result.document.buttons).toEqual(["Book now"]);
  expect(result.document.links[0].href).toMatch(/^tel:/);
  expect(result.document.forms).toEqual(["Contact"]);
  expect(h.page.close).toHaveBeenCalledOnce();
  expect(h.page.off).toHaveBeenCalledOnce();
});
it("marks denied requests and script errors incomplete", async () => {
  const h = harness(); h.page.goto.mockImplementationOnce(async () => { h.error(); return { status: () => 200 }; });
  const result = parseRenderedCapture(await capturePlaywrightPage({ ...h.input, hasBlockedRequests: () => true }));
  expect(result).toMatchObject({ status: "incomplete", reasons: ["script_error", "blocked_request"] });
});
it("closes on navigation error without collecting DOM", async () => {
  const h = harness(); h.page.goto.mockRejectedValueOnce(new Error("timeout"));
  await expect(capturePlaywrightPage(h.input)).rejects.toThrow("timeout");
  expect(h.page.evaluate).not.toHaveBeenCalled();
  expect(h.page.close).toHaveBeenCalledOnce();
});
it("closes an already-cancelled page without navigating", async () => {
  const h = harness(); const abort = new AbortController(); abort.abort();
  await expect(capturePlaywrightPage({ ...h.input, signal: abort.signal })).rejects.toThrow("cancelled");
  expect(h.page.goto).not.toHaveBeenCalled();
  expect(h.page.close).toHaveBeenCalledOnce();
});
