import { describe, expect, it, vi } from "vitest";
import { execFile, execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { Script } from "node:vm";
import { bootstrapArgs, bootstrapStages, bootstrapFailureCategory } from "./bootstrap-diagnostic";
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
  it.each(bootstrapStages)("preserves every production Docker isolation argument: %s", stage => {
    const normal = workerContainerArgs(config, name, dir, 1001, 1001, 30);
    const probe = bootstrapArgs(config, name, dir, 1001, 1001, stage);
    expect(probe.slice(0, - (stage === "container_process" ? 1 : 3))).toEqual(normal.slice(0, -2));
    expect(probe).not.toContain("--privileged"); expect(probe).not.toContain("--no-sandbox");
    if (stage !== "container_process") expect(() => new Script(probe.at(-1)!)).not.toThrow();
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
          const result = await new Promise<{ code: number | null; output: string; overflow: boolean }>(resolve => {
            const child = spawn("/usr/bin/docker", ["--host", "unix:///var/run/docker.sock", "start", "--attach", "--interactive", container], { stdio: "pipe" });
            let output = "", overflow = false, settled = false;
            const timer = setTimeout(() => { child.kill("SIGKILL"); finish(null); }, 20000);
            const finish = (code: number | null) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ code, output, overflow }); };
            child.stdout.setEncoding("utf8"); child.stdout.on("data", (s: string) => { if (output.length + s.length > 128) { overflow = true; child.kill("SIGKILL"); } else output += s; });
            child.stderr.resume(); child.on("error", () => finish(null)); child.on("close", finish);
            child.stdin.on("error", () => {}); child.stdin.end("PING\n");
          });
          if (result.code !== 0 || result.overflow || result.output !== (stage === "container_process" ? "" : "OK\n")) {
            const code = Number.isInteger(result.code) && result.code! >= 0 && result.code! <= 255 ? result.code : "unknown";
            const category = bootstrapFailureCategory(result.output, result.overflow, result.code);
            throw new Error(`BOOTSTRAP_FAIL stage=${stage} category=${category} exit=${code}`);
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
