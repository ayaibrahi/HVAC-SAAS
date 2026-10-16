import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { ValidatedAgencyLogo, fitLogo, logoLimits } from "./logo";
import { renderProposalPdf } from "./renderer";
import { buildProposalPdfView } from "./view-model";
import { encodePdfText, measurePdfText } from "./text";
import {
  makeIllustrativeContactOffer,
  makeLocalContentSnapshot,
} from "../sales-test-fixtures";
import { getProposalContentSuggestion } from "../content-suggestion";
import { mapDeliverySnapshotToPublicView } from "../delivery/public-view";

const owner = "fictional-agency-a";
const decode = (bytes: Uint8Array, requestingAgencyId = owner) =>
  ValidatedAgencyLogo.decode({
    bytes,
    ownerAgencyId: owner,
    requestingAgencyId,
  });
const raster = (width = 128, height = 128, alpha = 1) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 105, b: 91, alpha },
    },
  })
    .png()
    .toBuffer();

function view() {
  const data = makeIllustrativeContactOffer();
  data.agency.name = "TEST ONLY - Cedar Studio";
  return buildProposalPdfView(
    makeLocalContentSnapshot(data, getProposalContentSuggestion(data)!),
  );
}

describe("bounded local agency raster logos", () => {
  it.each([
    [128, 128],
    [400, 100],
    [100, 400],
  ])("decodes and fits %ix%i without distortion", async (width, height) => {
    const logo = await decode(await raster(width, height));
    const box = fitLogo(logo.width, logo.height);
    expect(box.width).toBeLessThanOrEqual(120);
    expect(box.height).toBeLessThanOrEqual(56);
    expect(box.width / box.height).toBeCloseTo(width / height);
    expect(logo.pixels()).toHaveLength(logo.width * logo.height * 4);
  });

  it("decodes real JPEG and preserves PNG alpha via a PDF soft mask", async () => {
    const bytes = await raster();
    const jpeg = await sharp(bytes).jpeg().toBuffer();
    expect((await decode(jpeg)).width).toBe(128);
    const logo = await decode(await raster(64, 64, 0.5));
    expect(logo.pixels()[3]).toBeGreaterThan(0);
    expect(logo.pixels()[3]).toBeLessThan(255);
    const pdf = renderProposalPdf(view(), { agencyId: owner, logo }).toString(
      "latin1",
    );
    expect(pdf).toContain("/SMask");
    expect(pdf).toContain("/DeviceRGB");
    expect(pdf).toContain("/DeviceGray");
  });

  it.each([
    Buffer.from("<svg><script>unsafe</script></svg>"),
    Buffer.from("https://example.com/logo.png"),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    Buffer.from([255, 216, 255, 0]),
    Buffer.alloc(0),
  ])(
    "rejects unsupported or corrupt contents without decoder details",
    async (bytes) => {
      await expect(decode(bytes)).rejects.toThrow(/valid PNG or JPEG/i);
    },
  );

  it("rejects oversized compressed bytes, dimensions, pixel counts, tiny and extreme-aspect logos", async () => {
    await expect(decode(Buffer.alloc(logoLimits.bytes + 1))).rejects.toThrow(
      "up to 1 MB",
    );
    for (const [width, height] of [
      [2049, 20],
      [1600, 1600],
      [8, 8],
      [1024, 32],
    ])
      await expect(decode(await raster(width, height))).rejects.toThrow(
        "could not be read safely",
      );
  });

  it("rejects foreign or missing ownership without leaking private asset data", async () => {
    const bytes = await raster();
    await expect(decode(bytes, "fictional-agency-b")).rejects.toThrow(
      "not available",
    );
    await expect(
      ValidatedAgencyLogo.decode({
        bytes,
        ownerAgencyId: "",
        requestingAgencyId: "",
      }),
    ).rejects.toThrow("not available");
  });

  it("canonicalizes decoded pixels, strips metadata and does not allow mutation", async () => {
    const bytes = await sharp(await raster())
      .withMetadata({ exif: { IFD0: { Artist: "PRIVATE TEST METADATA" } } })
      .png()
      .toBuffer();
    const logo = await decode(bytes);
    const digest = logo.digest;
    logo.pixels().fill(0);
    bytes.fill(0);
    expect(logo.digest).toBe(digest);
    expect(Object.isFrozen(logo)).toBe(true);
    const pdf = renderProposalPdf(view(), { agencyId: owner, logo });
    expect(pdf.toString("latin1")).not.toContain("PRIVATE TEST METADATA");
    expect(
      renderProposalPdf(view(), { agencyId: owner, logo }).equals(pdf),
    ).toBe(true);
  });

  it("falls back to the full frozen agency name for absent, foreign and forged logos", async () => {
    const source = view();
    const expected = renderProposalPdf(source);
    const logo = await decode(await raster());
    expect(
      renderProposalPdf(source, { agencyId: owner, logo: null }).equals(
        expected,
      ),
    ).toBe(true);
    expect(
      renderProposalPdf(source, { agencyId: "other", logo }).equals(expected),
    ).toBe(true);
    const forged = Object.assign(Object.create(ValidatedAgencyLogo.prototype), {
      agencyId: owner,
    });
    expect(
      renderProposalPdf(source, { agencyId: owner, logo: forged }).equals(
        expected,
      ),
    ).toBe(true);
    expect(expected.toString("latin1")).toContain("TEST ONLY - Cedar Studio");
  });

  it("performs no network request for any branding or prospect URL", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("forbidden"));
    try {
      renderProposalPdf(view(), {
        agencyId: owner,
        logo: await decode(await raster()),
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("agency-first snapshot layout", () => {
  it("retains frozen agency identity across PDF and public projection after profile edits", () => {
    const data = makeIllustrativeContactOffer();
    data.agency.name = "TEST ONLY - Original Agency";
    const snapshot = makeLocalContentSnapshot(
      data,
      getProposalContentSuggestion(data)!,
    );
    const before = JSON.stringify(snapshot);
    const pdf = renderProposalPdf(buildProposalPdfView(snapshot));
    data.agency.name = "Changed Agency";
    data.agency.website = "https://changed.example";
    expect(renderProposalPdf(buildProposalPdfView(snapshot)).equals(pdf)).toBe(
      true,
    );
    expect(mapDeliverySnapshotToPublicView(snapshot).agency.displayName).toBe(
      "TEST ONLY - Original Agency",
    );
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(pdf.toString("latin1")).not.toContain("changed.example");
  });

  it("keeps all text within page bounds and clear of numbered footers on long pages", () => {
    const source = view();
    source.agencyName = "TEST ONLY Long Agency ".repeat(15);
    source.prospectName = "Fictional Climate Client ".repeat(10);
    source.title = "TEST ONLY Long proposal title ".repeat(20);
    source.summary = Array.from(
      { length: 100 },
      (_, i) => `Unique observation ${i}: checked on the analyzed page only.`,
    ).join("\n");
    source.scope = Array.from(
      { length: 100 },
      (_, i) =>
        `Unique deliverable ${i}: proposed for review, not a catalog commitment.`,
    ).join("\n");
    const pdf = renderProposalPdf(source).toString("latin1");
    const pages = pdf.match(/\/Type \/Page\b/g)!.length;
    expect(pages).toBeGreaterThan(3);
    for (let i = 0; i < pages; i++)
      expect(pdf).toContain(`Page ${i + 1} of ${pages}`);
    for (const match of pdf.matchAll(
      /\/(F1|F2) (\d+) Tf ([\d.]+) ([\d.]+) Td \(((?:\\.|[^\\)])*)\) Tj/g,
    )) {
      const [, font, size, x, y, escaped] = match;
      const text = escaped.replace(/\\([\\()])/g, "$1");
      expect(Number(y)).toBeLessThanOrEqual(738);
      expect(
        Number(y) === 26 ||
          Number(y) === 32 ||
          Number(y) === 39 ||
          Number(y) >= 78,
      ).toBe(true);
      expect(Number(x)).toBeGreaterThanOrEqual(54);
      expect(
        Number(x) +
          measurePdfText(
            text,
            Number(size),
            font === "F2" ? "bold" : "regular",
          ),
      ).toBeLessThanOrEqual(558.02);
    }
    for (let i = 0; i < 100; i++) {
      expect(pdf).toContain(`Unique observation ${i}:`);
      expect(pdf).toContain(`Unique deliverable ${i}:`);
    }
    expect(pdf.match(/\(Total\) Tj/g)).toHaveLength(1);
    expect(pdf).toContain("USD 500.00");
  });

  it("visibly marks unapproved scope, preserves unique content and avoids exact catalog repetition", () => {
    const source = view();
    const before = JSON.stringify(source);
    const pdf = renderProposalPdf(source).toString("latin1");
    expect(pdf).toContain("DRAFT / REVIEW CONTENT");
    expect(pdf).toContain("Catalog capability - not agreed deliverables:");
    expect(pdf).toContain("Line description: see the saved narrative above.");
    expect(pdf).toContain("No performance or revenue commitments.");
    expect(pdf).toContain(encodePdfText("Website Conversion Optimization"));
    expect(JSON.stringify(source)).toBe(before);
  });
});
