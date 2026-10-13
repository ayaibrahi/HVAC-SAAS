import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
import RootLayout, { metadata } from "@/app/layout";

async function renderRoot() {
  return renderToStaticMarkup(
    await RootLayout({ children: createElement("p", null, "Content") }),
  );
}
describe("server-initialized document preferences", () => {
  beforeEach(() => getCookie.mockReturnValue(undefined));
  it("defaults to Light and English before any client script runs", async () => {
    expect(await renderRoot()).toContain(
      '<html lang="en" dir="ltr" data-theme="light">',
    );
  });
  it("renders Dark and Arabic in the initial HTML without a theme bootstrap script", async () => {
    getCookie.mockImplementation((name: string) => ({
      value: name === "ui-theme" ? "dark" : "ar",
    }));
    const html = await renderRoot();
    expect(html).toContain('<html lang="ar" dir="rtl" data-theme="dark">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("suppressHydrationWarning");
  });
  it("rejects malformed cookie values rather than interpolating them into the document", async () => {
    getCookie.mockReturnValue({ value: '\"><script>bad</script>' });
    const html = await renderRoot();
    expect(html).toContain('<html lang="en" dir="ltr" data-theme="light">');
    expect(html).not.toContain("bad");
  });
  it("declares replaceable local vector and raster application icons", () => {
    expect(metadata.icons).toMatchObject({
      apple: { url: "/brand/scanvoro-apple.png", sizes: "180x180" },
    });
    expect(JSON.stringify(metadata.icons)).toContain(
      "/brand/scanvoro-mark.svg",
    );
  });
});
