import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import {
  AnalyzerError,
  normalizeAnalyzerError,
} from "@/features/audits/analyzer/errors";
import {
  defaultResolveHostname,
  normalizeHostname,
  validateRedirectTarget,
  validateSafeHttpUrl,
  type ResolvedAddress,
  type ResolveHostname,
  type SafeUrlResult,
} from "@/features/audits/analyzer/url-safety";

export type SafeFetchLimits = {
  timeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  userAgent: string;
};

export type SafeFetchResult = {
  analyzedUrl: string;
  finalUrl: string;
  html: string;
  status: number;
  responseTimeMs: number;
  responseSizeBytes: number;
  redirectCount: number;
  contentType: string | null;
};

export type SafeFetchTransportRequest = {
  url: URL;
  resolvedAddress: ResolvedAddress;
  limits: SafeFetchLimits;
  signal: AbortSignal;
};

export type SafeFetchTransport = (
  request: SafeFetchTransportRequest,
) => Promise<Response>;

export type PinnedRequestOptions = http.RequestOptions & {
  servername?: string;
};

export const defaultSafeFetchLimits: SafeFetchLimits = {
  timeoutMs: 10_000,
  maxResponseBytes: 1_000_000,
  maxRedirects: 3,
  userAgent: "WebsiteAnalyzerCore/0.1",
};

export async function safeFetchHtml(
  rawUrl: string,
  options: {
    limits?: Partial<SafeFetchLimits>;
    resolveHostname?: ResolveHostname;
    transport?: SafeFetchTransport;
  } = {},
): Promise<SafeFetchResult> {
  const limits = { ...defaultSafeFetchLimits, ...options.limits };
  const resolveHostname = options.resolveHostname ?? defaultResolveHostname;
  const transport = options.transport ?? nodePinnedHttpTransport;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(createAbortError()),
    limits.timeoutMs,
  );
  const startedAt = Date.now();

  try {
    let currentTarget = await withAbortSignal(
      validateSafeHttpUrl(rawUrl, resolveHostname),
      controller.signal,
    );
    const initialUrl = currentTarget.url.toString();

    for (
      let redirectCount = 0;
      redirectCount <= limits.maxRedirects;
      redirectCount += 1
    ) {
      const response = await fetchWithTimeout(
        currentTarget,
        limits,
        transport,
        controller.signal,
      );

      if (isRedirectStatus(response.status)) {
        if (redirectCount === limits.maxRedirects) {
          throw new AnalyzerError(
            "TOO_MANY_REDIRECTS",
            "The website redirected too many times to analyze safely.",
            502,
          );
        }

        const safeRedirect = await withAbortSignal(
          validateRedirectTarget(
            currentTarget.url.toString(),
            response.headers.get("location"),
            resolveHostname,
          ),
          controller.signal,
        );
        currentTarget = safeRedirect;
        continue;
      }

      if (
        response.status < 200 ||
        response.status >= 300 ||
        response.status === 204 ||
        response.status === 206 ||
        !["", "identity"].includes(
          (response.headers.get("content-encoding") ?? "").trim().toLowerCase(),
        )
      ) {
        throw new AnalyzerError(
          "CONTENT_NOT_VERIFIABLE",
          "We could not reliably inspect this page. No website recommendations were made.",
          422,
        );
      }
      assertSupportedContentType(response.headers.get("content-type"));
      const { html, bytes } = await readLimitedBody(
        response,
        limits.maxResponseBytes,
        controller.signal,
      );

      return {
        analyzedUrl: initialUrl,
        finalUrl: currentTarget.url.toString(),
        html,
        status: response.status,
        responseTimeMs: Date.now() - startedAt,
        responseSizeBytes: bytes,
        redirectCount,
        contentType: response.headers.get("content-type"),
      };
    }

    throw new AnalyzerError(
      "TOO_MANY_REDIRECTS",
      "The website redirected too many times to analyze safely.",
      502,
    );
  } catch (error) {
    throw normalizeAnalyzerError(error);
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

async function fetchWithTimeout(
  target: SafeUrlResult,
  limits: SafeFetchLimits,
  transport: SafeFetchTransport,
  signal: AbortSignal,
) {
  assertNotAborted(signal);

  try {
    return await transport({
      url: target.url,
      resolvedAddress: selectConnectionAddress(target.resolvedAddresses),
      limits,
      signal,
    });
  } catch (error) {
    throw normalizeAnalyzerError(error);
  }
}

export function selectConnectionAddress(addresses: ResolvedAddress[]) {
  const address = addresses[0];

  if (!address) {
    throw new AnalyzerError(
      "DNS_LOOKUP_FAILED",
      "The submitted website host could not be resolved.",
    );
  }

  return address;
}

export async function nodePinnedHttpTransport(
  request: SafeFetchTransportRequest,
) {
  if (request.signal.aborted) {
    throw createAbortError();
  }

  return new Promise<Response>((resolve, reject) => {
    const requestOptions = createPinnedRequestOptions(request);
    const client = request.url.protocol === "https:" ? https : http;
    const outboundRequest = client.request(requestOptions);
    const abortRequest = () => outboundRequest.destroy(createAbortError());
    const cleanup = () => {
      request.signal.removeEventListener("abort", abortRequest);
    };

    outboundRequest.on("response", (incomingMessage) => {
      const cleanupAfterBody = () => cleanup();

      incomingMessage.once("end", cleanupAfterBody);
      incomingMessage.once("close", cleanupAfterBody);
      incomingMessage.once("error", cleanupAfterBody);

      try {
        resolve(createWebResponse(incomingMessage));
      } catch (error) {
        reject(error);
      }
    });

    request.signal.addEventListener("abort", abortRequest, { once: true });
    outboundRequest.on("error", (error) => {
      cleanup();
      reject(error);
    });
    outboundRequest.end();
  });
}

export function createPinnedRequestOptions(
  request: SafeFetchTransportRequest,
): PinnedRequestOptions {
  const originalHostname = normalizeHostname(request.url.hostname);
  const isHttps = request.url.protocol === "https:";
  const port = request.url.port
    ? Number.parseInt(request.url.port, 10)
    : isHttps
      ? 443
      : 80;
  const options: PinnedRequestOptions = {
    protocol: request.url.protocol,
    hostname: request.resolvedAddress.address,
    family: request.resolvedAddress.family,
    port,
    method: "GET",
    path: `${request.url.pathname}${request.url.search}`,
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5",
      host: buildHostHeader(request.url),
      "user-agent": request.limits.userAgent,
      "accept-encoding": "identity",
    },
  };

  if (isHttps && isIP(originalHostname) === 0) {
    options.servername = originalHostname;
  }

  return options;
}

function buildHostHeader(url: URL) {
  const hostname = normalizeHostname(url.hostname);
  const host = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  const defaultPort = url.protocol === "https:" ? "443" : "80";

  return url.port && url.port !== defaultPort ? `${host}:${url.port}` : host;
}

function createWebResponse(incomingMessage: http.IncomingMessage) {
  if (!incomingMessage.statusCode) {
    throw new AnalyzerError(
      "FETCH_FAILED",
      "We could not fetch the submitted website safely.",
      502,
    );
  }

  return new Response(
    Readable.toWeb(incomingMessage) as ReadableStream<Uint8Array>,
    {
      status: incomingMessage.statusCode,
      headers: createResponseHeaders(incomingMessage.headers),
    },
  );
}

function createResponseHeaders(headers: http.IncomingHttpHeaders) {
  const responseHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        responseHeaders.append(name, item);
      }
      continue;
    }

    if (typeof value === "string") {
      responseHeaders.set(name, value);
    }
  }

  return responseHeaders;
}

function assertSupportedContentType(contentType: string | null) {
  if (!contentType) {
    return;
  }

  const normalized = contentType.toLowerCase();

  if (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml") ||
    normalized.includes("text/plain")
  ) {
    return;
  }

  throw new AnalyzerError(
    "UNSUPPORTED_CONTENT_TYPE",
    "The submitted URL did not return an HTML page.",
    415,
  );
}

async function readLimitedBody(
  response: Response,
  maxResponseBytes: number,
  signal: AbortSignal,
) {
  assertNotAborted(signal);

  const declaredLength = response.headers.get("content-length");

  if (
    declaredLength &&
    Number.parseInt(declaredLength, 10) > maxResponseBytes
  ) {
    throw new AnalyzerError(
      "RESPONSE_TOO_LARGE",
      "The website response is too large to analyze safely.",
      413,
    );
  }

  if (!response.body) {
    return { html: "", bytes: 0 };
  }

  const reader = response.body.getReader();
  const abortReader = () => {
    void reader.cancel(getAbortReason(signal)).catch(() => undefined);
  };
  const charset =
    response.headers
      .get("content-type")
      ?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]
      ?.toLowerCase() ?? "utf-8";
  if (
    !["utf-8", "utf8", "us-ascii", "iso-8859-1", "windows-1252"].includes(
      charset,
    )
  ) {
    throw new AnalyzerError(
      "CONTENT_NOT_VERIFIABLE",
      "We could not reliably read this page's text. No website recommendations were made.",
      422,
    );
  }
  const decoder = new TextDecoder(charset, { fatal: true });
  let bytes = 0;
  let html = "";

  signal.addEventListener("abort", abortReader, { once: true });

  try {
    while (true) {
      const { value, done } = await readChunkWithAbort(reader, signal);

      if (done) {
        break;
      }

      bytes += value.byteLength;

      if (bytes > maxResponseBytes) {
        throw new AnalyzerError(
          "RESPONSE_TOO_LARGE",
          "The website response is too large to analyze safely.",
          413,
        );
      }

      html += decoder.decode(value, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", abortReader);
    reader.releaseLock();
  }

  html += decoder.decode();

  return { html, bytes };
}

function createAbortError() {
  return new DOMException(
    "The website did not respond before the audit timeout.",
    "AbortError",
  );
}

function getAbortReason(signal: AbortSignal) {
  return signal.reason instanceof DOMException
    ? signal.reason
    : createAbortError();
}

function assertNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw getAbortReason(signal);
  }
}

function withAbortSignal<T>(operation: Promise<T>, signal: AbortSignal) {
  assertNotAborted(signal);

  return new Promise<T>((resolve, reject) => {
    const abortOperation = () => reject(getAbortReason(signal));

    signal.addEventListener("abort", abortOperation, { once: true });
    operation.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abortOperation);
    });
  });
}

function readChunkWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
) {
  assertNotAborted(signal);

  return new Promise<ReadableStreamReadResult<Uint8Array>>(
    (resolve, reject) => {
      const abortRead = () => reject(getAbortReason(signal));

      signal.addEventListener("abort", abortRead, { once: true });
      reader
        .read()
        .then(resolve, reject)
        .finally(() => {
          signal.removeEventListener("abort", abortRead);
        });
    },
  );
}
