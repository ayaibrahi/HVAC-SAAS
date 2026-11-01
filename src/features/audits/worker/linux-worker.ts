import "server-only";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import type { RenderedAuditWorker } from "../rendered/contract";
import { openWorkerBroker } from "./socket-broker";
import { WorkerStartupError, processStartupError, type StartupStage, type StartupCategory, type boundaryChecks } from "./startup-diagnostics";
import { createWorkerFrameReader } from "./worker-ipc";
import type { createPinnedEgressBroker } from "./pinned-egress";

const exec = promisify(execFile);
const docker = "/usr/bin/docker";
const daemon = ["--host", "unix:///var/run/docker.sock"];
const childEnv = { PATH: "/usr/local/bin:/usr/bin:/bin", NODE_ENV: "production" as const };
export const workerPolicyHash = "c9a7929446ee81df362ad4bd63ed700b40942e9e37ee2616008c02d4f2f99a47";

// These are operator-controlled immutable deployment artifacts, never request fields.
export type LinuxWorkerConfig = { imageId: string; seccompPath: string };
export function workerContainerArgs(config: LinuxWorkerConfig, name: string, directory: string, uid: number, gid: number, seconds: number) {
  if (!/^sha256:[a-f0-9]{64}$/.test(config.imageId) || !/^scanvoro-render-[a-f0-9-]{36}$/.test(name) ||
      uid < 1000 || gid < 0 || !Number.isInteger(seconds) || seconds < 1 || seconds > 100 ||
      !config.seccompPath.startsWith("/") || !directory.startsWith("/tmp/scanvoro-render-" ) || directory.includes(",")) throw new Error("Invalid worker configuration");
  return ["create", "--name", name, "--network", "none", "--ipc", "private", "--init", "--interactive",
    "--user", `${uid}:${gid}`, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
    "--security-opt", `seccomp=${config.seccompPath}`, "--memory", "2g", "--memory-swap", "2g", "--cpus", "1",
    "--pids-limit", "256", "--shm-size", "256m", "--ulimit", "nofile=1024:1024", "--ulimit", "core=0",
    "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=512m,mode=1777", "--log-driver", "none",
    "--mount", `type=bind,source=${directory},target=/run/scanvoro,readonly`, config.imageId,
    "timeout", "--signal=TERM", "--kill-after=2s", `${seconds}s`, "node", "/opt/worker/runtime.mjs"];
}

async function command(args: string[], timeout = 4000, stage: StartupStage = "cleanup") {
  try { return (await exec(docker, [...daemon, ...args], { env: childEnv, encoding: "utf8", timeout, maxBuffer: 65536 })).stdout.trim(); }
  catch (error) { throw processStartupError(stage, error); }
}

export function linuxWorkerFactory(config: LinuxWorkerConfig) {
  return async (input: { entryUrl: string; egress: ReturnType<typeof createPinnedEgressBroker>; deadlineAt: number }): Promise<RenderedAuditWorker> => {
    let stage: StartupStage = "host_configuration";
    let category: StartupCategory = "configuration_invalid";
    let policy: string;
    let directory: string;
    try {
      if (process.platform !== "linux" || !process.getuid || process.getuid() < 1000 || tmpdir() !== "/tmp") throw new Error();
      policy = (await readFile(config.seccompPath, "utf8")).replace(/\r\n/g, "\n");
      if (createHash("sha256").update(policy).digest("hex") !== workerPolicyHash) throw new Error();
      stage = "broker_setup"; category = "io_failed";
      directory = await mkdtemp("/tmp/scanvoro-render-");
      await chmod(directory, 0o700);
    } catch { throw new WorkerStartupError(stage, category); }
    const name = `scanvoro-render-${randomUUID()}`;
    let broker: Awaited<ReturnType<typeof openWorkerBroker>> | undefined;
    let child: ChildProcessWithoutNullStreams | undefined, reaper: ReturnType<typeof spawn> | undefined, created = false, closed: Promise<void> | undefined;
    let pending: { resolve: (value: unknown) => void; reject: (error: Error) => void } | undefined;
    let sequence = 0, stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (error = new WorkerStartupError(stage, "unexpected_exit")) => { stopped = true; pending?.reject(error); pending = undefined; };
    const close = () => closed ??= (async () => {
      if (timer) clearTimeout(timer);
      fail();
      // Do not remove the socket or report success if process termination is uncertain.
      if (created) {
        try { await command(["rm", "-f", "-v", name], 2000); }
        catch { if (await command(["ps", "-aq", "--filter", `name=^/${name}$`], 1000)) throw new WorkerStartupError("cleanup", "termination_unverified"); }
        if (await command(["ps", "-aq", "--filter", `name=^/${name}$`], 1000)) throw new WorkerStartupError("cleanup", "termination_unverified");
      }
      child?.kill("SIGKILL");
      reaper?.kill("SIGTERM");
      await broker?.close();
      if (resolve(directory).startsWith("/tmp/scanvoro-render-")) await rm(directory, { recursive: true });
    })();
    try {
      broker = await openWorkerBroker(join(directory, "broker.sock"), input.egress);
      stage = "host_configuration"; category = "configuration_invalid";
      const seconds = Math.min(100, Math.floor((input.deadlineAt - Date.now() - 10000) / 1000));
      const args = workerContainerArgs(config, name, directory, process.getuid(), process.getgid!(), seconds);
      // Mark before create: an ambiguous CLI failure must still attempt termination.
      created = true;
      stage = "container_creation";
      await command(args, 4000, stage);
      // Independent trusted-host watchdog survives a controller crash. Neither
      // its PID namespace nor the Docker socket is exposed to Chromium.
      stage = "watchdog_initialization"; category = "process_start_failed";
      reaper = spawn(process.execPath, ["-e", `const {execFile}=require('node:child_process'); setTimeout(()=>execFile('/usr/bin/docker',['--host','unix:///var/run/docker.sock','rm','-f','-v',process.argv[1]],{timeout:4000,env:{PATH:'/usr/bin:/bin'}},()=>{}),Math.max(1,Number(process.argv[2])-Date.now()));`, name, String(input.deadlineAt - 5000)],
        { detached: true, stdio: "ignore", env: childEnv });
      await new Promise<void>((resolveReaper, reject) => { reaper!.once("spawn", resolveReaper); reaper!.once("error", error => reject(processStartupError("watchdog_initialization", error))); });
      reaper.unref();
      stage = "container_inspection"; category = "invalid_output";
      const [inspection] = JSON.parse(await command(["inspect", name], 4000, stage));
      stage = "boundary_validation"; category = "boundary_mismatch";
      const host = inspection.HostConfig;
      // Docker sends/stores the policy JSON, not necessarily the source pathname.
      const installedPolicy = host.SecurityOpt.find((value: string) => value.startsWith("seccomp="))?.slice(8);
      const policyMatches = installedPolicy === config.seccompPath ||
        (installedPolicy?.startsWith("{") && isDeepStrictEqual(JSON.parse(installedPolicy), JSON.parse(policy)));
      const binds = inspection.Mounts.filter((mount: { Type: string }) => mount.Type === "bind");
      // Same fail-closed predicates as before, now with fixed field identifiers.
      const checks: [typeof boundaryChecks[number], boolean][] = [
        ["network", host.NetworkMode === "none"], ["privileged", !host.Privileged], ["readonly_root", !!host.ReadonlyRootfs],
        ["added_capabilities", !host.CapAdd?.length], ["dropped_capabilities", host.CapDrop?.join() === "ALL"],
        ["ipc", host.IpcMode === "private"], ["memory", host.Memory === 2147483648], ["swap", host.MemorySwap === 2147483648],
        ["cpu", host.NanoCpus === 1000000000], ["pids", host.PidsLimit === 256],
        ["ports", !host.PortBindings || Object.keys(host.PortBindings).length === 0], ["logging", host.LogConfig.Type === "none"],
        ["no_new_privileges", host.SecurityOpt.some((s: string) => s === "no-new-privileges=true" || s === "no-new-privileges")],
        ["seccomp", !!policyMatches], ["devices", !host.Devices?.length],
        ["mount_types", !inspection.Mounts.some((m: { Type: string; Destination: string }) => m.Type !== "bind" && !(m.Type === "tmpfs" && m.Destination === "/tmp"))],
        ["broker_mount", binds.length === 1 && binds[0].Source === directory && binds[0].Destination === "/run/scanvoro" && !binds[0].RW],
        ["user", inspection.Config.User === `${process.getuid!()}:${process.getgid!()}`],
      ];
      for (const [check, pass] of checks) if (!pass) throw new WorkerStartupError(stage, category, null, check);
      stage = "container_startup"; category = "process_start_failed";
      child = spawn(docker, [...daemon, "start", "--attach", "--interactive", name], { env: childEnv, stdio: "pipe" });
      child.stderr.resume(); // Never propagate browser diagnostics or page content.
      child.on("error", error => fail(processStartupError("container_startup", error)));
      // exit may precede stdout; only close means all stdio has drained.
      const reader = createWorkerFrameReader({
        stage: () => stage,
        failure: error => { fail(error); },
        frame: value => {
          const response = value as { ready?: unknown; networkDenied?: unknown; sandboxEnabled?: unknown; id?: unknown; result?: unknown };
          if (!pending || (sequence === 0 ? response.ready !== true || response.networkDenied !== true || response.sandboxEnabled !== true : response.id !== sequence || typeof response.result !== "string")) throw new Error();
          const waiter = pending; pending = undefined; waiter.resolve(sequence === 0 ? undefined : response.result);
        },
      });
      child.on("close", code => reader.close(code));
      // A broken stdin can race a structured startup failure on stdout.
      child.stdin.on("error", () => { if (sequence !== 0) fail(new WorkerStartupError(stage, "io_failed")); });
      child.stdout.on("error", () => fail(new WorkerStartupError(stage, "io_failed")));
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => reader.data(chunk));
      timer = setTimeout(() => { fail(); void close().catch(() => {}); }, Math.max(1, input.deadlineAt - Date.now() - 5000));
      stage = "ready_handshake"; category = "invalid_output";
      const ready = new Promise<void>((resolveReady, reject) => { pending = { resolve: () => resolveReady(), reject }; });
      child.stdin.write(JSON.stringify({ entryUrl: input.entryUrl, token: broker.token }) + "\n");
      let startup: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([ready, new Promise<never>((_, reject) => { startup = setTimeout(() => { reader.timeout(); reject(new WorkerStartupError("ready_handshake", "timeout")); }, 15000); })]); }
      finally { if (startup) clearTimeout(startup); }
      return { close, async capture(request) {
        stage = "capture";
        if (closed || stopped || pending || request.signal.aborted || sequence >= 10) throw new Error("Worker unavailable");
        const abort = () => { fail(); void close().catch(() => {}); };
        request.signal.addEventListener("abort", abort, { once: true });
        const captureTimer = setTimeout(abort, 8000);
        try {
          const response = new Promise<unknown>((resolveResponse, reject) => { pending = { resolve: resolveResponse, reject }; });
          child!.stdin.write(JSON.stringify({ id: ++sequence, url: request.url, viewport: request.viewport }) + "\n");
          return await response;
        } finally { clearTimeout(captureTimer); request.signal.removeEventListener("abort", abort); }
      } };
    } catch (error) {
      const failure = error instanceof WorkerStartupError ? error : new WorkerStartupError(stage, category);
      try { await close(); }
      catch { throw new WorkerStartupError("cleanup", "termination_unverified"); }
      throw failure;
    }
  };
}
