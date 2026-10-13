import { describe, expect, it } from "vitest";
import { getProductConfig } from "@/config/product";

describe("replaceable Scanvoro branding", () => {
  it("uses Scanvoro without an environment override", () => {
    expect(getProductConfig().name).toBe("Scanvoro");
    expect(getProductConfig("  ").name).toBe("Scanvoro");
    expect(getProductConfig().tagline).toBe(
      "From website scan to sales proposal.",
    );
  });
  it("preserves the existing trimmed deployment override", () =>
    expect(getProductConfig(" Agency workspace ").name).toBe(
      "Agency workspace",
    ));
  it("keeps public positioning independent of the current HVAC playbook", () =>
    expect(JSON.stringify(getProductConfig())).not.toMatch(
      /HVAC|guarantee|revenue/i,
    ));
});
