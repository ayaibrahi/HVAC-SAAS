import { describe, expect, it } from "vitest";
import { AnalyzerError } from "@/features/audits/analyzer/errors";
import {
  isUnsafeIpAddress,
  validateRedirectTarget,
  validateSafeHttpUrl,
  type ResolveHostname,
} from "@/features/audits/analyzer/url-safety";

const publicResolver: ResolveHostname = async () => [
  { address: "93.184.216.34", family: 4 },
];

describe("validateSafeHttpUrl", () => {
  it("accepts public HTTP and HTTPS URLs", async () => {
    await expect(
      validateSafeHttpUrl("https://example.com/path?x=1", publicResolver),
    ).resolves.toMatchObject({
      url: expect.objectContaining({
        protocol: "https:",
        hostname: "example.com",
      }),
    });
  });

  it.each([
    "http://example.com",
    "https://example.com",
    "http://example.com:80/path",
    "https://example.com:443/path",
  ])("allows standard scheme ports for %s", async (url) => {
    await expect(validateSafeHttpUrl(url, publicResolver)).resolves.toMatchObject({
      url: expect.objectContaining({
        hostname: "example.com",
      }),
    });
  });

  it.each([
    "http://example.com:25",
    "http://example.com:22",
    "http://example.com:23",
    "http://example.com:53",
    "http://example.com:110",
    "http://example.com:143",
    "http://example.com:445",
    "http://example.com:6379",
    "https://example.com:9200",
    "http://example.com:27017",
    "http://example.com:65535",
    "https://example.com:80",
    "http://93.184.216.34:6379",
  ])("rejects non-standard destination port %s", async (url) => {
    await expect(validateSafeHttpUrl(url, publicResolver)).rejects.toMatchObject({
      code: "UNSAFE_PORT",
    });
  });

  it("rejects unsupported protocols and credentialed URLs", async () => {
    await expect(
      validateSafeHttpUrl("file:///etc/passwd", publicResolver),
    ).rejects.toBeInstanceOf(AnalyzerError);

    await expect(
      validateSafeHttpUrl("https://user:pass@example.com", publicResolver),
    ).rejects.toMatchObject({ code: "URL_CREDENTIALS_NOT_ALLOWED" });
  });

  it("rejects local and private network destinations", async () => {
    await expect(validateSafeHttpUrl("http://localhost", publicResolver)).rejects.toMatchObject({
      code: "UNSAFE_HOSTNAME",
    });

    await expect(validateSafeHttpUrl("http://127.0.0.1", publicResolver)).rejects.toMatchObject({
      code: "UNSAFE_IP_ADDRESS",
    });

    await expect(
      validateSafeHttpUrl("http://169.254.169.254/latest/meta-data", publicResolver),
    ).rejects.toMatchObject({ code: "UNSAFE_IP_ADDRESS" });

    await expect(
      validateSafeHttpUrl("https://example.com", async () => [
        { address: "10.0.0.25", family: 4 },
      ]),
    ).rejects.toMatchObject({ code: "UNSAFE_IP_ADDRESS" });
  });

  it.each([
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[::ffff:0a00:1]/",
    "http://[::ffff:192.168.1.1]/",
    "http://[::ffff:c0a8:101]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[::ffff:a9fe:a9fe]/",
  ])("rejects IPv4-mapped IPv6 literal %s", async (url) => {
    await expect(validateSafeHttpUrl(url, publicResolver)).rejects.toMatchObject({
      code: "UNSAFE_IP_ADDRESS",
    });
  });

  it.each([
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
  ])("rejects alternate loopback URL formatting %s", async (url) => {
    await expect(validateSafeHttpUrl(url, publicResolver)).rejects.toMatchObject({
      code: "UNSAFE_IP_ADDRESS",
    });
  });
});

describe("isUnsafeIpAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
    "::ffff:0a00:1",
    "::ffff:a9fe:a9fe",
    "::7f00:1",
    "::ffff:0:7f00:1",
    "64:ff9b::7f00:1",
    "2002:0a00:0001::",
  ])("classifies %s as unsafe", (address) => {
    expect(isUnsafeIpAddress(address)).toBe(true);
  });
});

describe("validateRedirectTarget", () => {
  it("allows safe relative redirects", async () => {
    await expect(
      validateRedirectTarget("https://example.com/start", "/next?step=1", publicResolver),
    ).resolves.toMatchObject({
      url: expect.objectContaining({
        pathname: "/next",
        search: "?step=1",
      }),
    });
  });

  it("rejects protocol-relative redirects to unsafe hosts", async () => {
    await expect(
      validateRedirectTarget("https://example.com/start", "//127.0.0.1/admin", publicResolver),
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
  });

  it("rejects redirects to internal hostnames", async () => {
    await expect(
      validateRedirectTarget("https://example.com/start", "http://localhost/admin", publicResolver),
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
  });

  it("rejects redirects to non-standard ports before DNS trust is inherited", async () => {
    await expect(
      validateRedirectTarget(
        "https://example.com/start",
        "http://public.example:6379/",
        publicResolver,
      ),
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
  });
});
