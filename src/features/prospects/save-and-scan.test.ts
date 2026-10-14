import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAndScanBusiness } from "./save-and-scan";
import { requestWorkspaceAction } from "./workspace-request";
vi.mock("./workspace-request", () => ({ requestWorkspaceAction: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.clearAllMocks());
describe("explicit save then scan", () => {
  it("scans only the confirmed saved ID and never invokes AI", async () => {
    const create = vi.fn().mockResolvedValue({ savedId: id });
    vi.mocked(requestWorkspaceAction).mockResolvedValue("done");
    const form = new FormData();
    form.set("agencyId", "foreign");
    expect(await saveAndScanBusiness(create, {}, form)).toEqual({
      savedId: id,
      scanResult: "done",
    });
    expect(create).toHaveBeenCalledExactlyOnceWith({}, form);
    expect(requestWorkspaceAction).toHaveBeenCalledExactlyOnceWith(
      "/api/prospects/" + id + "/audits",
      "POST",
    );
  });
  it.each(["error", "unknown", "limit", "busy", "session"] as const)(
    "preserves the saved business on scan result %s and never re-creates it on retry",
    async (scanResult) => {
      const create = vi.fn().mockResolvedValue({ savedId: id });
      vi.mocked(requestWorkspaceAction).mockResolvedValue(scanResult);
      const result = await saveAndScanBusiness(create, {}, new FormData());
      expect(result).toEqual({ savedId: id, scanResult });
      expect(await saveAndScanBusiness(create, result, new FormData())).toEqual(
        result,
      );
      expect(create).toHaveBeenCalledTimes(1);
      expect(requestWorkspaceAction).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { error: "invalid" },
    { error: "session" },
    { error: "agency" },
    { error: "save" },
    { duplicate: { id, name: "Existing" } },
  ])("does not scan on unsuccessful creation %j", async (response) => {
    const create = vi.fn().mockResolvedValue(response);
    expect(await saveAndScanBusiness(create, {}, new FormData())).toEqual(
      response,
    );
    expect(requestWorkspaceAction).not.toHaveBeenCalled();
  });
  it("blocks form retries after uncertain saving and discards internal errors", async () => {
    const create = vi.fn().mockRejectedValue(new Error("private internals"));
    const result = await saveAndScanBusiness(create, {}, new FormData());
    expect(result).toEqual({ saveUncertain: true });
    await saveAndScanBusiness(create, result, new FormData());
    expect(create).toHaveBeenCalledTimes(1);
    expect(requestWorkspaceAction).not.toHaveBeenCalled();
  });
  it("does not construct a request from malformed saved identifiers", async () => {
    const create = vi.fn().mockResolvedValue({ savedId: "../../other" });
    expect(await saveAndScanBusiness(create, {}, new FormData())).toEqual({
      saveUncertain: true,
    });
    expect(requestWorkspaceAction).not.toHaveBeenCalled();
  });
});
