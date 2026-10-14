import { afterEach, describe, expect, it, vi } from "vitest";
import { requestWorkspaceAction } from "./workspace-request";
afterEach(() => vi.unstubAllGlobals());
describe("workspace requests use existing same-origin contracts", () => {
  it.each([
    ['{"data":[]}', "empty"],
    ['{"data":[{"id":"existing"}]}', "done"],
    ["{}", "unknown"],
    ['{"data":null}', "unknown"],
    ["not json", "unknown"],
  ])(
    "reports empty findings only from a successful structured response %s",
    async (body, result) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status: 201 })),
      );
      expect(
        await requestWorkspaceAction(
          "/api/audits/id/opportunities",
          "POST",
          true,
        ),
      ).toBe(result);
    },
  );
  it.each([
    [201, "done"],
    [401, "session"],
    [403, "error"],
    [404, "error"],
    [409, "busy"],
    [429, "limit"],
    [500, "error"],
  ] as const)("maps HTTP %s to safe %s feedback", async (status, result) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("private internal message", { status }));
    vi.stubGlobal("fetch", fetch);
    expect(
      await requestWorkspaceAction("/api/prospects/id/audits", "POST"),
    ).toBe(result);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/prospects/id/audits", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
    });
  });
  it("does not automatically retry uncertain mutations", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(new Error("sensitive network detail"));
    vi.stubGlobal("fetch", fetch);
    expect(await requestWorkspaceAction("/api/prospects/id", "DELETE")).toBe(
      "unknown",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
