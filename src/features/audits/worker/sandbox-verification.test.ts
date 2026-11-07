import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyBrowserSandbox, sandboxFailureReasons } from "./sandbox-verification";

const validArgs = ["/opt/chromium", "--enable-automation", "--remote-debugging-pipe"];
const privateError = new Error("Bearer private-token https://customer.invalid password=secret");
function fixture(args: unknown = validArgs) {
  const session = {
    send: vi.fn(async (method: string): Promise<unknown> => method === "Browser.getBrowserCommandLine" ?
      { arguments: args } : { product: "HeadlessChrome/156.0.8078.4" }),
    detach: vi.fn(async () => {}),
  };
  const browser = { isConnected: vi.fn(() => true), newBrowserCDPSession: vi.fn(async () => session) };
  return { browser, session };
}

describe("shared live-browser sandbox evidence verification", () => {
  it("uses a browser-level CDP session, effective arguments and a live browser response", async () => {
    const f = fixture();
    expect(await verifyBrowserSandbox(f.browser)).toBeNull();
    expect(f.browser.newBrowserCDPSession).toHaveBeenCalledOnce();
    expect(f.session.send.mock.calls).toEqual([["Browser.getBrowserCommandLine"], ["Browser.getVersion"]]);
    expect(f.browser.isConnected).toHaveBeenCalledTimes(2);
    expect(f.session.detach).toHaveBeenCalledOnce();
  });
  it("documents the pinned defaults' missing CDP prerequisite and both corrected launch sites", () => {
    const root = process.env.SCANVORO_TEST_PACKAGE_DIR ?? "experiments/rendered-audit";
    const pkg = join(root, "node_modules/playwright-core");
    expect(JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version).toBe("1.64.0");
    const bundle = readFileSync(join(pkg, "lib/coreBundle.js"), "utf8");
    const start = bundle.indexOf("chromiumSwitches = (options) => [");
    const end = bundle.indexOf("].filter(Boolean);", start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    expect(bundle.slice(start, end)).not.toContain("--enable-automation");
    for (const file of ["workers/rendered-audit/runtime.mjs", "src/features/audits/worker/bootstrap-diagnostic.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/args:\s*\['--enable-automation'/);
      expect(source).toMatch(/await verifyBrowserSandbox\((?:browser|b)\)/);
      expect(source).not.toContain("newCDPSession(");
    }
  });
  it("reproduces Chromium's command rejection when automation is not enabled", async () => {
    const f = fixture();
    let enabled = false;
    f.session.send.mockImplementation(async method => {
      if (method === "Browser.getBrowserCommandLine") {
        if (!enabled) throw new Error("Command line not returned because --enable-automation not set.");
        return { arguments: validArgs };
      }
      return { product: "HeadlessChrome/156.0.8078.4" };
    });
    expect(await verifyBrowserSandbox(f.browser)).toBe("cmdline_read_failed");
    enabled = true;
    expect(await verifyBrowserSandbox(f.browser)).toBeNull();
  });
  it.each(["--no-sandbox", "--disable-setuid-sandbox", "--no-sandbox=false", "--disable-setuid-sandbox=0"])("rejects effective disabling switch %s", async flag => {
    const f = fixture([...validArgs, flag]);
    expect(await verifyBrowserSandbox(f.browser)).toBe("forbidden_flag_detected");
    expect(f.session.detach).toHaveBeenCalledOnce();
  });
  it.each([undefined, null, {}, [], [12], ["x".repeat(8193)], ["a\0b"], Array(513).fill("x")].map(args => ({ args })))("rejects malformed or oversized command line %#", async ({ args }) => {
    const f = fixture(); f.session.send.mockResolvedValue({ arguments: args });
    expect(await verifyBrowserSandbox(f.browser)).toBe("cmdline_invalid");
  });
  it.each([[], ["--enable-automation"], ["--remote-debugging-pipe"]].map(args => ({ args })))("requires both effective expected flags %#", async ({ args }) => {
    expect(await verifyBrowserSandbox(fixture(["/opt/chromium", ...args]).browser)).toBe("expected_flag_missing");
  });
  it("does not confuse a path containing a flag with an actual switch", async () => {
    expect(await verifyBrowserSandbox(fixture([...validArgs, "--user-data-dir=/tmp/--no-sandbox"]).browser)).toBeNull();
  });
  it.each(["cdp_session_failed", "cmdline_read_failed", "browser_info_failed", "cdp_detach_failed"])("sanitizes %s and preserves the first error", async reason => {
    const f = fixture();
    if (reason === "cdp_session_failed") f.browser.newBrowserCDPSession.mockRejectedValue(privateError);
    if (reason === "cmdline_read_failed") f.session.send.mockRejectedValue(privateError);
    if (reason === "browser_info_failed") f.session.send.mockImplementation(async method => {
      if (method === "Browser.getVersion") throw privateError;
      return { arguments: validArgs };
    });
    f.session.detach.mockRejectedValue(privateError);
    expect(await verifyBrowserSandbox(f.browser)).toBe(reason);
  });
  it("rejects a disconnected or disappearing browser", async () => {
    const f = fixture(); f.browser.isConnected.mockReturnValue(false);
    expect(await verifyBrowserSandbox(f.browser)).toBe("missing_expected_process");
    expect(f.browser.newBrowserCDPSession).not.toHaveBeenCalled();
    f.browser.isConnected.mockReset().mockReturnValueOnce(true).mockReturnValue(false);
    expect(await verifyBrowserSandbox(f.browser)).toBe("missing_expected_process");
    expect(f.session.detach).toHaveBeenCalledOnce();
  });
  it.each([{}, null, { product: "unrelated-process" }, { product: 3 }])("rejects missing or unrelated browser info %#", async info => {
    const f = fixture();
    f.session.send.mockImplementation(async method => method === "Browser.getVersion" ? info : { arguments: validArgs });
    expect(await verifyBrowserSandbox(f.browser)).toBe("missing_expected_process");
  });
  it("packages the same verifier into the immutable image", () => {
    expect(readFileSync("workers/rendered-audit/run-linux-acceptance.sh", "utf8")).toContain('src/features/audits/worker/sandbox-verification.ts "$stage/"');
    const dockerfile = readFileSync("workers/rendered-audit/Dockerfile", "utf8");
    expect(dockerfile).toContain("COPY --chmod=0644 dom.ts sandbox-verification.ts runtime.mjs ./");
    expect(dockerfile).toContain("['dom','sandbox-verification']");
    expect(dockerfile).toContain("typeof s.verifyBrowserSandbox!=='function'");
    expect(sandboxFailureReasons).toHaveLength(8);
  });
});
