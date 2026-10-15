import type { ReactElement, MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingDownloadLink } from "./pending-download-link";
import { requestPdfDownload, pdfDownloadTimeoutMs } from "@/lib/pdf-download";

// Exercise the real click handler/lifecycle without adding a DOM testing dependency.
// A separate local browser fixture verifies actual React rendering and labels.
const hooks = vi.hoisted(() => ({
  ref: { current: null as AbortController | null },
  pending: vi.fn(),
  failed: vi.fn(),
  index: 0,
  cleanup: undefined as (() => void) | undefined,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: () => hooks.ref,
  useState: () => [false, hooks.index++ === 0 ? hooks.pending : hooks.failed],
  useEffect: (fn: () => () => void) => {
    hooks.cleanup = fn();
  },
}));
vi.mock("@/lib/pdf-download", () => ({
  requestPdfDownload: vi.fn(),
  pdfDownloadTimeoutMs: 45_000,
}));
const click = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  hooks.index = 0;
  hooks.ref.current = null;
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    createElement: () => ({ href: "", download: "", click, remove: vi.fn() }),
    body: { appendChild: vi.fn() },
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-only");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function handler() {
  const component = PendingDownloadLink({
    href: "/api/proposal-delivery-snapshots/test/pdf",
    label: "Download PDF",
    pendingLabel: "Preparing PDF...",
    errorLabel: "Try Download PDF again",
    className: "",
  });
  const anchor = (
    component.props.children as ReactElement<{
      onClick: (event: MouseEvent<HTMLAnchorElement>) => Promise<void>;
    }>[]
  )[0];
  return () =>
    anchor.props.onClick({
      preventDefault: vi.fn(),
    } as unknown as MouseEvent<HTMLAnchorElement>);
}
describe("PDF download interaction lifecycle", () => {
  it("clears pending after browser handoff, without claiming OS-level save success", async () => {
    vi.mocked(requestPdfDownload).mockResolvedValue({
      blob: new Blob(["%PDF-"]),
      filename: "test.pdf",
    });
    await handler()();
    expect(click).toHaveBeenCalledOnce();
    expect(hooks.pending.mock.calls).toEqual([[true], [false]]);
    expect(hooks.failed).toHaveBeenLastCalledWith(false);
    await vi.runAllTimersAsync();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-only");
  });
  it("shows controlled failure, unlocks, and retries without creating a snapshot", async () => {
    vi.mocked(requestPdfDownload)
      .mockRejectedValueOnce(new Error("private server details"))
      .mockResolvedValueOnce({
        blob: new Blob(["%PDF-"]),
        filename: "test.pdf",
      });
    const run = handler();
    await run();
    expect(hooks.failed).toHaveBeenLastCalledWith(true);
    expect(hooks.pending).toHaveBeenLastCalledWith(false);
    expect(click).not.toHaveBeenCalled();
    await run();
    expect(click).toHaveBeenCalledOnce();
    expect(requestPdfDownload).toHaveBeenCalledTimes(2);
  });
  it("suppresses a simultaneous second click and supports a later repeated download", async () => {
    let finish: (() => void) | undefined;
    vi.mocked(requestPdfDownload).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({ blob: new Blob(["%PDF-"]), filename: "test.pdf" });
        }),
    );
    const run = handler(),
      first = run();
    await run();
    expect(requestPdfDownload).toHaveBeenCalledOnce();
    finish!();
    await first;
    vi.mocked(requestPdfDownload).mockResolvedValue({
      blob: new Blob(["%PDF-"]),
      filename: "test.pdf",
    });
    await run();
    expect(requestPdfDownload).toHaveBeenCalledTimes(2);
  });
  it("aborts on timeout and restores retryable state", async () => {
    vi.mocked(requestPdfDownload).mockImplementation(
      (_path, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("timeout", "AbortError")),
          ),
        ),
    );
    const run = handler()();
    await vi.advanceTimersByTimeAsync(pdfDownloadTimeoutMs);
    await run;
    expect(hooks.pending).toHaveBeenLastCalledWith(false);
    expect(hooks.failed).toHaveBeenLastCalledWith(true);
    expect(hooks.ref.current).toBeNull();
    expect(click).not.toHaveBeenCalled();
  });
  it("aborts an interrupted/unmounted download without handing off partial content", async () => {
    vi.mocked(requestPdfDownload).mockImplementation(
      (_path, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("interrupted", "AbortError")),
          ),
        ),
    );
    const run = handler()();
    hooks.cleanup!();
    await run;
    expect(click).not.toHaveBeenCalled();
    expect(hooks.ref.current).toBeNull();
    expect(hooks.pending).toHaveBeenLastCalledWith(false);
  });
});
