import { describe, expect, it, vi } from "vitest";
import { requestPdfDownload } from "./pdf-download";

describe("authenticated PDF download", () => {
  const href = "/api/proposal-delivery-snapshots/test/pdf";
  const signal = () => new AbortController().signal;
  it("hands off only PDF bytes using the existing authenticated GET route", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("%PDF-1.4\nTEST ONLY", {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="test.pdf"',
          },
        }),
    );
    const result = await requestPdfDownload(href, signal(), fetcher);
    expect(await result.blob.text()).toBe("%PDF-1.4\nTEST ONLY");
    expect(result.filename).toBe("test.pdf");
    expect(fetcher).toHaveBeenCalledWith(
      href,
      expect.objectContaining({
        credentials: "same-origin",
        redirect: "error",
      }),
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 404, 429, 500])(
    "rejects HTTP %s rather than saving an error as PDF",
    async (status) => {
      await expect(
        requestPdfDownload(
          href,
          signal(),
          async () => new Response("safe error", { status }),
        ),
      ).rejects.toThrow("PDF unavailable");
    },
  );
  it.each(["text/html", "application/json"])(
    "rejects %s login/error responses",
    async (type) => {
      await expect(
        requestPdfDownload(
          href,
          signal(),
          async () =>
            new Response("%PDF-pretend", { headers: { "content-type": type } }),
        ),
      ).rejects.toThrow();
    },
  );
  it("rejects a malformed PDF even if its media type claims PDF", async () => {
    await expect(
      requestPdfDownload(
        href,
        signal(),
        async () =>
          new Response("not a PDF", {
            headers: { "content-type": "application/pdf" },
          }),
      ),
    ).rejects.toThrow("Invalid PDF");
  });
  it("bounds response bytes independently of Content-Length", async () => {
    await expect(
      requestPdfDownload(
        href,
        signal(),
        async () =>
          new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
            headers: { "content-type": "application/pdf" },
          }),
      ),
    ).rejects.toThrow("PDF too large");
  });
  it("supports a safe retry after an interruption without any snapshot mutation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("interrupted", "AbortError"))
      .mockResolvedValueOnce(
        new Response("%PDF-1.4", {
          headers: { "content-type": "application/pdf" },
        }),
      );
    await expect(requestPdfDownload(href, signal(), fetcher)).rejects.toThrow();
    await expect(
      requestPdfDownload(href, signal(), fetcher),
    ).resolves.toHaveProperty("blob");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls.every(
        ([url, options]) => url === href && !options?.method,
      ),
    ).toBe(true);
  });
  it("never sends credentials to alternate provider or arbitrary remote URLs", async () => {
    const fetcher = vi.fn();
    await expect(
      requestPdfDownload("https://evil.invalid/pdf", signal(), fetcher),
    ).rejects.toThrow();
    await expect(
      requestPdfDownload("//evil.invalid/pdf", signal(), fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
