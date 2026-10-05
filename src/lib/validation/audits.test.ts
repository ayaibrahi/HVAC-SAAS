import { describe, expect, it } from "vitest";
import { auditStorageSchema } from "@/lib/validation/audits";

describe("auditStorageSchema", () => {
  it("accepts minimal pending audit metadata", () => {
    const result = auditStorageSchema.parse({
      normalizedSignals: {
        httpStatus: 200,
      },
    });

    expect(result.status).toBe("pending");
    expect(result.verticalKey).toBe("hvac");
    expect(result.playbookVersion).toBe("1.0.0");
    expect(result.signalSchemaVersion).toBe("1.0.0");
  });

  it("accepts failed audit state with safe error metadata", () => {
    const result = auditStorageSchema.parse({
      status: "failed",
      finalUrl: "https://example.com/final",
      errorCode: "FETCH_TIMEOUT",
      errorMessage: "The request timed out.",
      normalizedSignals: {},
      verticalKey: "roofing",
      playbookVersion: "1.2.0",
      signalSchemaVersion: "1.0.1",
    });

    expect(result.status).toBe("failed");
    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.errorCode).toBe("FETCH_TIMEOUT");
  });

  it("accepts running audit state", () => {
    expect(
      auditStorageSchema.parse({
        status: "running",
        normalizedSignals: {},
      }).status,
    ).toBe("running");
  });

  it("rejects unsupported status and invalid versions", () => {
    expect(
      auditStorageSchema.safeParse({
        status: "complete",
        normalizedSignals: {},
      }).success,
    ).toBe(false);

    expect(
      auditStorageSchema.safeParse({
        normalizedSignals: {},
        verticalKey: "hvac",
        playbookVersion: "latest",
      }).success,
    ).toBe(false);
  });
});
