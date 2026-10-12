import { describe, expect, it, vi } from "vitest";
import {
  closeNavigationDrawer,
  getDrawerFocusTarget,
  isNavigationActive,
  openNavigationDrawer,
  workspaceNavigation,
} from "@/components/dashboard/navigation";

describe("workspace navigation", () => {
  it.each(workspaceNavigation)(
    "marks only $label active at its exact route",
    ({ href }) => {
      expect(
        workspaceNavigation
          .filter((item) => isNavigationActive(href, item.href))
          .map((item) => item.href),
      ).toEqual([href]);
    },
  );
  it.each([
    "/dashboard/prospects/123/edit",
    "/dashboard/services/123/edit",
    "/dashboard/proposals/123",
  ])("keeps the correct section active for %s", (path) => {
    expect(
      workspaceNavigation.filter((item) => isNavigationActive(path, item.href)),
    ).toHaveLength(1);
    expect(
      isNavigationActive(path, path.split("/").slice(0, 3).join("/")),
    ).toBe(true);
    expect(isNavigationActive(path, "/dashboard")).toBe(false);
  });
  it.each([
    "/dashboard/prospects-other",
    "/dashboard/proposals-other",
    "/other/dashboard",
    "/sign-in",
  ])("does not highlight partial or unrelated paths: %s", (path) => {
    expect(
      workspaceNavigation.some((item) => isNavigationActive(path, item.href)),
    ).toBe(false);
  });
});

describe("native mobile drawer state", () => {
  it("wraps Tab and Shift+Tab at modal boundaries", () => {
    const controls = [
      { id: "close" },
      { id: "dashboard" },
      { id: "sign-out" },
    ] as HTMLElement[];
    expect(getDrawerFocusTarget(controls, controls[2], false)).toBe(
      controls[0],
    );
    expect(getDrawerFocusTarget(controls, controls[0], true)).toBe(controls[2]);
    expect(getDrawerFocusTarget(controls, controls[1], false)).toBeNull();
    expect(getDrawerFocusTarget(controls, controls[1], true)).toBeNull();
    expect(getDrawerFocusTarget([], null, false)).toBeNull();
  });
  function makeDialog() {
    const dialog = {
      open: false,
      showModal: vi.fn(() => {
        dialog.open = true;
      }),
      close: vi.fn(() => {
        dialog.open = false;
      }),
    };
    return dialog;
  }
  it("opens modally once and closes once without duplicate operations", () => {
    const dialog = makeDialog();
    const element = dialog as unknown as HTMLDialogElement;
    expect(openNavigationDrawer(element)).toBe(true);
    expect(openNavigationDrawer(element)).toBe(false);
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(closeNavigationDrawer(element)).toBe(true);
    expect(closeNavigationDrawer(element)).toBe(false);
    expect(dialog.open).toBe(false);
    expect(dialog.close).toHaveBeenCalledOnce();
  });
  it("can reopen after dismissal", () => {
    const dialog = makeDialog();
    const element = dialog as unknown as HTMLDialogElement;
    openNavigationDrawer(element);
    closeNavigationDrawer(element);
    openNavigationDrawer(element);
    expect(dialog.open).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledTimes(2);
  });
  it("safely ignores an unmounted drawer", () => {
    expect(openNavigationDrawer(null)).toBe(false);
    expect(closeNavigationDrawer(null)).toBe(false);
  });
});
