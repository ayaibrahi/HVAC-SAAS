import { describe, expect, it } from "vitest";
import { assertProspectBelongsToAgency } from "@/features/audits/authorization";
import type { Prospect } from "@/domain/prospects/types";

const prospect: Prospect = {
  id: "prospect-1",
  agencyId: "agency-1",
  businessName: "Example HVAC",
  websiteUrl: "https://example.com",
  contactName: null,
  contactEmail: null,
  notes: null,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

describe("assertProspectBelongsToAgency", () => {
  it("allows matching agency ownership", () => {
    expect(() => assertProspectBelongsToAgency(prospect, "agency-1")).not.toThrow();
  });

  it("rejects cross-tenant prospect access", () => {
    expect(() => assertProspectBelongsToAgency(prospect, "agency-2")).toThrow(
      "Prospect not found.",
    );
  });

  it("rejects missing prospects", () => {
    expect(() => assertProspectBelongsToAgency(null, "agency-1")).toThrow(
      "Prospect not found.",
    );
  });
});
