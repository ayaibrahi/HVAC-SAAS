import * as http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPinnedRequestOptions,
  defaultSafeFetchLimits,
  nodePinnedHttpTransport,
  safeFetchHtml,
  type SafeFetchTransport,
} from "@/features/audits/analyzer/safe-fetch";
import type { ResolveHostname } from "@/features/audits/analyzer/url-safety";

const publicResolver: ResolveHostname = async () => [
  { address: "93.184.216.34", family: 4 },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("safeFetchHtml", () => {
  it("passes the previously validated address to the transport", async () => {
    const calls: Parameters<SafeFetchTransport>[0][] = [];
    const transport: SafeFetchTransport = async (request) => {
      calls.push(request);

      return new Response("<html><title>Ok</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };

    const result = await safeFetchHtml("https://example.com", {
      transport,
      resolveHostname: publicResolver,
    });

    expect(result.status).toBe(200);
    expect(calls[0]).toMatchObject({
      url: expect.objectContaining({
        hostname: "example.com",
      }),
      resolvedAddress: {
        address: "93.184.216.34",
        family: 4,
      },
    });
  });

  it("rejects oversized responses", async () => {
    const transport: SafeFetchTransport = async () =>
      new Response("<html>too large</html>", {
        status: 200,
        headers: {
          "content-length": "2048",
          "content-type": "text/html",
        },
      });

    await expect(
      safeFetchHtml("https://example.com", {
        transport,
        resolveHostname: publicResolver,
        limits: { maxResponseBytes: 10 },
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("does not perform a second DNS lookup for the socket connection", async () => {
    let resolutionCount = 0;
    const resolvedAddresses: string[] = [];
    const rebindingResolver: ResolveHostname = async () => {
      resolutionCount += 1;

      return [
        {
          address: resolutionCount === 1 ? "93.184.216.34" : "127.0.0.1",
          family: 4,
        },
      ];
    };
    const transport: SafeFetchTransport = async (request) => {
      resolvedAddresses.push(request.resolvedAddress.address);

      return new Response("<html><title>Ok</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };

    await expect(
      safeFetchHtml("http://example.com", {
        resolveHostname: rebindingResolver,
        transport,
      }),
    ).resolves.toMatchObject({ status: 200 });

    expect(resolutionCount).toBe(1);
    expect(resolvedAddresses).toEqual(["93.184.216.34"]);
  });

  it("revalidates redirect destinations before connecting", async () => {
    const resolvedHosts: string[] = [];
    const connectedAddresses: string[] = [];
    const resolver: ResolveHostname = async (hostname) => {
      resolvedHosts.push(hostname);

      return [
        {
          address:
            hostname === "redirect.example.com" ? "93.184.216.35" : "93.184.216.34",
          family: 4,
        },
      ];
    };
    const transport: SafeFetchTransport = async (request) => {
      connectedAddresses.push(request.resolvedAddress.address);

      if (request.url.hostname === "example.com") {
        return new Response("", {
          status: 302,
          headers: { location: "https://redirect.example.com/final" },
        });
      }

      return new Response("<html><title>Ok</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };

    const result = await safeFetchHtml("https://example.com/start", {
      resolveHostname: resolver,
      transport,
    });

    expect(result.finalUrl).toBe("https://redirect.example.com/final");
    expect(resolvedHosts).toEqual(["example.com", "redirect.example.com"]);
    expect(connectedAddresses).toEqual(["93.184.216.34", "93.184.216.35"]);
  });

  it("rejects unsafe redirects before the redirected transport call", async () => {
    const connectedHosts: string[] = [];
    const resolver: ResolveHostname = async (hostname) => {
      if (hostname === "internal.example.com") {
        return [{ address: "10.0.0.25", family: 4 }];
      }

      return [{ address: "93.184.216.34", family: 4 }];
    };
    const transport: SafeFetchTransport = async (request) => {
      connectedHosts.push(request.url.hostname);

      return new Response("", {
        status: 302,
        headers: { location: "http://internal.example.com/admin" },
      });
    };

    await expect(
      safeFetchHtml("https://example.com/start", {
        resolveHostname: resolver,
        transport,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
    expect(connectedHosts).toEqual(["example.com"]);
  });

  it("rejects redirects to unsafe ports before the redirected transport call", async () => {
    const resolvedHosts: string[] = [];
    const connectedHosts: string[] = [];
    const resolver: ResolveHostname = async (hostname) => {
      resolvedHosts.push(hostname);

      return [{ address: "93.184.216.34", family: 4 }];
    };
    const transport: SafeFetchTransport = async (request) => {
      connectedHosts.push(request.url.hostname);

      return new Response("", {
        status: 302,
        headers: { location: "http://public.example:6379/admin" },
      });
    };

    await expect(
      safeFetchHtml("https://example.com/start", {
        resolveHostname: resolver,
        transport,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
    expect(resolvedHosts).toEqual(["example.com"]);
    expect(connectedHosts).toEqual(["example.com"]);
  });

  it("terminates slow-drip body reads with the full request deadline", async () => {
    vi.useFakeTimers();

    const observed: { signal: AbortSignal | null } = { signal: null };
    const transport: SafeFetchTransport = async (request) => {
      observed.signal = request.signal;

      return new Response(createSlowDripBody(20), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };
    const result = safeFetchHtml("https://example.com", {
      transport,
      resolveHostname: publicResolver,
      limits: {
        timeoutMs: 50,
        maxResponseBytes: 1000,
      },
    });
    const timeoutExpectation = expect(result).rejects.toMatchObject({
      code: "FETCH_TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(51);

    await timeoutExpectation;
    if (!observed.signal) {
      throw new Error("Expected transport to receive an abort signal.");
    }

    expect(observed.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up the full request deadline timer after successful body reads", async () => {
    vi.useFakeTimers();

    const transport: SafeFetchTransport = async () =>
      new Response("<html><title>Ok</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    await expect(
      safeFetchHtml("https://example.com", {
        transport,
        resolveHostname: publicResolver,
        limits: { timeoutMs: 1000 },
      }),
    ).resolves.toMatchObject({ status: 200 });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("nodePinnedHttpTransport", () => {
  it("connects to the supplied address and preserves the HTTP Host header", async () => {
    const observedHeaders = await withHttpServer(async (port) => {
      const response = await nodePinnedHttpTransport({
        url: new URL(`http://example.com:${port}/path?x=1`),
        resolvedAddress: { address: "127.0.0.1", family: 4 },
        limits: defaultSafeFetchLimits,
        signal: new AbortController().signal,
      });

      expect(response.status).toBe(200);
      await response.text();
    });

    expect(observedHeaders.host).toBe(`example.com:${observedHeaders.port}`);
    expect(observedHeaders.authorization).toBeUndefined();
    expect(observedHeaders.cookie).toBeUndefined();
  });

  it("preserves HTTPS SNI and Host while pinning the socket hostname", () => {
    const options = createPinnedRequestOptions({
      url: new URL("https://example.com:8443/secure?x=1"),
      resolvedAddress: { address: "93.184.216.34", family: 4 },
      limits: defaultSafeFetchLimits,
      signal: new AbortController().signal,
    });

    expect(options.hostname).toBe("93.184.216.34");
    expect(options.port).toBe(8443);
    expect(options.path).toBe("/secure?x=1");
    expect(options.headers).toMatchObject({
      host: "example.com:8443",
    });
    expect(options.servername).toBe("example.com");
    expect(options).not.toHaveProperty("rejectUnauthorized", false);
  });
});

async function withHttpServer(
  callback: (port: number) => Promise<void>,
): Promise<http.IncomingHttpHeaders & { port: number }> {
  let observedHeaders: http.IncomingHttpHeaders | null = null;
  const server = http.createServer((request, response) => {
    observedHeaders = request.headers;
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><title>Ok</title></html>");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Expected test server to listen on a TCP port.");
  }

  try {
    await callback(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  if (!observedHeaders) {
    throw new Error("Expected test server to receive a request.");
  }

  return Object.assign({ port: address.port }, observedHeaders);
}

function createSlowDripBody(intervalMs: number) {
  const encoder = new TextEncoder();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const pushChunk = () => {
        controller.enqueue(encoder.encode("."));
        timeout = setTimeout(pushChunk, intervalMs);
      };

      pushChunk();
    },
    cancel() {
      if (timeout) {
        clearTimeout(timeout);
      }
    },
  });
}
