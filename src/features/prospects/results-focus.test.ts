import { describe, expect, it, vi } from "vitest";
import { revealSavedResults } from "./results-focus";

describe("saved result focus", () => {
  it("focuses and reveals an already selected or newly rendered region on every request", () => {
    const region = { focus: vi.fn(), scrollIntoView: vi.fn() };
    revealSavedResults(region);
    revealSavedResults(region);
    expect(region.focus).toHaveBeenCalledTimes(2);
    expect(region.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(region.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(region.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "auto",
    });
  });
  it("does not invent or fetch results when no section is mounted", () => {
    expect(() => revealSavedResults(null)).not.toThrow();
  });
});
