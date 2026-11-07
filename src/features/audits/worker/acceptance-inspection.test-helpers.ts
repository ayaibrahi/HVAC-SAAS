import { execFileSync } from "node:child_process";
import { WorkerStartupError } from "./startup-diagnostics";

// Test-only inspection after the production worker's ready handshake. Never
// attach raw child-process errors (which include arguments/stdout/stderr).
type InspectionStage = "worker_factory" | "container_list" | "container_inspection" | "process_listing" | "process_verification";
const messages = {
  pid_field_missing: "Couldn't find PID field in ps output",
  command_failed: "Docker inspection command failed",
  process_start_failed: "Docker inspection command could not start",
  timeout: "Docker inspection command timed out",
  invalid_output: "Invalid Docker PID/command listing",
  container_count: "Expected exactly one worker container",
  container_not_running: "Worker container is not running",
  chromium_missing: "No live Chromium command found",
  unknown: "Unclassified acceptance helper failure (details withheld)",
} as const;
export class AcceptanceInspectionError extends Error {
  readonly diagnostic;
  constructor(stage: InspectionStage, category: keyof typeof messages, exitCode: number | null = null) {
    const diagnostic = Object.freeze({ stage, category, exitCode });
    super(`Acceptance inspection ${JSON.stringify(diagnostic)}: ${messages[category]}`);
    this.name = "AcceptanceInspectionError";
    this.diagnostic = diagnostic;
  }
}

export function classifyAcceptanceFailure(error: unknown, stage: InspectionStage): Error {
  if (error instanceof WorkerStartupError || error instanceof AcceptanceInspectionError) return error;
  const data = error && typeof error === "object" ? error as { status?: unknown; code?: unknown; killed?: unknown; stderr?: unknown } : {};
  const exitCode = typeof data.status === "number" && Number.isInteger(data.status) && data.status >= 0 && data.status <= 255 ? data.status : null;
  // Match a known harmless daemon message; never retain arbitrary stderr.
  const stderr = typeof data.stderr === "string" ? data.stderr.slice(0, 4096) : Buffer.isBuffer(data.stderr) ? data.stderr.subarray(0, 4096).toString() : "";
  const category = stderr.includes("Couldn't find PID field in ps output") ? "pid_field_missing" :
    data.code === "ENOENT" || data.code === "EACCES" ? "process_start_failed" :
    data.code === "ETIMEDOUT" || data.killed === true ? "timeout" :
    exitCode !== null ? "command_failed" : "unknown";
  return new AcceptanceInspectionError(stage, category, exitCode);
}

export function parseDockerTopCommands(output: string): string[] {
  const invalid = () => new AcceptanceInspectionError("process_listing", "invalid_output");
  if (output.length > 65536) throw invalid();
  const lines = output.trim().split(/\r?\n/);
  if (!/^\s*PID\s+(?:COMMAND|COMM)\s*$/.test(lines.shift() ?? "") || lines.length === 0) throw invalid();
  return lines.map(line => {
    const match = /^\s*([1-9]\d*)\s+([^\s\x00-\x1f]+)\s*$/.exec(line);
    if (!match || !Number.isSafeInteger(Number(match[1]))) throw invalid();
    return match[2];
  });
}

type DockerInspection = (args: string[]) => string;
const runDocker: DockerInspection = args => execFileSync("/usr/bin/docker", args, {
  encoding: "utf8", timeout: 5000, maxBuffer: 65536, stdio: ["ignore", "pipe", "pipe"],
});
export function inspectReadyWorker(run: DockerInspection = runDocker): string {
  let stage: InspectionStage = "container_list";
  try {
    const ids = run(["ps", "-q", "--filter", "name=scanvoro-render-"]).trim().split(/\r?\n/);
    if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/.test(ids[0])) throw new AcceptanceInspectionError(stage, "container_count");
    stage = "container_inspection";
    if (run(["inspect", "--format", "{{.State.Running}}", ids[0]]).trim() !== "true") throw new AcceptanceInspectionError(stage, "container_not_running");
    stage = "process_listing";
    const commands = parseDockerTopCommands(run(["top", ids[0], "-eo", "pid,comm"]));
    stage = "process_verification";
    if (!commands.some(command => /^(?:chrome|chromium|chromium-browser|chrome-headless(?:-shell)?|headless_shell)$/.test(command))) {
      throw new AcceptanceInspectionError(stage, "chromium_missing");
    }
    return ids[0];
  } catch (error) { throw classifyAcceptanceFailure(error, stage); }
}
