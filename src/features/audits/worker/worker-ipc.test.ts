import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { mkdtemp, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkerFrameReader } from "./worker-ipc";

function fixture() {
  const failure = vi.fn(), frame = vi.fn(), events = new EventEmitter();
  const reader = createWorkerFrameReader({ stage: () => "ready_handshake", frame, failure });
  // The controller deliberately has no exit handler: close follows stdout drain.
  events.on("data", value => reader.data(value)); events.on("close", value => reader.close(value));
  return { reader, failure, frame, events };
}
describe("worker startup IPC", () => {
  it("retains a failure delivered after exit and before close", () => {
    const f = fixture(); f.events.emit("exit", 1); f.events.emit("data", '{"failure":"network_probe"}\n'); f.events.emit("close", 1);
    expect(f.failure).toHaveBeenCalledOnce(); expect(f.failure.mock.calls[0][0].diagnostic.stage).toBe("network_probe");
  });
  it("reports close without a frame", () => {
    const f = fixture(); f.events.emit("close", 1);
    expect(f.failure.mock.calls[0][0].diagnostic).toMatchObject({ category: "unexpected_exit", exitCode: 1 });
  });
  it.each(["{broken}\n", "x".repeat(132001), '{"failure":"network_probe"'])("rejects malformed, oversized or truncated output", chunk => {
    const f = fixture(); f.events.emit("data", chunk); f.events.emit("close", 1);
    expect(f.failure).toHaveBeenCalledOnce(); expect(f.failure.mock.calls[0][0].diagnostic.category).toBe("invalid_output");
  });
  it("reports a bounded startup timeout", () => {
    vi.useFakeTimers(); try {
      const f = fixture(); setTimeout(() => f.reader.timeout(), 15000); vi.advanceTimersByTime(15000);
      expect(f.failure.mock.calls[0][0].diagnostic.category).toBe("timeout");
    } finally { vi.useRealTimers(); }
  });
  it("keeps the first failure across repeated concurrent events", () => {
    const f = fixture(); f.events.emit("data", '{"failure":"browser_launch"}\n'); f.reader.timeout(); f.events.emit("close", 1); f.events.emit("close", 2);
    expect(f.failure).toHaveBeenCalledOnce(); expect(f.failure.mock.calls[0][0].diagnostic.stage).toBe("chromium_launch");
  });
  it("redacts arbitrary fields and customer data in a failure frame", () => {
    const f = fixture(); const secret = "token-secret https://customer.invalid/private stderr-password";
    f.events.emit("data", JSON.stringify({ failure: secret, stderr: secret }) + "\n");
    expect(JSON.stringify(f.failure.mock.calls)).not.toContain(secret);
    expect(f.failure.mock.calls[0][0].diagnostic.category).toBe("invalid_output");
  });
  it("flushes a single sanitized module-initialization failure in a real subprocess", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scanvoro-ipc-"));
    try {
      const runtime = join(dir, "runtime.mjs"); await copyFile("workers/rendered-audit/runtime.mjs", runtime);
      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(resolve => {
        execFile(process.execPath, [runtime], { timeout: 3000, maxBuffer: 4096 }, (error, stdout, stderr) => resolve({ code: typeof error?.code === "number" ? error.code : null, stdout, stderr }));
      });
      expect(result.code).toBe(1); expect(result.stdout).toBe('{"failure":"module_initialization"}\n'); expect(result.stderr).toBe("");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
