import { describe, expect, it, vi } from "vitest";
import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { Script } from "node:vm";
import { bootstrapArgs, bootstrapStages, bootstrapFailureCategory, bootstrapFailureDetail, chromiumFailureHint } from "./bootstrap-diagnostic";
import { workerContainerArgs } from "./linux-worker";

vi.mock("server-only", () => ({}));
const config = { imageId: `sha256:${"a".repeat(64)}`, seccompPath: "/tmp/policy" };
const name = "scanvoro-render-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", dir = "/tmp/scanvoro-render-fixture";
describe("bootstrap isolation", () => {
  it("only reports fixed import error categories and redacts arbitrary output", () => {
    for (const code of ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "FILE_NOT_FOUND", "PERMISSION_DENIED", "OPERATION_NOT_PERMITTED", "SYNTAX_ERROR", "REFERENCE_ERROR", "TYPE_ERROR", "WORKDIR_MISMATCH", "INVALID_FS_API", "ERR_INVALID_ARG_TYPE", "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_REQUIRE_ESM", "MISSING_EXPORT", "OTHER"])
      expect(bootstrapFailureCategory(`ERR:${code}\n`, false, 1)).toBe(code);
    expect(bootstrapFailureCategory("ERR:SECRET_TOKEN\n", false, 1)).toBe("exit_or_protocol");
    expect(bootstrapFailureCategory("ERR:PERMISSION_DENIED\nprivate-url", false, 1)).toBe("exit_or_protocol");
    expect(bootstrapFailureCategory("ERR:MODULE_NOT_FOUND\n", true, 1)).toBe("output_limit");
    expect(bootstrapFailureCategory("ERR:MODULE_NOT_FOUND\nCWD:/opt/worker\n", false, 1)).toBe("MODULE_NOT_FOUND");
    expect(bootstrapFailureDetail("ERR:MODULE_NOT_FOUND\nCWD:/opt/worker\n", "Bearer secret https://customer.invalid/path Cannot find module", false, 1)).toBe("cwd=/opt/worker stderr=bounded stderr_code=unavailable stderr_hint=module_resolution exception=MODULE_NOT_FOUND message=unavailable category=MODULE_NOT_FOUND");
    expect(bootstrapFailureDetail("", "", true, 1)).toBe("cwd=unverified stderr=truncated stderr_code=unavailable stderr_hint=empty exception=unavailable message=unavailable category=exit_or_protocol");
    expect(bootstrapFailureDetail("", "password=secret https://customer.invalid", false, 1)).not.toMatch(/password|secret|customer/);
  });
  it.each(["playwright_fs_api", "playwright_resolution", "playwright_file_access", "playwright_import"] as const)("executes the actual fixed %s probe against locked local dependencies", stage => {
    const probe = bootstrapArgs(config, name, dir, 1001, 1001, stage);
    // Tests can point at a fresh lockfile-only install rather than a developer's
    // existing node_modules. This setting is used only by this host-side test.
    const cwd = process.env.SCANVORO_TEST_PACKAGE_DIR ?? "experiments/rendered-audit";
    expect(execFileSync(process.execPath, ["-e", probe.at(-1)!], { cwd, timeout: 5000, encoding: "utf8" })).toBe("OK\n");
  });
  it("resolves Playwright through the ESM-compatible package boundary", () => {
    const probe = bootstrapArgs(config, name, dir, 1001, 1001, "playwright_resolution");
    const cwd = process.env.SCANVORO_TEST_PACKAGE_DIR ?? "experiments/rendered-audit";
    expect(execFileSync(process.execPath, ["--input-type=module", "-e", probe.at(-1)!], { cwd, timeout: 5000, encoding: "utf8" })).toBe("OK\n");
  });
  it("reports callback exceptions that the old then rejection callback lost", () => {
    const script = bootstrapArgs(config, name, dir, 1001, 1001, "playwright_resolution").at(-1)!
      .replace("'playwright-core'", "'scanvoro-intentionally-missing-fixture'");
    const old = script.replace(".catch(fail)", "")
      .replace("process.on('uncaughtException',fail);process.on('unhandledRejection',fail);", "");
    const before = spawnSync(process.execPath, ["-e", old], { encoding: "utf8", timeout: 5000 });
    expect(before.status).toBe(1);
    expect(before.stdout).toBe("");
    expect(bootstrapFailureCategory(before.stdout, false, before.status)).toBe("exit_or_protocol");
    const after = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 5000 });
    expect(after.status).toBe(1);
    expect(after.stdout).toBe("ERR:MODULE_NOT_FOUND\nCWD:unverified\nMSG:module_resolution\n");
    expect(bootstrapFailureCategory(after.stdout, false, after.status)).toBe("MODULE_NOT_FOUND");
    expect(after.stderr).toBe("CWD:unverified\n");
  });
  it("bounds and sanitizes unexpected stderr and protocol failures", () => {
    const detail = bootstrapFailureDetail("bad frame", "CWD:/opt/worker\nError [ERR_INVALID_PACKAGE_CONFIG]: Invalid package config secret-path token=private", false, 1);
    expect(detail).toContain("cwd=/opt/worker");
    expect(detail).toContain("stderr_code=ERR_INVALID_PACKAGE_CONFIG");
    expect(detail).toContain("stderr_hint=package_configuration");
    expect(detail).not.toMatch(/secret-path|token|private/);
    expect(bootstrapFailureDetail("", "x".repeat(4096) + "MODULE_NOT_FOUND", true, 1)).toContain("stderr_code=unavailable");
    expect(bootstrapFailureDetail("CWD:/opt/worker-secret", "", false, 1)).toContain("cwd=unverified");
  });
  it("makes public staged image files readable and checks imports as the non-root image user", () => {
    const dockerfile = readFileSync("workers/rendered-audit/Dockerfile", "utf8");
    expect(dockerfile).toContain("COPY --chmod=0644 package.json package-lock.json ./");
    expect(dockerfile).toContain("COPY --chmod=0644 dom.ts sandbox-verification.ts runtime.mjs ./");
    expect(dockerfile).toMatch(/USER pwuser\r?\nRUN node/);
  });
  it.each(bootstrapStages)("preserves every production Docker isolation argument: %s", stage => {
    const normal = workerContainerArgs(config, name, dir, 1001, 1001, 30);
    const probe = bootstrapArgs(config, name, dir, 1001, 1001, stage);
    expect(probe.slice(0, - (stage === "container_process" ? 1 : 3))).toEqual(normal.slice(0, -2));
    expect(probe).not.toContain("--privileged"); expect(probe).not.toContain("--no-sandbox");
    if (stage !== "container_process") expect(() => new Script(probe.at(-1)!)).not.toThrow();
  });
});


describe("Chromium bootstrap sub-stages (offline subprocess fixtures)", () => {
  // Execute the generated diagnostic itself; substitute only the browser and
  // filesystem interfaces. These tests never start Chromium or make a request.
  function fixture(failure: string, message = "fixture failure", cleanupFails = false, realRegistry = false) {
    let script = bootstrapArgs(config, name, dir, 1001, 1001, "chromium_sandbox").at(-1)!;
    const setup = `
      const failure=${JSON.stringify(failure)}, message=${JSON.stringify(message)};
      const hit=s=>{if(failure===s)throw Object.assign(new Error(message),{code:message.startsWith('ENOENT')?'ENOENT':message.startsWith('EACCES')?'EACCES':undefined})};
      const closed=[];
      const cleanup=s=>{closed.push(s);if(${cleanupFails}||failure==='cleanup')throw Error('cleanup fixture')};
      const fixtureChromium={launch:async options=>{
        hit('browser_launch');
        if(!options.chromiumSandbox||!options.args.includes('--enable-automation')||options.env.HOME!=='/tmp'||options.args.some(a=>/no-sandbox|disable-setuid/.test(a)))throw Error('launch options changed');
        return {isConnected:()=>true,newBrowserCDPSession:async()=>({send:async method=>{hit('sandbox_verify');return method==='Browser.getVersion'?{product:'HeadlessChrome/156.0.8078.4'}:{arguments:failure==='sandbox_flags'?['--no-sandbox']:['--enable-automation','--remote-debugging-pipe']}},detach:async()=>{}}),newContext:async()=>{hit('context_page');return {
          newPage:async()=>({}),newCDPSession:async()=>{throw Error('page CDP forbidden for browser verification')},
          close:async()=>cleanup('context')
        }},close:async()=>cleanup('browser')};
      }};
      const fixtureFs={constants:{R_OK:4,X_OK:1},accessSync:(p,flags)=>{if(typeof p!=='string'||flags!==5)throw Error('bad executable check');hit('executable_check')},mkdtempSync:()=>{hit('writable_tmp');return '/fixture'},writeFileSync:()=>{},unlinkSync:()=>{},rmdirSync:()=>{}};
      const fixtureModule={createRequire:()=>()=>({registry:{registry:{findExecutable:n=>{if(n!=='chromium-headless-shell')throw Error('wrong binary');return {executablePath:()=>'/fixture/shell'}}}}})};
      process.on('beforeExit',()=>{
        if((failure==='sandbox_verify'||failure==='sandbox_flags'||failure==='cleanup'||failure==='success')&&closed.join(',')!=='context,browser')process.exitCode=9;
        if(failure==='context_page'&&closed.join(',')!=='browser')process.exitCode=9;
      });
    `;
    script = script.replace("import('playwright-core')", "Promise.resolve().then(()=>{hit('module_import');return {chromium:fixtureChromium}})")
      .replace("import('node:fs')", "Promise.resolve(fixtureFs)");
    if (!realRegistry) script = script.replace("import('node:module')", "Promise.resolve(fixtureModule)");
    return spawnSync(process.execPath, ["-e", setup + script], {
      cwd: process.env.SCANVORO_TEST_PACKAGE_DIR ?? "experiments/rendered-audit",
      encoding: "utf8", timeout: 5000, maxBuffer: 8192,
    });
  }
  it.each(["module_import", "executable_check", "writable_tmp", "browser_launch", "context_page", "sandbox_verify", "cleanup"])("reports the first %s failure without replacing it during cleanup", stage => {
    const result = fixture(stage, "EACCES Bearer private-token https://customer.invalid secret=database-password", true);
    expect(result.status).toBe(1);
    expect(result.stdout.match(/ERR:/g)).toHaveLength(1);
    expect(result.stdout.length).toBeLessThanOrEqual(256);
    expect(bootstrapFailureCategory(result.stdout, false, result.status)).not.toBe("exit_or_protocol");
    expect(bootstrapFailureDetail(result.stdout, result.stderr, false, result.status)).toContain(`substage=${stage}`);
    expect(result.stdout + result.stderr).not.toMatch(/private-token|customer|database-password|Bearer/);
  });
  it("checks the exact locked headless-shell registry API without launching a host browser", () => {
    const result = fixture("success", "", false, true);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("OK\n");
  });
  it("only reports success after both browser and context cleanup", () => {
    const result = fixture("success");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("OK\n");
    expect(result.stderr).toContain("CHROMIUM_STAGE:cleanup");
    expect(fixture("cleanup").stdout).not.toContain("OK");
  });
  it("fails sandbox validation rather than allowing a no-sandbox browser", () => {
    const result = fixture("sandbox_flags");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("SUBSTAGE:sandbox_verify");
    expect(result.stdout).toContain("ERR:SANDBOX_VERIFICATION_FAILED");
    expect(result.stdout).toContain("HINT:forbidden_flag_detected");
  });
  it.each([
    ["sys_chroot failed", "chroot"], ["sandbox_host_linux.cc", "sandbox_host_linux"],
    ["Failed to move to new namespace", "namespace"], ["SIGSYS seccomp", "seccomp"],
    ["crashpad_handler", "crashpad"], ["/dev/shm no space", "shm"],
    ["zygote_host_impl_linux", "zygote"], ["ENOENT", "executable_missing"],
    ["EACCES", "permission"], ["EPERM", "operation_not_permitted"],
    ["EROFS", "readonly_filesystem"], ["ENOSPC", "storage_exhausted"],
    ["TargetClosedError", "target_closed"], ["TimeoutError", "timeout"],
  ])("classifies %s in the bounded tail without exposing the launch log", (token, hint) => {
    const result = fixture("browser_launch", "TargetClosedError " + "sensitive ".repeat(1000) + token + " https://customer.invalid token=private");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`HINT:${hint}\n`);
    expect(result.stdout + result.stderr).not.toMatch(/sensitive|customer|token=private/);
    expect(bootstrapFailureDetail(result.stdout, result.stderr, false, 1)).toContain(`chromium_hint=${hint}`);
  });
  it("bounds inspection and never passes through arbitrary error text", () => {
    expect(chromiumFailureHint("private".repeat(3000))).toBe("unclassified");
    expect(chromiumFailureHint("a".repeat(4096) + "seccomp" + "b".repeat(8192))).toBe("unclassified");
    expect(bootstrapFailureCategory("ERR:OTHER\nSUBSTAGE:https://private\nHINT:token\n", false, 1)).toBe("exit_or_protocol");
    const detail = bootstrapFailureDetail("", "CHROMIUM_STAGE:browser_launch\ncrashpad private-token https://customer.invalid", false, null);
    expect(detail).toContain("substage=browser_launch chromium_hint=crashpad");
    expect(detail).not.toMatch(/private-token|customer/);
  });
});

const enabled = process.platform === "linux" && process.env.GITHUB_ACTIONS === "true" && process.env.SCANVORO_BOOTSTRAP === "1";
const exec = promisify(execFile);
describe.skipIf(!enabled)("offline bootstrap diagnostic", () => {
  it("stops at the first failing stage under production container restrictions", async () => {
    const directory = await mkdtemp("/tmp/scanvoro-render-"); await chmod(directory, 0o700);
    const socket = join(directory, "broker.sock"), server = createServer(connection => connection.end("PONG\n"));
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(socket, resolve); });
    await chmod(socket, 0o600);
    try {
      for (const stage of bootstrapStages) {
        const container = `scanvoro-render-${randomUUID()}`;
        const args = bootstrapArgs({ imageId: process.env.SCANVORO_WORKER_IMAGE!, seccompPath: process.env.SCANVORO_WORKER_SECCOMP! }, container, directory, process.getuid!(), process.getgid!(), stage);
        let created = false;
        try {
          try { await exec("/usr/bin/docker", ["--host", "unix:///var/run/docker.sock", ...args], { timeout: 10000, maxBuffer: 4096 }); created = true; }
          catch { throw new Error(`BOOTSTRAP_FAIL stage=${stage} category=create_failed`); }
          const result = await new Promise<{ code: number | null; output: string; overflow: boolean; stderr: string; stderrOverflow: boolean }>(resolve => {
            const child = spawn("/usr/bin/docker", ["--host", "unix:///var/run/docker.sock", "start", "--attach", "--interactive", container], { stdio: "pipe" });
            let output = "", stderr = "", overflow = false, stderrOverflow = false, settled = false;
            const timer = setTimeout(() => { child.kill("SIGKILL"); finish(null); }, 20000);
            const finish = (code: number | null) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ code, output, overflow, stderr, stderrOverflow }); };
            child.stdout.setEncoding("utf8"); child.stdout.on("data", (s: string) => { if (output.length + s.length > 256) { overflow = true; child.kill("SIGKILL"); } else output += s; });
            child.stderr.setEncoding("utf8"); child.stderr.on("data", (s: string) => { if (stderr.length + s.length > 4096) { stderr += s.slice(0, 4096 - stderr.length); stderrOverflow = true; } else stderr += s; });
            child.on("error", () => finish(null)); child.on("close", finish);
            child.stdin.on("error", () => {}); child.stdin.end("PING\n");
          });
          if (result.code !== 0 || result.overflow || result.output !== (stage === "container_process" ? "" : "OK\n")) {
            const code = Number.isInteger(result.code) && result.code! >= 0 && result.code! <= 255 ? result.code : "unknown";
            const category = bootstrapFailureCategory(result.output, result.overflow, result.code);
            const detail = bootstrapFailureDetail(result.output, result.stderr, result.stderrOverflow, result.code);
            throw new Error(`BOOTSTRAP_FAIL stage=${stage} category=${category} exit=${code} ${detail}`);
          }
          console.log(`BOOTSTRAP_PASS stage=${stage}`);
        } finally {
          if (created) { try { await exec("/usr/bin/docker", ["--host", "unix:///var/run/docker.sock", "rm", "-f", "-v", container], { timeout: 5000, maxBuffer: 4096 }); } catch { throw new Error("BOOTSTRAP_FAIL stage=cleanup category=termination_unverified"); } }
        }
      }
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  }, 180000);
});
