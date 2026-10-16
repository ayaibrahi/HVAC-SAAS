import { deflateSync } from "node:zlib";
import type { ValidatedAgencyLogo } from "./logo";
import { encodePdfText } from "./text";

export const pdfInk = "0.10 0.15 0.18";
export const pdfMuted = "0.34 0.40 0.43";
export const pdfAccent = "0.08 0.36 0.34";

export type PdfTextOptions = {
  size?: number;
  font?: "regular" | "bold";
  color?: string;
};
type PdfPage = { commands: string[] };
const pageWidth = 612;
const pageHeight = 792;

export class SimplePdfDocument {
  private pages: PdfPage[] = [{ commands: [] }];
  private footerPage: number | null = null;

  addPage() {
    this.pages.push({ commands: [] });
  }

  text(
    x: number,
    y: number,
    text: string,
    { size = 10, font = "regular", color = pdfInk }: PdfTextOptions = {},
  ) {
    this.currentPage.commands.push(
      `q ${color} rg BT /${font === "bold" ? "F2" : "F1"} ${size} Tf ${formatNumber(
        x,
      )} ${formatNumber(y)} Td (${encodePdfText(text)}) Tj ET Q`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.currentPage.commands.push(
      `q 0.78 0.82 0.82 RG 0.5 w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(
        x2,
      )} ${formatNumber(y2)} l S Q`,
    );
  }

  rectangle(x: number, y: number, width: number, height: number) {
    this.currentPage.commands.push(
      `q 0.94 0.96 0.96 rg ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(
        width,
      )} ${formatNumber(height)} re f Q`,
    );
  }

  logo(x: number, y: number, width: number, height: number) {
    this.currentPage.commands.push(
      `q ${formatNumber(width)} 0 0 ${formatNumber(height)} ${formatNumber(x)} ${formatNumber(y)} cm /AgencyLogo Do Q`,
    );
  }

  render(
    logo: ValidatedAgencyLogo | null,
    footer: (page: number, total: number) => void,
  ) {
    for (let page = 0; page < this.pages.length; page++) {
      this.footerPage = page;
      footer(page + 1, this.pages.length);
    }
    this.footerPage = null;
    const objects: string[] = [
      "",
      "",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ];
    const pageObjectIds: number[] = [];
    let imageId: number | null = null;
    if (logo) {
      const rgba = logo.pixels();
      const rgb = Buffer.alloc(logo.width * logo.height * 3);
      const alpha = Buffer.alloc(logo.width * logo.height);
      for (let p = 0; p < alpha.length; p++) {
        rgba.copy(rgb, p * 3, p * 4, p * 4 + 3);
        alpha[p] = rgba[p * 4 + 3];
      }
      const image = (pixels: Buffer, color: string, mask = "") => {
        const data = deflateSync(pixels);
        return `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /${color} /BitsPerComponent 8 /Filter /FlateDecode ${mask} /Length ${data.length} >>\nstream\n${data.toString("latin1")}\nendstream`;
      };
      const maskId = objects.length + 1;
      objects.push(image(alpha, "DeviceGray"));
      imageId = objects.length + 1;
      objects.push(image(rgb, "DeviceRGB", `/SMask ${maskId} 0 R`));
    }

    for (const page of this.pages) {
      const content = page.commands.join("\n");
      const contentId = objects.length + 1;
      objects.push(
        `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
      );
      const pageId = objects.length + 1;
      objects.push(
        [
          "<< /Type /Page",
          "/Parent 2 0 R",
          `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${imageId ? `/XObject << /AgencyLogo ${imageId} 0 R >>` : ""} >>`,
          `/Contents ${contentId} 0 R`,
          ">>",
        ].join("\n"),
      );
      pageObjectIds.push(pageId);
    }

    objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[1] = `<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageObjectIds.length} >>`;

    return buildPdfDocument(objects);
  }

  private get currentPage() {
    return this.pages[this.footerPage ?? this.pages.length - 1];
  }
}

function buildPdfDocument(objects: string[]) {
  let body = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(body, "latin1");
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";

  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  body += [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  return Buffer.from(body, "latin1");
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
