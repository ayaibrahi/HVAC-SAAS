export function proposalReadyProblem(input: {
  summary: string;
  scope: string;
  lineItems: readonly { unitPrice: string | number }[];
  total?: number;
}) {
  const missing = [
    !input.summary.trim() && "Summary",
    !input.scope.trim() && "Scope",
    input.lineItems.length === 0 && "at least one selected service",
  ].filter(Boolean);
  if (missing.length)
    return `To mark this proposal Ready, add: ${missing.join(", ")}. Your edits have not been discarded.`;
  if (
    input.lineItems.some(
      (line) =>
        !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) <= 0,
    )
  )
    return "Enter a unit price greater than zero for every selected service before marking this proposal Ready or preparing a client version. You can still save your work as Draft.";
  if (
    input.total !== undefined &&
    (!Number.isFinite(input.total) || input.total <= 0)
  )
    return "The total investment must be greater than zero before marking this proposal Ready or preparing a client version. Review the prices and discount, or save as Draft.";
  return null;
}
