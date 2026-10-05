import { describe, expect, it } from "vitest";
import { transitionAuditStatus } from "@/features/audits/audit-state";

describe("transitionAuditStatus", () => {
  it("allows pending to running to completed", () => {
    const running = transitionAuditStatus("pending", "running");
    const completed = transitionAuditStatus(running, "completed");

    expect(completed).toBe("completed");
  });

  it("allows pending to running to failed", () => {
    const running = transitionAuditStatus("pending", "running");
    const failed = transitionAuditStatus(running, "failed");

    expect(failed).toBe("failed");
  });

  it("rejects invalid lifecycle jumps", () => {
    expect(() => transitionAuditStatus("pending", "completed")).toThrow(
      "Audit cannot move from pending to completed.",
    );
    expect(() => transitionAuditStatus("completed", "running")).toThrow(
      "Audit cannot move from completed to running.",
    );
  });
});
