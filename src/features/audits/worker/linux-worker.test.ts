import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { workerContainerArgs, workerPolicyHash, linuxWorkerFactory } from "./linux-worker";

vi.mock("server-only", () => ({}));
const name = "scanvoro-render-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const config = { imageId: `sha256:${"a".repeat(64)}`, seccompPath: "/tmp/policy.json" };
describe("isolated worker security configuration", () => {
  it("permits only AF_UNIX sockets and denies io_uring/legacy socketcall bypasses", () => {
    const raw = readFileSync("workers/rendered-audit/seccomp.json", "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(raw).digest("hex")).toBe(workerPolicyHash);
    const policy = JSON.parse(raw);
    expect(policy.defaultAction).toBe("SCMP_ACT_ERRNO");
    const allow = policy.syscalls.filter((rule: { action: string }) => rule.action === "SCMP_ACT_ALLOW");
    for (const operation of ["socket", "socketpair"]) {
      const rules = allow.filter((r: { names: string[] }) => r.names.includes(operation));
      expect(rules).toHaveLength(1);
      expect(rules[0].args).toEqual([{ index: 0, value: 1, op: "SCMP_CMP_EQ" }]);
    }
    for (const operation of ["socketcall", "io_uring_setup", "io_uring_enter", "io_uring_register"])
      expect(allow.some((r: { names: string[] }) => r.names.includes(operation))).toBe(false);
  });
  it("uses a secret-free, non-root, read-only, resource-bounded container and socket-only bind", () => {
    const args = workerContainerArgs(config, name, "/tmp/scanvoro-render-test", 1001, 1001, 90);
    expect(args).toEqual(expect.arrayContaining(["--network", "none", "--cap-drop", "ALL", "1001:1001", "--read-only", "--memory", "2g", "--cpus", "1", "--pids-limit", "256"]));
    expect(args.filter(a => a.startsWith("type=bind"))).toEqual(["type=bind,source=/tmp/scanvoro-render-test,target=/run/scanvoro,readonly"]);
    expect(args).not.toEqual(expect.arrayContaining(["--privileged", "--cap-add", "--env", "--publish", "--no-sandbox"]));
    expect(args.slice(-6)).toEqual(["timeout", "--signal=TERM", "--kill-after=2s", "90s", "node", "/opt/worker/runtime.mjs"]);
  });
  it("rejects mutable image tags, root, unbounded lifetime and arbitrary mount locations", () => {
    expect(() => workerContainerArgs({ ...config, imageId: "latest" }, name, "/tmp/scanvoro-render-test", 1001, 1001, 90)).toThrow();
    expect(() => workerContainerArgs(config, name, "/tmp/scanvoro-render-test", 0, 0, 90)).toThrow();
    expect(() => workerContainerArgs(config, name, "/tmp/scanvoro-render-test", 1001, 1001, 120)).toThrow();
    expect(() => workerContainerArgs(config, name, "/home/customer", 1001, 1001, 90)).toThrow();
  });
  it.skipIf(process.platform === "linux")("does not start a worker on an unsupported host", async () => {
    await expect(linuxWorkerFactory(config)({ entryUrl: "https://example.com/", egress: { get: vi.fn() }, deadlineAt: Date.now() + 110000 })).rejects.toThrow("Linux isolated host required");
  });
});
