import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderPublicAgencyLogo } from "./agency-logo";
import { publicShareSecurityHeaders } from "./public-page";

describe("bounded server-projected public logo", () => {
  it("renders only inline PNG without Storage URLs or asset identifiers", async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 80, b: 60, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    const html = renderPublicAgencyLogo(
      `data:image/png;base64,${png.toString("base64")}`,
    );
    expect(html).toContain('<img class="agency-logo"');
    expect(html).toContain('src="data:image/png;base64,');
    expect(html).not.toContain("https:");
    expect(html).not.toContain("object_key");
    expect(publicShareSecurityHeaders["Content-Security-Policy"]).toContain(
      "img-src data:;",
    );
    expect(publicShareSecurityHeaders["Content-Security-Policy"]).toContain(
      "connect-src 'none'",
    );
  });
  it.each([
    null,
    undefined,
    "https://evil.example/logo.png",
    "data:image/svg+xml;base64,PHN2Zz4=",
    'data:image/png;base64,iVBORw0KGgo" onerror="unsafe',
    "data:image/png;base64,iVBORw0KGgo" + "A".repeat(1_400_000),
  ])(
    "rejects missing, external, SVG, malicious or oversized projections",
    (value) => {
      expect(renderPublicAgencyLogo(value)).toBe("");
    },
  );
});
