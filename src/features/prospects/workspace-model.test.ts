import { describe, expect, it } from "vitest";
import {
  parseProspectSearch,
  prospectSearchFilter,
  prospectsListHref,
  scanIsActive,
} from "./workspace-model";

describe("bounded prospect browsing", () => {
  it.each([undefined, "no", "0", "-1", "1.5", "10001", ["2"]])(
    "defaults invalid page %j",
    (page) => {
      expect(parseProspectSearch({ page }).page).toBe(1);
    },
  );
  it("caps search text and preserves valid pages", () => {
    expect(parseProspectSearch({ q: "x".repeat(101), page: "3" })).toEqual({
      query: "x".repeat(100),
      page: 3,
    });
    expect(parseProspectSearch({ q: ["unsafe"] }).query).toBe("");
  });
  it("quotes adversarial filters inside a single PostgREST string per column", () => {
    const query = 'name"),agency_id.neq.a,(business_name.eq."';
    const pattern = JSON.stringify(
      '%name"),agency id.neq.a,(business name.eq."%',
    );
    expect(prospectSearchFilter(query)).toBe(
      `business_name.ilike.${pattern},website_url.ilike.${pattern}`,
    );
    expect(prospectSearchFilter("%_*\\")).toBe(
      'business_name.ilike."%    %",website_url.ilike."%    %"',
    );
  });
  it("encodes search parameters, omits page one, and does not build arbitrary routes", () => {
    expect(prospectsListHref(2, "A&B")).toBe(
      "/dashboard/prospects?q=A%26B&page=2",
    );
    expect(prospectsListHref(1, "")).toBe("/dashboard/prospects");
  });
  it.each(["pending", "running", "completed", "failed"] as const)(
    "recognizes %s without starting a scan",
    (status) => {
      expect(
        scanIsActive({ id: "scan", status, createdAt: "", completedAt: null }),
      ).toBe(["pending", "running"].includes(status));
      expect(scanIsActive(null)).toBe(false);
    },
  );
});
