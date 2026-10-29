import "server-only";
import { defaultResolveHostname, validateSafeHttpUrl, type ResolveHostname } from "../analyzer/url-safety";
import { defaultSafeFetchLimits, nodePinnedHttpTransport, selectConnectionAddress, type SafeFetchTransport } from "../analyzer/safe-fetch";

// This broker is NOT an OS boundary. Do not enable a browser until its network
// namespace/firewall forces every request through a separately reviewed broker.
// The broker accepts no caller-supplied headers, cookies, credentials or methods.
const LIMITS = { requests: 100, bytesPerResponse: 500_000, totalBytes: 5_000_000, timeoutMs: 8_000, redirects: 3 } as const;
const contentTypes = new Set(["text/html", "application/xhtml+xml", "text/css", "text/javascript", "application/javascript", "application/x-javascript", "application/json", "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "font/woff", "font/woff2", "application/font-woff"]);
export type BrokerResult = { url: string; status: number; contentType: string; body: Uint8Array };

export function createPinnedEgressBroker(input: {
  origin: string; resolveHostname?: ResolveHostname; transport?: SafeFetchTransport;
}) {
  const initial = new URL(input.origin);
  if (!["http:", "https:"].includes(initial.protocol) || initial.username || initial.password || initial.port || initial.hash)
    throw new Error("Invalid audit origin");
  const origin = initial.origin;
  const resolve = input.resolveHostname ?? defaultResolveHostname;
  const transport = input.transport ?? nodePinnedHttpTransport;
  let requests = 0, totalBytes = 0;
  return {
    async get(raw: string, method: string, signal?: AbortSignal): Promise<BrokerResult> {
      if (method !== "GET") throw new Error("Unsupported method");
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) throw new Error("Request cancelled");
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, LIMITS.timeoutMs);
      // DNS and body reads may not honor AbortSignal; race every asynchronous
      // stage while the signal is also passed to the pinned socket transport.
      const bounded = async <T>(promise: Promise<T>): Promise<T> => {
        if (controller.signal.aborted) throw new Error("Request cancelled");
        return new Promise<T>((resolvePromise, reject) => {
          const onAbort = () => reject(new Error("Request cancelled"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
          promise.then(value => { controller.signal.removeEventListener("abort", onAbort); resolvePromise(value); }, error => { controller.signal.removeEventListener("abort", onAbort); reject(error); });
        });
      };
      try {
        let url = new URL(raw, initial);
        for (let redirects = 0; redirects <= LIMITS.redirects; redirects++) {
          if (url.origin !== origin || url.hash) throw new Error("Cross-origin request denied");
          // Redirect hops consume the same request budget as initial requests.
          if (++requests > LIMITS.requests) throw new Error("Request limit exceeded");
          const target = await bounded(validateSafeHttpUrl(url.toString(), resolve));
          // Transport connects to this validated IP; original Host and HTTPS SNI
          // are preserved by the existing Node pinned transport.
          const response = await bounded(transport({ url: target.url, resolvedAddress: selectConnectionAddress(target.resolvedAddresses), limits: { ...defaultSafeFetchLimits, timeoutMs: LIMITS.timeoutMs, maxResponseBytes: LIMITS.bytesPerResponse }, signal: controller.signal }));
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (response.body) void response.body.cancel().catch(() => {});
            if (!location || redirects === LIMITS.redirects) throw new Error("Redirect rejected");
            url = new URL(location, target.url);
            continue;
          }
          if (response.status < 200 || response.status >= 300 || response.status === 204 || response.status === 206 || !["", "identity"].includes((response.headers.get("content-encoding") ?? "").trim().toLowerCase())) throw new Error("Response rejected");
          const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
          if (!contentTypes.has(contentType)) throw new Error("Content type rejected");
          const chunks: Uint8Array[] = []; let size = 0;
          const reader = response.body?.getReader();
          try {
            if (reader) for (;;) {
              const item = await bounded(reader.read());
              if (item.done) break;
              size += item.value.byteLength; totalBytes += item.value.byteLength;
              if (size > LIMITS.bytesPerResponse || totalBytes > LIMITS.totalBytes) throw new Error("Response limit exceeded");
              chunks.push(item.value);
            }
          } finally { if (reader) { if (controller.signal.aborted || size > LIMITS.bytesPerResponse || totalBytes > LIMITS.totalBytes) void reader.cancel().catch(() => {}); reader.releaseLock(); } }
          const body = new Uint8Array(size); let offset = 0;
          for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
          return { url: target.url.toString(), status: response.status, contentType, body };
        }
        throw new Error("Redirect rejected");
      } finally {
        clearTimeout(timer); signal?.removeEventListener("abort", abort); controller.abort();
      }
    },
  };
}
