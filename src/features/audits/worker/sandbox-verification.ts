// Fixed reasons only: never return CDP responses, effective arguments or errors.
export const sandboxFailureReasons = [
  "missing_expected_process", "cdp_session_failed", "cmdline_read_failed",
  "cmdline_invalid", "forbidden_flag_detected", "expected_flag_missing",
  "browser_info_failed", "cdp_detach_failed",
] as const;
export type SandboxFailureReason = typeof sandboxFailureReasons[number];

interface BrowserEvidence {
  isConnected(): boolean;
  newBrowserCDPSession(): Promise<{
    send(method: string): Promise<unknown>;
    detach(): Promise<void>;
  }>;
}

// Self-contained: this exact function is also embedded in the offline probe
// and transpiled into the worker image. Its callers retain bounded deadlines.
export async function verifyBrowserSandbox(browser: BrowserEvidence): Promise<SandboxFailureReason | null> {
  let session: Awaited<ReturnType<BrowserEvidence["newBrowserCDPSession"]>> | undefined;
  let step: SandboxFailureReason = "missing_expected_process";
  let failure: SandboxFailureReason | null = null;
  try {
    if (!browser.isConnected()) throw new Error();
    step = "cdp_session_failed";
    session = await browser.newBrowserCDPSession();
    step = "cmdline_read_failed";
    // Chromium requires --enable-automation for this command. Both launch
    // sites supply it explicitly; the pinned Playwright defaults do not.
    const result = await session.send("Browser.getBrowserCommandLine") as { arguments?: unknown } | null;
    step = "cmdline_invalid";
    const args = result?.arguments;
    if (!Array.isArray(args) || args.length === 0 || args.length > 512 ||
        args.some(arg => typeof arg !== "string" || arg.length > 8192 || arg.includes("\0"))) throw new Error();
    const switches = args.map(arg => arg.split("=", 1)[0]);
    step = "forbidden_flag_detected";
    // Presence disables sandboxing even if a switch has a value such as =false.
    if (switches.includes("--no-sandbox") || switches.includes("--disable-setuid-sandbox")) throw new Error();
    step = "expected_flag_missing";
    if (!switches.includes("--remote-debugging-pipe") || !switches.includes("--enable-automation")) throw new Error();
    step = "browser_info_failed";
    const info = await session.send("Browser.getVersion") as { product?: unknown } | null;
    step = "missing_expected_process";
    if (!browser.isConnected() || typeof info?.product !== "string" ||
        !/^(?:HeadlessChrome|Chrome|Chromium)\/\d+(?:\.\d+){1,3}$/.test(info.product)) throw new Error();
  } catch {
    failure = step;
  } finally {
    if (session) {
      try { await session.detach(); }
      catch { failure ??= "cdp_detach_failed"; }
    }
  }
  return failure;
}
