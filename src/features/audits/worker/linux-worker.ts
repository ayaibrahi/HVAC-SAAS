import "server-only";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import type { RenderedAuditWorker } from "../rendered/contract";
import { openWorkerBroker } from "./socket-broker";
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

async function command(args: string[], timeout = 4000) {
  try { return (await exec(docker, [...daemon, ...args], { env: childEnv, encoding: "utf8", timeout, maxBuffer: 65536 })).stdout.trim(); }
  catch { throw new Error("Worker control failed"); }
}

export function linuxWorkerFactory(config: LinuxWorkerConfig) {
  return async (input: { entryUrl: string; egress: ReturnType<typeof createPinnedEgressBroker>; deadlineAt: number }): Promise<RenderedAuditWorker> => {
    if (process.platform !== "linux" || !process.getuid || process.getuid() < 1000 || tmpdir() !== "/tmp") throw new Error("Linux isolated host required");
    const policy = (await readFile(config.seccompPath, "utf8")).replace(/\r\n/g, "\n");
    if (createHash("sha256").update(policy).digest("hex") !== workerPolicyHash) throw new Error("Worker policy mismatch");
    const directory = await mkdtemp("/tmp/scanvoro-render-");
    await chmod(directory, 0o700);
    const name = `scanvoro-render-${randomUUID()}`;
    let broker: Awaited<ReturnType<typeof openWorkerBroker>> | undefined;
    let child: ChildProcessWithoutNullStreams | undefined, reaper: ReturnType<typeof spawn> | undefined, created = false, closed: Promise<void> | undefined;
    let pending: { resolve: (value: unknown) => void; reject: (error: Error) => void } | undefined;
    let sequence = 0, buffer = "", stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const fail = () => { stopped = true; pending?.reject(new Error("Worker stopped")); pending = undefined; };
    const close = () => closed ??= (async () => {
      if (timer) clearTimeout(timer);
      fail();
      // Do not remove the socket or report success if process termination is uncertain.
      if (created) {
        try { await command(["rm", "-f", "-v", name], 2000); }
        catch { if (await command(["ps", "-aq", "--filter", `name=^/${name}$`], 1000)) throw new Error("Worker termination unverified"); }
        if (await command(["ps", "-aq", "--filter", `name=^/${name}$`], 1000)) throw new Error("Worker termination unverified");
      }
      child?.kill("SIGKILL");
      reaper?.kill("SIGTERM");
      await broker?.close();
      if (resolve(directory).startsWith("/tmp/scanvoro-render-")) await rm(directory, { recursive: true });
    })();
    try {
      broker = await openWorkerBroker(join(directory, "broker.sock"), input.egress);
      const seconds = Math.min(100, Math.floor((input.deadlineAt - Date.now() - 10000) / 1000));
      const args = workerContainerArgs(config, name, directory, process.getuid(), process.getgid!(), seconds);
      // Mark before create: an ambiguous CLI failure must still attempt termination.
      created = true;
      await command(args);
      // Independent trusted-host watchdog survives a controller crash. Neither
      // its PID namespace nor the Docker socket is exposed to Chromium.
      reaper = spawn(process.execPath, ["-e", `const {execFile}=require('node:child_process'); setTimeout(()=>execFile('/usr/bin/docker',['--host','unix:///var/run/docker.sock','rm','-f','-v',process.argv[1]],{timeout:4000,env:{PATH:'/usr/bin:/bin'}},()=>{}),Math.max(1,Number(process.argv[2])-Date.now()));`, name, String(input.deadlineAt - 5000)],
        { detached: true, stdio: "ignore", env: childEnv });
      await new Promise<void>((resolveReaper, reject) => { reaper!.once("spawn", resolveReaper); reaper!.once("error", () => reject(new Error("Worker watchdog unavailable"))); });
      reaper.unref();
      const [inspection] = JSON.parse(await command(["inspect", name]));
      const host = inspection.HostConfig;
      // Docker sends/stores the policy JSON, not necessarily the source pathname.
      const installedPolicy = host.SecurityOpt.find((value: string) => value.startsWith("seccomp="))?.slice(8);
      const policyMatches = installedPolicy === config.seccompPath ||
        (installedPolicy?.startsWith("{") && isDeepStrictEqual(JSON.parse(installedPolicy), JSON.parse(policy)));
      const binds = inspection.Mounts.filter((mount: { Type: string }) => mount.Type === "bind");
      if (host.NetworkMode !== "none" || host.Privileged || !host.ReadonlyRootfs || host.CapAdd?.length ||
          host.CapDrop?.join() !== "ALL" || host.IpcMode !== "private" || host.Memory !== 2147483648 ||
          host.MemorySwap !== 2147483648 || host.NanoCpus !== 1000000000 || host.PidsLimit !== 256 || host.PortBindings && Object.keys(host.PortBindings).length ||
          host.LogConfig.Type !== "none" || !host.SecurityOpt.some((s: string) => s === "no-new-privileges=true" || s === "no-new-privileges") ||
          !policyMatches || host.Devices?.length ||
          inspection.Mounts.some((m: { Type: string; Destination: string }) => m.Type !== "bind" && !(m.Type === "tmpfs" && m.Destination === "/tmp")) ||
          binds.length !== 1 || binds[0].Source !== directory || binds[0].Destination !== "/run/scanvoro" || binds[0].RW ||
          inspection.Config.User !== `${process.getuid()}:${process.getgid!()}`) throw new Error("Worker boundary mismatch");
      child = spawn(docker, [...daemon, "start", "--attach", "--interactive", name], { env: childEnv, stdio: "pipe" });
      child.stderr.resume(); // Never propagate browser diagnostics or page content.
      child.on("error", fail); child.on("exit", fail);
      child.stdin.on("error", fail); child.stdout.on("error", fail);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 132000 || buffer.indexOf("\n") !== buffer.lastIndexOf("\n")) { fail(); void close().catch(() => {}); return; }
        const newline = buffer.indexOf("\n");
        if (newline < 0) return;
        try {
          const response = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
          if (["configuration", "network_probe", "browser_launch", "browser_boundary", "capture", "extraction"].includes(response.failure)) {
            pending?.reject(new Error(`Worker ${response.failure} failed`)); pending = undefined; stopped = true; return;
          }
          if (!pending || (sequence === 0 ? response.ready !== true || response.networkDenied !== true || response.sandboxEnabled !== true : response.id !== sequence || typeof response.result !== "string")) throw new Error("Bad worker output");
          const waiter = pending; pending = undefined; waiter.resolve(sequence === 0 ? undefined : response.result);
        } catch { fail(); void close().catch(() => {}); }
      });
      timer = setTimeout(() => { fail(); void close().catch(() => {}); }, Math.max(1, input.deadlineAt - Date.now() - 5000));
      const ready = new Promise<void>((resolveReady, reject) => { pending = { resolve: () => resolveReady(), reject }; });
      child.stdin.write(JSON.stringify({ entryUrl: input.entryUrl, token: broker.token }) + "\n");
      let startup: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([ready, new Promise<never>((_, reject) => { startup = setTimeout(() => reject(new Error("Worker startup timeout")), 15000); })]); }
      finally { if (startup) clearTimeout(startup); }
      return { close, async capture(request) {
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
      await close();
      if (error instanceof Error && /^Worker (configuration|network_probe|browser_launch|browser_boundary|capture|extraction) failed$/.test(error.message)) throw error;
      throw new Error("Worker startup failed");
    }
  };
}
