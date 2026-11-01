import { describe, expect, it } from "vitest";
import { inspect } from "node:util";
import { WorkerStartupError, processStartupError, runtimeStartupError, startupStages } from "./startup-diagnostics";

const sensitive = "Bearer synthetic-secret https://customer.invalid/private broker-token customer-page-content";
describe("bounded worker startup diagnostics", () => {
  it.each(startupStages)("preserves %s without retaining child output or credentials", stage => {
    const raw = Object.assign(new Error(sensitive), { code: 125, stderr: sensitive, stdout: sensitive, cmd: sensitive, cause: sensitive });
    const safe = processStartupError(stage, raw);
    expect(safe.diagnostic).toEqual({ stage, category: "command_failed", exitCode: 125, check: "none" });
    expect(safe).not.toHaveProperty("cause");
    expect(inspect(safe)).not.toContain(sensitive);
    expect(JSON.stringify(safe)).not.toContain(sensitive);
  });
  it.each([
    ["ENOENT", false, "process_start_failed"], ["EACCES", false, "process_start_failed"],
    ["ETIMEDOUT", false, "timeout"], [null, true, "timeout"], [sensitive, false, "command_failed"],
  ])("classifies process failures using only code and killed state: %s", (code, killed, category) => {
    expect(processStartupError("container_startup", { code, killed, message: sensitive }).diagnostic)
      .toEqual({ stage: "container_startup", category, exitCode: null, check: "none" });
  });
  it.each([-1, 256, 1.5, NaN, Infinity, "125", sensitive, { toString: () => sensitive }])("rejects non-exit-code values: %s", code => {
    expect(processStartupError("container_creation", { code }).diagnostic.exitCode).toBeNull();
  });
  it.each([
    ["configuration", "host_configuration", "configuration_invalid"],
    ["network_probe", "network_probe", "probe_failed"],
    ["browser_launch", "chromium_launch", "chromium_launch_failed"],
    ["browser_boundary", "sandbox_verification", "sandbox_verification_failed"],
    ["capture", "capture", "runtime_failed"], ["extraction", "capture", "runtime_failed"],
    [sensitive, "ready_handshake", "invalid_output"],
  ])("maps untrusted runtime phase %s to a fixed category", (phase, stage, category) => {
    expect(runtimeStartupError(phase).diagnostic).toEqual({ stage, category, exitCode: null, check: "none" });
  });
  it("rejects arbitrary diagnostic fields and never stringifies untrusted objects", () => {
    const bad = { toString() { throw new Error(sensitive); } };
    const safe = new WorkerStartupError(bad, sensitive.repeat(10000), sensitive, bad);
    expect(safe.diagnostic).toEqual({ stage: "ready_handshake", category: "unknown", exitCode: null, check: "none" });
    expect(safe.message.length).toBeLessThan(200);
    expect(Object.isFrozen(safe.diagnostic)).toBe(true);
  });
  it("preserves a fixed boundary check without leaking its observed value", () => {
    expect(new WorkerStartupError("boundary_validation", "boundary_mismatch", null, "seccomp").diagnostic.check).toBe("seccomp");
    expect(new WorkerStartupError("boundary_validation", "boundary_mismatch", null, sensitive).diagnostic.check).toBe("none");
  });
});
