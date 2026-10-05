import { describe, expect, it } from "vitest";
import { playbookMetadataSchema } from "@/lib/validation/playbooks";

describe("playbookMetadataSchema", () => {
  it("accepts supported vertical playbook keys and semantic versions", () => {
    expect(
      playbookMetadataSchema.parse({
        verticalKey: "hvac",
        playbookVersion: "1.0.0",
      }),
    ).toEqual({
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
    });

    expect(
      playbookMetadataSchema.parse({
        verticalKey: "plumbing",
        playbookVersion: "2.3.4",
      }).verticalKey,
    ).toBe("plumbing");
  });

  it("rejects unsupported vertical playbook keys", () => {
    expect(
      playbookMetadataSchema.safeParse({
        verticalKey: "restaurants",
        playbookVersion: "1.0.0",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid playbook versions", () => {
    expect(
      playbookMetadataSchema.safeParse({
        verticalKey: "hvac",
        playbookVersion: "v1",
      }).success,
    ).toBe(false);
  });
});
