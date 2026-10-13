import { z } from "zod";

export const themeSchema = z.enum(["light", "dark"]);
export const localeSchema = z.enum(["en", "ar"]);
export type Theme = z.infer<typeof themeSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type UiPreferences = { theme: Theme; locale: Locale };
export const preferenceCookies = {
  theme: "ui-theme",
  locale: "ui-locale",
} as const;

export function normalizePreferences(
  theme?: unknown,
  locale?: unknown,
): UiPreferences {
  return {
    theme: themeSchema.safeParse(theme).data ?? "light",
    locale: localeSchema.safeParse(locale).data ?? "en",
  };
}

export function localeDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function preferenceCookie(
  key: keyof UiPreferences,
  value: unknown,
  secure: boolean,
) {
  const parsed = (key === "theme" ? themeSchema : localeSchema).parse(value);
  return `${preferenceCookies[key]}=${parsed}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function formatInterfaceDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-arab" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
