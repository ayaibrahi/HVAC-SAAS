import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  saveWorkspaceProspect,
  createBusinessForScan,
} from "./workspace-actions";
import { createProspect, updateProspect } from "./data";
import { findMatchingProspect, getEditableProspect } from "./workspace-data";
import { AppError } from "@/lib/errors";
import type { Prospect } from "@/domain/prospects/types";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error("REDIRECT:" + path);
  }),
}));
vi.mock("./data", () => ({ createProspect: vi.fn(), updateProspect: vi.fn() }));
vi.mock("./workspace-data", () => ({
  findMatchingProspect: vi.fn(),
  getEditableProspect: vi.fn(),
}));
const id = "11111111-1111-4111-8111-111111111111";
const prospect: Prospect = {
  id,
  agencyId: "server-agency",
  businessName: "Example HVAC",
  websiteUrl: "https://example.com/",
  contactName: null,
  contactEmail: null,
  notes: null,
  createdAt: "",
  updatedAt: "",
};
function form() {
  const input = new FormData();
  input.set("businessName", "Example HVAC");
  input.set("websiteUrl", "example.com");
  return input;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findMatchingProspect).mockResolvedValue(null);
  vi.mocked(createProspect).mockResolvedValue(prospect);
  vi.mocked(updateProspect).mockResolvedValue(prospect);
  vi.mocked(getEditableProspect).mockResolvedValue(prospect);
});
describe("prospect workspace save", () => {
  it("returns only a confirmed owned ID for scanning, ignores forged previous state and retains duplicate checks", async () => {
    const input = form();
    input.set("agencyId", "other");
    expect(await createBusinessForScan({ savedId: "forged" }, input)).toEqual({
      savedId: id,
    });
    expect(createProspect).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createProspect).mock.calls[0][0]).not.toHaveProperty("agencyId");
    expect(redirect).not.toHaveBeenCalled();
    vi.mocked(findMatchingProspect).mockResolvedValue({ id, name: "Existing" });
    expect(await createBusinessForScan({}, input)).toEqual({
      duplicate: { id, name: "Existing" },
    });
    expect(createProspect).toHaveBeenCalledTimes(1);
  });
  it("validates inline without writing or looking up invalid input", async () => {
    expect(await saveWorkspaceProspect(null, {}, new FormData())).toEqual({
      error: "invalid",
      fields: ["businessName", "websiteUrl"],
    });
    expect(createProspect).not.toHaveBeenCalled();
    expect(findMatchingProspect).not.toHaveBeenCalled();
  });
  it("normalizes a URL and redirects successful creation outside the catch once", async () => {
    const input = form();
    input.set("agencyId", "victim");
    input.set("priority", "high");
    await expect(
      saveWorkspaceProspect(
        null,
        { duplicate: { id: "forged", name: "forged" } },
        input,
      ),
    ).rejects.toThrow("REDIRECT:/dashboard/prospects?prospect=" + id);
    expect(createProspect).toHaveBeenCalledTimes(1);
    expect(createProspect).toHaveBeenCalledWith({
      businessName: "Example HVAC",
      websiteUrl: "https://example.com/",
      contactName: undefined,
      contactEmail: undefined,
      notes: undefined,
    });
    expect(redirect).toHaveBeenCalledTimes(1);
  });
  it("warns without writing when the agency already has the page", async () => {
    vi.mocked(findMatchingProspect).mockResolvedValue({ id, name: "Existing" });
    expect(await saveWorkspaceProspect(null, {}, form())).toEqual({
      duplicate: { id, name: "Existing" },
    });
    expect(createProspect).not.toHaveBeenCalled();
  });
  it("rechecks duplicates and permits explicit intentional copies", async () => {
    vi.mocked(findMatchingProspect).mockResolvedValue({ id, name: "Existing" });
    const input = form();
    input.set("allowDuplicate", "yes");
    await expect(saveWorkspaceProspect(null, {}, input)).rejects.toThrow(
      "REDIRECT",
    );
    expect(findMatchingProspect).toHaveBeenCalledExactlyOnceWith(
      "https://example.com/",
    );
    expect(createProspect).toHaveBeenCalledTimes(1);
  });
  it("retains update authorization and redirects success once", async () => {
    await expect(saveWorkspaceProspect(id, {}, form())).rejects.toThrow(
      "REDIRECT",
    );
    expect(getEditableProspect).toHaveBeenCalledExactlyOnceWith(id);
    expect(updateProspect).toHaveBeenCalledTimes(1);
    expect(createProspect).not.toHaveBeenCalled();
  });
  it("does not update inaccessible records", async () => {
    vi.mocked(getEditableProspect).mockResolvedValue(null);
    expect(await saveWorkspaceProspect(id, {}, form())).toEqual({
      error: "save",
    });
    expect(updateProspect).not.toHaveBeenCalled();
  });
  it("rejects malformed edit identifiers", async () => {
    expect(await saveWorkspaceProspect("../victim", {}, form())).toEqual({
      error: "save",
    });
    expect(updateProspect).not.toHaveBeenCalled();
  });
  it.each([
    [401, "session"],
    [403, "agency"],
    [500, "save"],
  ] as const)("controls HTTP %s errors", async (code, error) => {
    vi.mocked(findMatchingProspect).mockRejectedValue(
      new AppError("sensitive details", code),
    );
    expect(await saveWorkspaceProspect(null, {}, form())).toEqual({ error });
    expect(createProspect).not.toHaveBeenCalled();
  });
});
