import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoSettings } from "./logo-settings";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import { brandingCopy } from "../copy";

describe("agency branding Settings presentation", () => {
  it.each(["en", "ar"] as const)(
    "keeps upload controls localized, accessible and isolated in %s",
    (locale) => {
      const html = renderToStaticMarkup(
        <UiPreferencesProvider initial={{ theme: "dark", locale }}>
          <LogoSettings
            agencyName="TEST ONLY - Cedar"
            initial={{ available: true, activeAssetId: null }}
          />
        </UiPreferencesProvider>,
      );
      expect(html).toContain(brandingCopy[locale].title);
      expect(html).toContain(brandingCopy[locale].upload);
      expect(html).toContain('accept="image/png,image/jpeg"');
      expect(html).toContain('type="file"');
      expect(html).toContain("TEST ONLY - Cedar");
      expect(html).not.toContain("agencyId");
      expect(html).not.toContain("service_role");
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain(
        "w-full min-w-0 space-y-2 text-sm text-ink sm:w-auto sm:flex-1",
      );
    },
  );
  it("disables upload until infrastructure exists, without a fake saved logo", () => {
    const html = renderToStaticMarkup(
      <LogoSettings
        agencyName="TEST ONLY"
        initial={{ available: false, activeAssetId: null }}
      />,
    );
    expect(html).toContain(brandingCopy.en.unavailable);
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("<img");
  });
  it("uses the same-origin authenticated image route without Next image optimization or Storage URLs", () => {
    const html = renderToStaticMarkup(
      <LogoSettings
        agencyName="TEST ONLY"
        initial={{
          available: true,
          activeAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }}
      />,
    );
    expect(html).toContain("/api/agency-branding?v=");
    expect(html).not.toContain("/_next/image");
    expect(html).toContain(brandingCopy.en.replace);
    expect(html).toContain(brandingCopy.en.remove);
    expect(html).not.toContain("supabase.co");
    expect(html).toContain("background-color:#fff");
  });
});
