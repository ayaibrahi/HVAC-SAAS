import type { CurrencyCode } from "@/config/currencies";
import {
  formatSnapshotDate,
  formatSnapshotMoney,
} from "@/features/proposals/pdf/format";
import type { ProposalPdfView } from "@/features/proposals/pdf/view-model";

type PdfFont = "regular" | "bold";

type PdfTextOptions = {
  size?: number;
  font?: PdfFont;
};

type PdfPage = {
  commands: string[];
};

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const bottomMargin = 54;
const contentWidth = pageWidth - margin * 2;

export function renderProposalPdf(view: ProposalPdfView) {
  const pdf = new PdfLayout();

  pdf.text(view.agencyName, { size: 11, font: "bold" });
  pdf.text(view.title, { size: 22, font: "bold" });
  pdf.spacer(8);
  pdf.rule();
  pdf.spacer(14);
  pdf.text(`Prepared for ${view.prospectName}`, { size: 11, font: "bold" });

  if (view.prospectWebsiteUrl) {
    pdf.text(view.prospectWebsiteUrl, { size: 10 });
  }

  pdf.text(`Snapshot date: ${formatSnapshotDate(view.snapshotCreatedAt)}`, {
    size: 10,
  });
  pdf.section("Proposal Summary", view.summary);
  pdf.section("Scope", view.scope);
  pdf.lineItems(view);
  pdf.pricing(view);
  pdf.section("Next Step", view.nextStep);

  return pdf.render();
}

export function extractPdfInspectableText(pdfBytes: Uint8Array) {
  return Buffer.from(pdfBytes).toString("latin1");
}

class PdfLayout {
  private readonly document = new SimplePdfDocument();
  private y = pageHeight - margin;

  text(text: string, options: PdfTextOptions = {}) {
    const fontSize = options.size ?? 10;
    const lines = wrapText(text, contentWidth, fontSize);

    for (const line of lines) {
      this.ensureSpace(fontSize + 4);
      this.document.text(margin, this.y, line, options);
      this.y -= fontSize + 4;
    }
  }

  spacer(height: number) {
    this.ensureSpace(height);
    this.y -= height;
  }

  rule() {
    this.ensureSpace(8);
    this.document.line(margin, this.y, pageWidth - margin, this.y);
    this.y -= 8;
  }

  section(title: string, body: string) {
    if (!body.trim()) {
      return;
    }

    this.spacer(12);
    this.text(title, { size: 14, font: "bold" });
    this.spacer(2);

    for (const paragraph of body.split(/\n+/u)) {
      if (!paragraph.trim()) {
        continue;
      }

      this.text(paragraph, { size: 10 });
      this.spacer(4);
    }
  }

  lineItems(view: ProposalPdfView) {
    this.spacer(12);
    this.text("Services", { size: 14, font: "bold" });
    this.spacer(2);

    for (const item of view.lineItems) {
      this.ensureSpace(64);
      this.document.rectangle(margin, this.y - 8, contentWidth, 1);
      this.y -= 18;
      this.document.text(margin, this.y, item.serviceName, {
        size: 11,
        font: "bold",
      });
      this.document.text(
        pageWidth - margin - 130,
        this.y,
        formatSnapshotMoney(item.lineTotal, view.currency),
        { size: 10, font: "bold" },
      );
      this.y -= 14;

      if (item.serviceDescription) {
        this.text(item.serviceDescription, { size: 9 });
      }

      this.text(item.description, { size: 9 });
      this.text(
        `Quantity ${item.quantity} | Unit ${formatSnapshotMoney(
          item.unitPrice,
          view.currency,
        )}`,
        { size: 9 },
      );
      this.spacer(6);
    }
  }

  pricing(view: ProposalPdfView) {
    this.spacer(10);
    this.rule();
    this.priceRow("Subtotal", view.pricing.subtotal, view.currency);

    if (view.pricing.discountAmount > 0) {
      const label =
        view.pricing.discountType === "percentage"
          ? `Discount (${view.pricing.discountValue.toFixed(2)}%)`
          : "Discount";

      this.priceRow(label, view.pricing.discountAmount, view.currency);
    }

    this.priceRow("Total", view.pricing.total, view.currency, true);
  }

  render() {
    return this.document.render();
  }

  private priceRow(
    label: string,
    value: number,
    currency: CurrencyCode,
    strong = false,
  ) {
    this.ensureSpace(18);
    this.document.text(pageWidth - margin - 210, this.y, label, {
      size: strong ? 12 : 10,
      font: strong ? "bold" : "regular",
    });
    this.document.text(
      pageWidth - margin - 90,
      this.y,
      formatSnapshotMoney(value, currency),
      {
        size: strong ? 12 : 10,
        font: strong ? "bold" : "regular",
      },
    );
    this.y -= strong ? 18 : 16;
  }

  private ensureSpace(requiredHeight: number) {
    if (this.y - requiredHeight >= bottomMargin) {
      return;
    }

    this.document.addPage();
    this.y = pageHeight - margin;
  }
}

class SimplePdfDocument {
  private pages: PdfPage[] = [{ commands: [] }];

  addPage() {
    this.pages.push({ commands: [] });
  }

  text(
    x: number,
    y: number,
    text: string,
    { size = 10, font = "regular" }: PdfTextOptions = {},
  ) {
    this.currentPage.commands.push(
      `BT /${font === "bold" ? "F2" : "F1"} ${size} Tf ${formatNumber(
        x,
      )} ${formatNumber(y)} Td (${escapePdfText(text)}) Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.currentPage.commands.push(
      `0.55 w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(
        x2,
      )} ${formatNumber(y2)} l S`,
    );
  }

  rectangle(x: number, y: number, width: number, height: number) {
    this.currentPage.commands.push(
      `0.92 g ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(
        width,
      )} ${formatNumber(height)} re f 0 g`,
    );
  }

  render() {
    const objects: string[] = [
      "",
      "",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ];
    const pageObjectIds: number[] = [];

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
          "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>",
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
    return this.pages[this.pages.length - 1];
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

function wrapText(text: string, width: number, fontSize: number) {
  const normalized = normalizePdfText(text);
  const maxChars = Math.max(18, Math.floor(width / (fontSize * 0.52)));
  const lines: string[] = [];

  for (const paragraph of normalized.split(/\n+/u)) {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    let line = "";

    for (const word of words) {
      if (word.length > maxChars) {
        if (line.length > 0) {
          lines.push(line);
          line = "";
        }

        for (let index = 0; index < word.length; index += maxChars) {
          lines.push(word.slice(index, index + maxChars));
        }

        continue;
      }

      const candidate = line.length === 0 ? word : `${line} ${word}`;

      if (candidate.length > maxChars && line.length > 0) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line.length > 0) {
      lines.push(line);
    }
  }

  return lines.length > 0 ? lines : [""];
}

function normalizePdfText(text: string) {
  return text
    .replace(/\r\n?/gu, "\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/gu, "?")
    .replace(/[\t ]+/gu, " ")
    .trim();
}

function escapePdfText(text: string) {
  return normalizePdfText(text).replace(/[\\()]/gu, (character) => `\\${character}`);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
