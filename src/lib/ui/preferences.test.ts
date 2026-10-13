import { describe, expect, it, vi } from "vitest";
import {
  formatInterfaceDate,
  localeDirection,
  normalizePreferences,
  preferenceCookie,
} from "@/lib/ui/preferences";

vi.mock("server-only", () => ({}));
const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
import { getUiPreferences } from "@/lib/ui/server-preferences";

describe("validated interface preferences", () => {
  it("defaults to Light / English", () =>
    expect(normalizePreferences()).toEqual({ theme: "light", locale: "en" }));
  it.each(["light", "dark"])("accepts theme %s", (theme) =>
    expect(normalizePreferences(theme, "ar")).toEqual({ theme, locale: "ar" }),
  );
  it.each(["en", "ar"])("accepts locale %s", (locale) =>
    expect(normalizePreferences("dark", locale).locale).toBe(locale),
  );
  it.each(["system", "DARK", "fr", "ar-EG", "<script>", null, {}, []])(
    "rejects invalid preference %j safely",
    (value) => {
      expect(normalizePreferences(value, value)).toEqual({
        theme: "light",
        locale: "en",
      });
    },
  );
  it("maps only Arabic to RTL", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });
  it("serializes bounded persistent first-party cookies", () => {
    expect(preferenceCookie("theme", "dark", true)).toBe(
      "ui-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(preferenceCookie("locale", "ar", false)).toBe(
      "ui-locale=ar; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(() =>
      preferenceCookie("theme", "dark; Domain=evil.test", true),
    ).toThrow();
    expect(() => preferenceCookie("locale", "../admin", true)).toThrow();
  });
  it("initializes server rendering from cookies before hydration", async () => {
    getCookie.mockImplementation((key: string) => ({
      value: key === "ui-theme" ? "dark" : "ar",
    }));
    expect(await getUiPreferences()).toEqual({ theme: "dark", locale: "ar" });
    getCookie.mockReturnValue({ value: "untrusted" });
    expect(await getUiPreferences()).toEqual({ theme: "light", locale: "en" });
  });
  it("formats interface dates in UTC for deterministic hydration", () => {
    expect(formatInterfaceDate("2026-10-13T00:00:00Z", "en")).toBe(
      "Oct 13, 2026",
    );
    expect(formatInterfaceDate("2026-10-13T00:00:00Z", "ar")).not.toBe(
      formatInterfaceDate("2026-10-13T00:00:00Z", "en"),
    );
  });
});
