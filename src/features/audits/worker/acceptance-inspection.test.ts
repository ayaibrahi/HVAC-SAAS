import { describe, expect, it, vi } from "vitest";
import { AcceptanceInspectionError, classifyAcceptanceFailure, inspectReadyWorker, parseDockerTopCommands } from "./acceptance-inspection.test-helpers";
import { WorkerStartupError } from "./startup-diagnostics";

const id = "abcdef012345";
const listing = "  PID   COMMAND\n  123   node\n  456   chrome\n  789   chrome_crashpad\n";
const runner = () => vi.fn<(args: string[]) => string>().mockReturnValueOnce(id + "\n").mockReturnValueOnce("true\n").mockReturnValueOnce(listing);
function failure(fn: () => unknown): AcceptanceInspectionError {
  try { fn(); } catch (error) {
    expect(error).toBeInstanceOf(AcceptanceInspectionError);
    return error as AcceptanceInspectionError;
  }
  throw new Error("Expected inspection to fail");
}

describe("post-handshake acceptance inspection", () => {
  it("parses PID/command columns without treating PIDs or headers as commands", () => {
    expect(parseDockerTopCommands(listing)).toEqual(["node", "chrome", "chrome_crashpad"]);
    expect(parseDockerTopCommands("PID COMM\r\n 19 chromium\r\n")).toEqual(["chromium"]);
  });
  it.each(["", "COMMAND\nchrome", "PID COMMAND\n", "PID COMMAND\nabc chrome", "PID COMMAND\n0 chrome", "PID COMMAND\n1 node --chrome", "PID COMMAND\n1 chrome\ninvalid", "x".repeat(65537)])("rejects malformed or oversized listings %#", output => {
    expect(failure(() => parseDockerTopCommands(output)).diagnostic).toMatchObject({ stage: "process_listing", category: "invalid_output" });
  });
  it("requests Docker's required PID field and verifies a running Chromium", () => {
    const run = runner();
    expect(inspectReadyWorker(run)).toBe(id);
    expect(run.mock.calls).toEqual([
      [["ps", "-q", "--filter", "name=scanvoro-render-"]],
      [["inspect", "--format", "{{.State.Running}}", id]],
      [["top", id, "-eo", "pid,comm"]],
    ]);
  });
  it.each(["node", "chrome_crashpad", "not-chromium"])("does not accept %s as a live browser", command => {
    const run = vi.fn().mockReturnValueOnce(id).mockReturnValueOnce("true").mockReturnValueOnce(`PID COMMAND\n123 ${command}`);
    expect(failure(() => inspectReadyWorker(run)).diagnostic).toMatchObject({ stage: "process_verification", category: "chromium_missing" });
  });
  it("retains the precise Docker PID-field failure after the outer wrapper", () => {
    const run = vi.fn().mockReturnValueOnce(id).mockReturnValueOnce("true").mockImplementationOnce(() => {
      throw Object.assign(new Error("secret-token https://customer.invalid"), { status: 1, stderr: Buffer.from("Error response from daemon: Couldn't find PID field in ps output\npassword=secret-token") });
    });
    const error = failure(() => inspectReadyWorker(run));
    expect(classifyAcceptanceFailure(error, "worker_factory")).toBe(error);
    expect(error.diagnostic).toEqual({ stage: "process_listing", category: "pid_field_missing", exitCode: 1 });
    expect(error.message).toContain("Couldn't find PID field in ps output");
    expect(error.message + JSON.stringify(error)).not.toMatch(/secret-token|customer.invalid|password|ready_handshake/);
    expect(error.cause).toBeUndefined();
  });
  it.each([0, 1, 2])("preserves the failing inspection stage %i", index => {
    let calls = 0;
    const output = [id, "true", listing];
    const error = failure(() => inspectReadyWorker(() => {
      if (calls === index) throw { status: 2, stderr: "private arbitrary stderr" };
      return output[calls++];
    }));
    expect(error.diagnostic).toEqual({ stage: ["container_list", "container_inspection", "process_listing"][index], category: "command_failed", exitCode: 2 });
    expect(error.message).not.toContain("private");
  });
  it("rejects ambiguous containers and stopped containers", () => {
    expect(failure(() => inspectReadyWorker(() => `${id}\n${id}`)).diagnostic.category).toBe("container_count");
    expect(failure(() => inspectReadyWorker(vi.fn().mockReturnValueOnce(id).mockReturnValueOnce("false"))).diagnostic).toMatchObject({ stage: "container_inspection", category: "container_not_running" });
  });
  it("keeps genuine structured runtime errors unchanged", () => {
    const error = new WorkerStartupError("chromium_launch", "chromium_launch_failed", 1);
    expect(classifyAcceptanceFailure(error, "worker_factory")).toBe(error);
  });
  it.each([
    [{ code: "ENOENT" }, "process_start_failed"],
    [{ code: "EACCES" }, "process_start_failed"],
    [{ code: "ETIMEDOUT" }, "timeout"],
    [{ killed: true }, "timeout"],
    [{ status: -1, message: "password=secret", stderr: "https://customer.invalid" }, "unknown"],
  ])("classifies invocation failures without retaining raw details %#", (input, category) => {
    const error = classifyAcceptanceFailure(input, "process_listing") as AcceptanceInspectionError;
    expect(error.diagnostic).toMatchObject({ stage: "process_listing", category, exitCode: null });
    expect(error.message + JSON.stringify(error)).not.toMatch(/password|secret|customer/);
  });
});
