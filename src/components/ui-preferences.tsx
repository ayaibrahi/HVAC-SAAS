"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { getDictionary, type TranslationKey } from "@/lib/i18n/dictionaries";
import {
  localeDirection,
  normalizePreferences,
  preferenceCookie,
  type UiPreferences,
} from "@/lib/ui/preferences";

const UiContext = createContext<
  UiPreferences & {
    setPreference: (key: keyof UiPreferences, value: string) => void;
  }
>({
  ...normalizePreferences(),
  setPreference: () => {},
});

export function UiPreferencesProvider({
  initial,
  children,
}: {
  initial: UiPreferences;
  children?: ReactNode;
}) {
  const [preferences, setPreferences] = useState(() =>
    normalizePreferences(initial.theme, initial.locale),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.locale;
    document.documentElement.dir = localeDirection(preferences.locale);
  }, [preferences]);

  function setPreference(key: keyof UiPreferences, value: string) {
    const next = normalizePreferences(
      key === "theme" ? value : preferences.theme,
      key === "locale" ? value : preferences.locale,
    );
    document.cookie = preferenceCookie(
      key,
      next[key],
      location.protocol === "https:",
    );
    setPreferences(next);
  }

  return (
    <UiContext.Provider value={{ ...preferences, setPreference }}>
      {children}
    </UiContext.Provider>
  );
}

export function useInterface() {
  const preferences = useContext(UiContext);
  return { ...preferences, t: getDictionary(preferences.locale) };
}

export function InterfaceText({ name }: { name: TranslationKey }) {
  return useInterface().t[name];
}

export function PreferenceControls() {
  const { theme, locale, setPreference, t } = useInterface();
  const router = useRouter();
  return (
    <div className="preference-controls flex shrink-0 items-center gap-2">
      <div
        role="group"
        aria-label={t.theme}
        className="theme-switch flex rounded-md border border-border p-1"
      >
        {(
          [
            ["light", Sun],
            ["dark", Moon],
          ] as const
        ).map(([value, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            aria-label={t[value]}
            title={t[value]}
            onClick={() => setPreference("theme", value)}
            className="flex h-9 w-9 items-center justify-center rounded"
          >
            <Icon size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
      <label>
        <span className="sr-only">{t.language}</span>
        <select
          aria-label={t.language}
          dir="auto"
          value={locale}
          onChange={(event) => {
            setPreference("locale", event.target.value);
            router.refresh();
          }}
          className="locale-select min-h-11 rounded-md border border-border px-2 text-sm"
        >
          <option value="en" lang="en">
            {t.english}
          </option>
          <option value="ar" lang="ar">
            {t.arabic}
          </option>
        </select>
      </label>
    </div>
  );
}

export function EnglishWorkflow({ children }: { children?: ReactNode }) {
  const { locale, t } = useInterface();
  return (
    <>
      {locale === "ar" ? (
        <p
          lang="ar"
          dir="rtl"
          className="mb-6 border-s-2 border-accent ps-3 text-sm leading-relaxed text-muted"
        >
          {t.partialLocale}
        </p>
      ) : null}
      <div lang="en" dir="ltr">
        {children}
      </div>
    </>
  );
}
