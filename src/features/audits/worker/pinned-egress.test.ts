import { describe, expect, it, vi } from "vitest";
import { createPinnedEgressBroker } from "./pinned-egress";
import { createPinnedRequestOptions, type SafeFetchTransportRequest } from "../analyzer/safe-fetch";

vi.mock("server-only", () => ({}));
const origin = "https://hvac.example/";
const publicDns = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
const html = () => new Response("fixture", { status: 200, headers: { "content-type": "text/html", "set-cookie": "private=never-forward" } });

describe("pinned egress broker, no network", () => {
  it("pins the validated address and preserves Host/SNI without forwarding response cookies", async () => {
    const dns = vi.fn().mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    const transport = vi.fn(async (r: SafeFetchTransportRequest) => { const options = createPinnedRequestOptions(r); expect(options.hostname).toBe("93.184.216.34"); expect(options.servername).toBe("hvac.example"); expect(options.headers).toMatchObject({ host: "hvac.example" }); return html(); });
    const broker = createPinnedEgressBroker({ origin, resolveHostname: dns, transport });
    const result = await broker.get("/services", "GET");
    expect(dns).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledOnce();
    expect(result).toEqual({ url: "https://hvac.example/services", status: 200, contentType: "text/html", body: new TextEncoder().encode("fixture") });
    expect(result).not.toHaveProperty("headers");
  });
  it.each(["http://127.0.0.1/", "https://169.254.169.254/", "https://[::ffff:7f00:1]/", "https://other.example/", "https://hvac.example:8443/", "file:///etc/passwd", "https://user:password@hvac.example/"])("rejects unsafe destination %s", async url => {
    const transport = vi.fn(async () => html());
    const broker = createPinnedEgressBroker({ origin, resolveHostname: publicDns, transport });
    await expect(broker.get(url, "GET")).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("revalidates each same-origin redirect, including changed DNS", async () => {
    const dns = vi.fn().mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]).mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    const transport = vi.fn(async () => new Response(null, { status: 302, headers: { location: "/next" } }));
    await expect(createPinnedEgressBroker({ origin, resolveHostname: dns, transport }).get("/", "GET")).rejects.toThrow();
    expect(dns).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects cross-origin redirects and non-GET operations before a second transport", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://other.example/" } }));
    const broker = createPinnedEgressBroker({ origin, resolveHostname: publicDns, transport });
    await expect(broker.get("/", "POST")).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    await expect(broker.get("/", "GET")).rejects.toThrow();
    expect(transport).toHaveBeenCalledOnce();
  });
  it("counts redirect hops against the per-job request limit", async () => {
    const transport = vi.fn(async (request: SafeFetchTransportRequest) => request.url.pathname === "/redirect"
      ? new Response(null, { status: 302, headers: { location: "/final" } }) : html());
    const broker = createPinnedEgressBroker({ origin, resolveHostname: publicDns, transport });
    for (let i = 0; i < 50; i++) await broker.get("/redirect", "GET");
    await expect(broker.get("/", "GET")).rejects.toThrow("Request limit exceeded");
    expect(transport).toHaveBeenCalledTimes(100);
  });
  it("rejects mixed public and private DNS results and oversized bodies", async () => {
    const transport = vi.fn(async () => html());
    const mixed = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }, { address: "192.168.1.1", family: 4 as const }]);
    await expect(createPinnedEgressBroker({ origin, resolveHostname: mixed, transport }).get("/", "GET")).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    const large = vi.fn(async () => new Response(new Uint8Array(500_001), { headers: { "content-type": "text/html" } }));
    await expect(createPinnedEgressBroker({ origin, resolveHostname: publicDns, transport: large }).get("/", "GET")).rejects.toThrow("Response limit exceeded");
  });
  it("enforces deadlines even when DNS never resolves", async () => {
    vi.useFakeTimers();
    try {
      const broker = createPinnedEgressBroker({ origin, resolveHostname: () => new Promise(() => {}), transport: vi.fn() });
      const check = expect(broker.get("/", "GET")).rejects.toThrow("cancelled");
      await vi.advanceTimersByTimeAsync(8001);
      await check;
    } finally { vi.useRealTimers(); }
  });
});
