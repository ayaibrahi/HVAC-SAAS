import { WorkerStartupError, runtimeStartupError, type StartupStage } from "./startup-diagnostics";

// A single bounded line at a time; no untrusted data is retained in errors.
export function createWorkerFrameReader(callbacks: {
  stage: () => StartupStage;
  frame: (value: unknown) => void;
  failure: (error: WorkerStartupError) => void;
}) {
  let buffer = "", failed = false;
  function fail(error: WorkerStartupError) {
    if (failed) return;
    failed = true;
    buffer = "";
    callbacks.failure(error);
  }
  return {
    data(chunk: string) {
      if (failed) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 132000 || buffer.indexOf("\n") !== buffer.lastIndexOf("\n")) {
        fail(new WorkerStartupError(callbacks.stage(), "invalid_output")); return;
      }
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      try {
        const value: unknown = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        if (Object.hasOwn(value, "failure")) {
          fail(runtimeStartupError((value as { failure: unknown }).failure, (value as { check?: unknown }).check)); return;
        }
        callbacks.frame(value);
      } catch { fail(new WorkerStartupError(callbacks.stage(), "invalid_output")); }
    },
    close(code: number | null) {
      fail(new WorkerStartupError(callbacks.stage(), buffer ? "invalid_output" : "unexpected_exit", code));
    },
    timeout() { fail(new WorkerStartupError("ready_handshake", "timeout")); },
  };
}
