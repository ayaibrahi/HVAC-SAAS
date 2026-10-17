import { describe, expect, it } from "vitest";
import { assertBrandingOrigin, readLogoUpload } from "./http";

const url = "https://preview.example/api/agency-branding";
const request = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "image/png", ...headers },
    body,
  });
describe("bounded owner-logo HTTP input", () => {
  it("accepts only same-origin mutations", () => {
    expect(() =>
      assertBrandingOrigin(
        request("test", { origin: "https://preview.example" }),
      ),
    ).not.toThrow();
    for (const origin of [
      "https://evil.example",
      "null",
      "https://preview.example.evil.test",
    ])
      expect(() => assertBrandingOrigin(request("test", { origin }))).toThrow(
        "not allowed",
      );
    expect(() => assertBrandingOrigin(request("test"))).toThrow("not allowed");
  });
  it("bounds actual streamed bytes regardless of Content-Length", async () => {
    await expect(
      readLogoUpload(request(new Uint8Array(1_048_577))),
    ).rejects.toThrow("up to 1 MB");
    await expect(
      readLogoUpload(request("small", { "Content-Length": "2000000" })),
    ).rejects.toThrow("up to 1 MB");
    await expect(
      readLogoUpload(request("small", { "Content-Length": "invalid" })),
    ).rejects.toThrow("up to 1 MB");
    expect((await readLogoUpload(request("bounded"))).toString()).toBe(
      "bounded",
    );
  });
  it("rejects declared SVG, arbitrary content and empty files", async () => {
    await expect(
      readLogoUpload(request("<svg/>", { "Content-Type": "image/svg+xml" })),
    ).rejects.toThrow("PNG or JPEG");
    await expect(readLogoUpload(request(""))).rejects.toThrow("Choose a logo");
  });
  it("cancels a stalled body by the full upload deadline", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request(url, {
      method: "PUT",
      body: stream,
      duplex: "half",
      headers: { "Content-Type": "image/png" },
    } as RequestInit);
    await expect(readLogoUpload(req, 20)).rejects.toThrow("timed out");
    expect(cancelled).toBe(true);
  });
});
