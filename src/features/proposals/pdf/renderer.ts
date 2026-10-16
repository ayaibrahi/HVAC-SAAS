import type { CurrencyCode } from "@/config/currencies";
import { formatSnapshotDate, formatSnapshotMoney } from "./format";
import type { ProposalPdfView } from "./view-model";
import {
  SimplePdfDocument,
  pdfAccent,
  pdfMuted,
  type PdfTextOptions,
} from "./document";
import { fitLogo, ValidatedAgencyLogo } from "./logo";
import { measurePdfText, wrapPdfText } from "./text";

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const bottomMargin = 78;
const contentWidth = pageWidth - margin * 2;

// Logo support is local-only until snapshot-bound immutable storage is approved.
// The authenticated download path intentionally supplies only the frozen view.
export function renderProposalPdf(
  view: ProposalPdfView,
  branding?: { agencyId: string; logo?: ValidatedAgencyLogo | null },
) {
  const logo =
    branding && ValidatedAgencyLogo.belongsTo(branding.logo, branding.agencyId)
      ? branding.logo
      : null;
  const pdf = new PdfLayout(view, logo);
  pdf.cover();
  pdf.reviewNotice();
  pdf.section("Executive summary", view.summary);
  pdf.section("Scope and deliverables", view.scope);
  pdf.lineItems();
  pdf.pricing();
  pdf.section("Next steps", view.nextStep);
  return pdf.render();
}

export function extractPdfInspectableText(pdfBytes: Uint8Array) {
  return Buffer.from(pdfBytes).toString("latin1");
}

class PdfLayout {
  private readonly document = new SimplePdfDocument();
  private y = pageHeight - margin;

  constructor(
    private readonly view: ProposalPdfView,
    private readonly logo: ValidatedAgencyLogo | null,
  ) {}

  cover() {
    const top = this.y;
    if (this.logo) {
      const box = fitLogo(this.logo.width, this.logo.height);
      this.document.logo(
        pageWidth - margin - box.width,
        top - box.height,
        box.width,
        box.height,
      );
    }
    this.text(
      this.view.agencyName,
      { size: 18, font: "bold" },
      this.logo ? 352 : contentWidth,
    );
    if (this.logo) this.y = Math.min(this.y, top - 64);
    this.spacer(6);
    this.text("SERVICE PROPOSAL", { size: 8, font: "bold", color: pdfAccent });
    this.spacer(10);
    this.rule();
    this.spacer(14);
    this.text(this.view.title, { size: 22, font: "bold" });
    this.spacer(8);
    this.text(`Prepared for ${this.view.prospectName}`, {
      size: 11,
      font: "bold",
    });
    if (this.view.prospectWebsiteUrl)
      this.text(this.view.prospectWebsiteUrl, { size: 9, color: pdfMuted });
    this.text(`Prepared: ${formatSnapshotDate(this.view.snapshotCreatedAt)}`, {
      size: 9,
      color: pdfMuted,
    });
  }

  reviewNotice() {
    if (
      !/SCOPE DRAFT|\[Agency to specify|TEST ONLY|not an approved/iu.test(
        this.view.title + "\n" + this.view.scope,
      )
    )
      return;
    this.ensureSpace(58);
    this.spacer(12);
    this.document.rectangle(margin, this.y - 34, contentWidth, 34);
    this.document.text(margin + 10, this.y - 12, "DRAFT / REVIEW CONTENT", {
      size: 8,
      font: "bold",
      color: pdfAccent,
    });
    this.document.text(
      margin + 10,
      this.y - 25,
      "Agency approval is required before client delivery.",
      { size: 9 },
    );
    this.y -= 38;
  }

  text(text: string, options: PdfTextOptions = {}, width = contentWidth) {
    const size = options.size ?? 10;
    for (const line of wrapPdfText(text, width, size, options.font)) {
      this.ensureSpace(size + 4);
      this.document.text(margin, this.y - size, line, options);
      this.y -= size + 4;
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

  sectionTitle(title: string, bodyHeight = 35) {
    this.ensureSpace(41 + bodyHeight);
    this.spacer(18);
    this.text(title, { size: 13, font: "bold", color: pdfAccent });
    this.spacer(6);
  }

  section(title: string, body: string) {
    if (!body.trim()) return;
    const firstParagraph =
      body.split(/\n+/u).find((paragraph) => paragraph.trim()) ?? "";
    this.sectionTitle(
      title,
      Math.min(
        84,
        wrapPdfText(firstParagraph, contentWidth, 10).length * 14 + 5,
      ),
    );
    const subheadings =
      /^(Page reviewed|What we observed|Why this matters|Recommended approach|Recommended solution|Scope to confirm together|Included work proposed for approval:)$/u;
    for (const paragraph of body.split(/\n+/u)) {
      if (!paragraph.trim()) continue;
      const heading =
        subheadings.test(paragraph.trim()) ||
        /^[^\n]{1,80}:$/u.test(paragraph.trim());
      const height =
        wrapPdfText(paragraph, contentWidth, 10, heading ? "bold" : "regular")
          .length *
          14 +
        5;
      if (height <= 160) this.ensureSpace(height + (heading ? 56 : 0));
      this.text(
        paragraph,
        heading ? { size: 10, font: "bold", color: pdfAccent } : { size: 10 },
      );
      this.spacer(5);
    }
  }

  lineItems() {
    this.sectionTitle("Selected services");
    for (const item of this.view.lineItems) {
      const nameHeight =
        wrapPdfText(item.serviceName, contentWidth - 150, 11, "bold").length *
        15;
      this.ensureSpace(Math.min(200, nameHeight + 70));
      this.rule();
      const price = formatSnapshotMoney(item.lineTotal, this.view.currency);
      // Draw the amount first so unusually long names cannot move it to another page.
      this.document.text(
        pageWidth - margin - measurePdfText(price, 10, "bold"),
        this.y - 11,
        price,
        { size: 10, font: "bold" },
      );
      this.text(
        item.serviceName,
        { size: 11, font: "bold" },
        contentWidth - 150,
      );
      this.text(
        `Quantity ${item.quantity} | Unit ${formatSnapshotMoney(item.unitPrice, this.view.currency)}`,
        { size: 9, color: pdfMuted },
      );
      const narrative = this.view.summary + "\n" + this.view.scope;
      if (item.description.trim()) {
        if (narrative.includes(item.description.trim())) {
          this.text("Line description: see the saved narrative above.", {
            size: 9,
            color: pdfMuted,
          });
        } else {
          this.text("Agency-entered line description:", {
            size: 9,
            font: "bold",
          });
          this.text(item.description, { size: 9 });
        }
      }
      if (item.serviceDescription?.trim()) {
        if (
          narrative.includes(item.serviceDescription.trim()) ||
          item.description.includes(item.serviceDescription.trim())
        ) {
          this.text(
            "Catalog capability: see the saved description above; not agreed deliverables.",
            { size: 9, color: pdfMuted },
          );
        } else {
          this.text("Catalog capability - not agreed deliverables:", {
            size: 9,
            font: "bold",
          });
          this.text(item.serviceDescription, { size: 9 });
        }
      }
      this.spacer(8);
    }
  }

  pricing() {
    this.ensureSpace(150);
    this.sectionTitle("Investment");
    this.priceRow("Subtotal", this.view.pricing.subtotal, this.view.currency);
    if (this.view.pricing.discountAmount > 0) {
      const label =
        this.view.pricing.discountType === "percentage"
          ? `Discount (${this.view.pricing.discountValue.toFixed(2)}%)`
          : "Discount";
      this.priceRow(
        label,
        this.view.pricing.discountAmount,
        this.view.currency,
      );
    }
    this.spacer(4);
    this.document.rectangle(margin, this.y - 28, contentWidth, 28);
    this.y -= 4;
    this.priceRow("Total", this.view.pricing.total, this.view.currency, true);
    this.spacer(8);
  }

  render() {
    const fullName = this.view.agencyName.replace(/\s+/gu, " ");
    const footerName = boundedLabel(fullName, 330, 8);
    return this.document.render(this.logo, (page, total) => {
      this.document.line(margin, 54, pageWidth - margin, 54);
      this.document.text(margin, 39, footerName, {
        size: 8,
        font: "bold",
        color: pdfMuted,
      });
      this.document.text(
        margin,
        26,
        `Prepared ${formatSnapshotDate(this.view.snapshotCreatedAt)}`,
        { size: 8, color: pdfMuted },
      );
      const label = `Page ${page} of ${total}`;
      this.document.text(
        pageWidth - margin - measurePdfText(label, 8),
        32,
        label,
        { size: 8, color: pdfMuted },
      );
    });
  }

  private priceRow(
    label: string,
    value: number,
    currency: CurrencyCode,
    strong = false,
  ) {
    const size = strong ? 12 : 10;
    const amount = formatSnapshotMoney(value, currency);
    this.document.text(margin + (strong ? 10 : 0), this.y - 12, label, {
      size,
      font: strong ? "bold" : "regular",
    });
    this.document.text(
      pageWidth -
        margin -
        (strong ? 10 : 0) -
        measurePdfText(amount, size, strong ? "bold" : "regular"),
      this.y - 12,
      amount,
      { size, font: strong ? "bold" : "regular" },
    );
    this.y -= strong ? 24 : 20;
  }

  private ensureSpace(height: number) {
    if (this.y - height >= bottomMargin) return;
    this.document.addPage();
    this.y = pageHeight - margin;
    this.document.text(
      margin,
      this.y - 9,
      boundedLabel(this.view.agencyName.replace(/\s+/gu, " "), contentWidth, 9),
      { size: 9, font: "bold", color: pdfMuted },
    );
    this.y -= 25;
    this.rule();
  }
}

function boundedLabel(text: string, width: number, size: number) {
  if (measurePdfText(text, size, "bold") <= width) return text;
  let end = text.length;
  while (
    end > 0 &&
    measurePdfText(text.slice(0, end) + "...", size, "bold") > width
  )
    end--;
  return text.slice(0, end) + "...";
}
