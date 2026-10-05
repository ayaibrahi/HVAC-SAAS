import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AnalyzerError } from "@/features/audits/analyzer/errors";

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>;

export type SafeUrlResult = {
  url: URL;
  resolvedAddresses: ResolvedAddress[];
};

const blockedHostnameSuffixes = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
];

const allowedPortsByProtocol = {
  "http:": 80,
  "https:": 443,
} as const;

export const defaultResolveHostname: ResolveHostname = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });

  return addresses.map((address) => ({
    address: address.address,
    family: address.family === 6 ? 6 : 4,
  }));
};

export async function validateSafeHttpUrl(
  rawUrl: string,
  resolveHostname: ResolveHostname = defaultResolveHostname,
): Promise<SafeUrlResult> {
  const url = parseHttpUrl(rawUrl);
  const hostname = normalizeHostname(url.hostname);

  assertSafeHostname(hostname);

  const literalIpFamily = isIP(hostname);
  const resolvedAddresses: ResolvedAddress[] =
    literalIpFamily === 0
      ? await resolvePublicHostname(hostname, resolveHostname)
      : [{ address: hostname, family: literalIpFamily === 6 ? 6 : 4 }];

  for (const resolvedAddress of resolvedAddresses) {
    if (isUnsafeIpAddress(resolvedAddress.address)) {
      throw new AnalyzerError(
        "UNSAFE_IP_ADDRESS",
        "The submitted URL resolves to an internal or otherwise unsafe address.",
      );
    }
  }

  url.hash = "";

  return { url, resolvedAddresses };
}

export async function validateRedirectTarget(
  currentUrl: string,
  locationHeader: string | null,
  resolveHostname: ResolveHostname = defaultResolveHostname,
) {
  if (!locationHeader || locationHeader.trim().length === 0) {
    throw new AnalyzerError(
      "INVALID_REDIRECT",
      "The website returned an invalid redirect.",
      502,
    );
  }

  let redirectedUrl: URL;

  try {
    redirectedUrl = new URL(locationHeader, currentUrl);
  } catch {
    throw new AnalyzerError(
      "INVALID_REDIRECT",
      "The website returned an invalid redirect.",
      502,
    );
  }

  try {
    return await validateSafeHttpUrl(redirectedUrl.toString(), resolveHostname);
  } catch (error) {
    if (error instanceof AnalyzerError) {
      throw new AnalyzerError(
        "UNSAFE_REDIRECT",
        "The website redirected to an unsafe destination.",
        502,
      );
    }

    throw error;
  }
}

function parseHttpUrl(rawUrl: string) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new AnalyzerError("INVALID_URL", "Enter a valid website URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AnalyzerError(
      "UNSUPPORTED_PROTOCOL",
      "Only public HTTP and HTTPS websites can be analyzed.",
    );
  }

  if (url.username || url.password) {
    throw new AnalyzerError(
      "URL_CREDENTIALS_NOT_ALLOWED",
      "Website URLs must not include usernames or passwords.",
    );
  }

  assertSafePort(url);

  return url;
}

function assertSafePort(url: URL) {
  const defaultPort = allowedPortsByProtocol[url.protocol as keyof typeof allowedPortsByProtocol];

  if (!url.port) {
    return;
  }

  const port = Number.parseInt(url.port, 10);

  if (port !== defaultPort) {
    throw new AnalyzerError(
      "UNSAFE_PORT",
      "Only standard public HTTP and HTTPS ports can be analyzed.",
    );
  }
}

export function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

function assertSafeHostname(hostname: string) {
  if (!hostname) {
    throw new AnalyzerError("UNSAFE_HOSTNAME", "The submitted URL has an unsafe host.");
  }

  if (hostname === "localhost" || hostname === "metadata.google.internal") {
    throw new AnalyzerError("UNSAFE_HOSTNAME", "Local or internal hosts cannot be analyzed.");
  }

  if (blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new AnalyzerError("UNSAFE_HOSTNAME", "Local or internal hosts cannot be analyzed.");
  }

  if (isIP(hostname) === 0 && !hostname.includes(".")) {
    throw new AnalyzerError("UNSAFE_HOSTNAME", "Internal hostnames cannot be analyzed.");
  }
}

async function resolvePublicHostname(
  hostname: string,
  resolveHostname: ResolveHostname,
) {
  try {
    const addresses = await resolveHostname(hostname);

    if (addresses.length === 0) {
      throw new AnalyzerError(
        "DNS_LOOKUP_FAILED",
        "The submitted website host could not be resolved.",
      );
    }

    return addresses;
  } catch (error) {
    if (error instanceof AnalyzerError) {
      throw error;
    }

    throw new AnalyzerError(
      "DNS_LOOKUP_FAILED",
      "The submitted website host could not be resolved.",
    );
  }
}

export function isUnsafeIpAddress(address: string) {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);

  if (family === 4) {
    return isUnsafeIpv4(normalized);
  }

  if (family === 6) {
    return isUnsafeIpv6(normalized);
  }

  return true;
}

function isUnsafeIpv4(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second, third, fourth] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224 ||
    (first === 255 && second === 255 && third === 255 && fourth === 255)
  );
}

function isUnsafeIpv6(address: string) {
  const normalized = address.toLowerCase();
  const hextets = parseIpv6Hextets(normalized);

  if (!hextets) {
    return true;
  }

  if (isAllZeroes(hextets) || isLoopbackIpv6(hextets)) {
    return true;
  }

  const embeddedIpv4 = extractEmbeddedIpv4(hextets);

  if (embeddedIpv4) {
    return isUnsafeIpv4(embeddedIpv4);
  }

  const firstHextet = hextets[0];

  if (Number.isNaN(firstHextet)) {
    return true;
  }

  return (
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xff00) === 0xff00
  );
}

function parseIpv6Hextets(address: string) {
  if (address.includes("%")) {
    return null;
  }

  const normalizedAddress = replaceDottedIpv4Tail(address);
  const compressedParts = normalizedAddress.split("::");

  if (compressedParts.length > 2) {
    return null;
  }

  const left = parseHextetList(compressedParts[0]);
  const right =
    compressedParts.length === 2 ? parseHextetList(compressedParts[1]) : [];

  if (!left || !right) {
    return null;
  }

  if (compressedParts.length === 1) {
    return left.length === 8 ? left : null;
  }

  const missingZeroes = 8 - left.length - right.length;

  if (missingZeroes < 1) {
    return null;
  }

  return [...left, ...Array.from({ length: missingZeroes }, () => 0), ...right];
}

function replaceDottedIpv4Tail(address: string) {
  const dottedIpv4 = address.match(/(^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[2];

  if (!dottedIpv4) {
    return address;
  }

  const parts = parseIpv4Parts(dottedIpv4);

  if (!parts) {
    return address;
  }

  const firstHextet = (parts[0] << 8) + parts[1];
  const secondHextet = (parts[2] << 8) + parts[3];

  return `${address.slice(0, address.length - dottedIpv4.length)}${firstHextet.toString(
    16,
  )}:${secondHextet.toString(16)}`;
}

function parseHextetList(value: string) {
  if (value.length === 0) {
    return [];
  }

  const hextets = value.split(":");

  return hextets.every((part) => /^[0-9a-f]{1,4}$/i.test(part))
    ? hextets.map((part) => Number.parseInt(part, 16))
    : null;
}

function parseIpv4Parts(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts as [number, number, number, number];
}

function isAllZeroes(hextets: number[]) {
  return hextets.every((hextet) => hextet === 0);
}

function isLoopbackIpv6(hextets: number[]) {
  return hextets.slice(0, 7).every((hextet) => hextet === 0) && hextets[7] === 1;
}

function extractEmbeddedIpv4(hextets: number[]) {
  if (isIpv4MappedIpv6(hextets) || isIpv4CompatibleIpv6(hextets)) {
    return ipv4FromHextets(hextets[6], hextets[7]);
  }

  if (isIpv4TranslatedIpv6(hextets) || isNat64Ipv6(hextets)) {
    return ipv4FromHextets(hextets[6], hextets[7]);
  }

  if (is6to4Ipv6(hextets)) {
    return ipv4FromHextets(hextets[1], hextets[2]);
  }

  return null;
}

function isIpv4MappedIpv6(hextets: number[]) {
  return (
    hextets.slice(0, 5).every((hextet) => hextet === 0) &&
    hextets[5] === 0xffff
  );
}

function isIpv4CompatibleIpv6(hextets: number[]) {
  return (
    hextets.slice(0, 6).every((hextet) => hextet === 0) &&
    (hextets[6] !== 0 || hextets[7] !== 0)
  );
}

function isIpv4TranslatedIpv6(hextets: number[]) {
  return (
    hextets.slice(0, 4).every((hextet) => hextet === 0) &&
    hextets[4] === 0xffff &&
    hextets[5] === 0
  );
}

function isNat64Ipv6(hextets: number[]) {
  const isWellKnownNat64 =
    hextets[0] === 0x64 &&
    hextets[1] === 0xff9b &&
    hextets.slice(2, 6).every((hextet) => hextet === 0);
  const isLocalUseNat64 =
    hextets[0] === 0x64 &&
    hextets[1] === 0xff9b &&
    hextets[2] === 1 &&
    hextets.slice(3, 6).every((hextet) => hextet === 0);

  return isWellKnownNat64 || isLocalUseNat64;
}

function is6to4Ipv6(hextets: number[]) {
  return hextets[0] === 0x2002;
}

function ipv4FromHextets(first: number, second: number) {
  return [
    (first >> 8) & 255,
    first & 255,
    (second >> 8) & 255,
    second & 255,
  ].join(".");
}
