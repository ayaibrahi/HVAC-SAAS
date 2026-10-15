import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ShareLinkControls } from "./share-link-controls";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import { getProposalCopy } from "@/lib/i18n/proposals";

vi.mock("@/features/proposals/share-links/actions", () => ({
  createProposalShareLinkAction: vi.fn(),
  revokeProposalShareLinkAction: vi.fn(),
}));

describe("client-ready sharing clarity", () => {
  it.each(["en", "ar"] as const)(
    "explains replacement, expiry and Preview protection without exposing a stored token (%s)",
    (locale) => {
      const copy = getProposalCopy(locale);
      const html = renderToStaticMarkup(
        <UiPreferencesProvider initial={{ locale, theme: "dark" }}>
          <ShareLinkControls
            snapshotId="synthetic-version"
            activeLink={{
              id: "link-metadata",
              agencyId: "synthetic-agency",
              deliverySnapshotId: "synthetic-version",
              status: "active",
              expiresAt: "2030-10-01T12:00:00Z",
              createdAt: "2026-10-15T12:00:00Z",
              revokedAt: null,
            }}
          />
        </UiPreferencesProvider>,
      );
      expect(html).toContain(copy.newLink);
      expect(html).toContain(copy.hiddenLink);
      expect(html).toContain(copy.expires);
      expect(html).toContain(copy.previewProtection);
      expect(html).not.toContain("/proposals/shared/");
      expect(html).not.toContain('name="token"');
    },
  );
});
