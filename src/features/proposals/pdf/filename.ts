import type { ProposalPdfView } from "@/features/proposals/pdf/view-model";

const maxFilenameStemLength = 80;

export function buildProposalPdfFilename(view: ProposalPdfView) {
  const prospectPart = sanitizeFilenamePart(view.prospectName);
  const titlePart = sanitizeFilenamePart(view.title);
  const stem = [prospectPart, titlePart]
    .filter((part) => part.length > 0)
    .join("-")
    .slice(0, maxFilenameStemLength)
    .replace(/-+$/u, "");

  return `${stem || "proposal"}.pdf`;
}

export function sanitizeFilenamePart(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-+/gu, "-")
    .slice(0, maxFilenameStemLength);
}
