import { sandboxFailureReasons } from "./sandbox-verification";

// Diagnostics cross an untrusted process boundary. Never retain the original
// error/cause, stderr, command arguments, socket token or arbitrary strings.
export const startupStages = ["host_configuration", "broker_setup", "container_creation", "container_inspection", "boundary_validation", "watchdog_initialization", "container_startup", "module_initialization", "network_probe", "chromium_launch", "sandbox_verification", "ready_handshake", "capture", "cleanup"] as const;
export const startupCategories = ["configuration_invalid", "io_failed", "process_start_failed", "command_failed", "timeout", "unexpected_exit", "boundary_mismatch", "invalid_output", "probe_failed", "chromium_launch_failed", "sandbox_verification_failed", "runtime_failed", "termination_unverified", "unknown"] as const;
export const boundaryChecks = ["network", "privileged", "readonly_root", "added_capabilities", "dropped_capabilities", "ipc", "memory", "swap", "cpu", "pids", "ports", "logging", "no_new_privileges", "seccomp", "devices", "mount_types", "broker_mount", "user", "none", ...sandboxFailureReasons] as const;
export type StartupStage = typeof startupStages[number];
export type StartupCategory = typeof startupCategories[number];
function member<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}
export class WorkerStartupError extends Error {
  readonly diagnostic: Readonly<{ stage: StartupStage; category: StartupCategory; exitCode: number | null; check: typeof boundaryChecks[number] }>;
  constructor(stage: unknown, category: unknown, exitCode: unknown = null, check: unknown = "none") {
    const diagnostic = Object.freeze({
      stage: member(startupStages, stage, "ready_handshake"),
      category: member(startupCategories, category, "unknown"),
      exitCode: typeof exitCode === "number" && Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255 ? exitCode : null,
      check: member(boundaryChecks, check, "none"),
    });
    super(`Worker failure ${JSON.stringify(diagnostic)}`);
    this.name = "WorkerStartupError";
    this.diagnostic = diagnostic;
  }
}
export function processStartupError(stage: StartupStage, error: unknown): WorkerStartupError {
  const data = error && typeof error === "object" ? error as { code?: unknown; killed?: unknown } : {};
  const category = data.code === "ENOENT" || data.code === "EACCES" ? "process_start_failed" :
    data.killed === true || data.code === "ETIMEDOUT" ? "timeout" : "command_failed";
  return new WorkerStartupError(stage, category, data.code);
}
export function runtimeStartupError(phase: unknown, check?: unknown): WorkerStartupError {
  switch (phase) {
    case "module_initialization": return new WorkerStartupError("module_initialization", "runtime_failed");
    case "configuration": return new WorkerStartupError("host_configuration", "configuration_invalid");
    case "network_probe": return new WorkerStartupError("network_probe", "probe_failed");
    case "browser_launch": return new WorkerStartupError("chromium_launch", "chromium_launch_failed");
    case "browser_boundary": return new WorkerStartupError("sandbox_verification", "sandbox_verification_failed", null, typeof check === "string" && sandboxFailureReasons.some(reason => reason === check) ? check : "none");
    case "capture": case "extraction": return new WorkerStartupError("capture", "runtime_failed");
    default: return new WorkerStartupError("ready_handshake", "invalid_output");
  }
}
