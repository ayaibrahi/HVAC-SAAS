export function proposalPriceProblem(
  lineItems: readonly { unitPrice: string | number }[],
) {
  return lineItems.some(
    (line) =>
      !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) <= 0,
  )
    ? "Enter a unit price greater than zero for every selected service."
    : null;
}

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
  const problems: string[] = [];
  if (missing.length)
    problems.push(`To mark this proposal Ready, add: ${missing.join(", ")}.`);
  const priceProblem = proposalPriceProblem(input.lineItems);
  if (priceProblem) problems.push(priceProblem);
  if (
    input.total !== undefined &&
    (!Number.isFinite(input.total) || input.total <= 0)
  )
    problems.push(
      "The total investment must be greater than zero. Review the prices and discount.",
    );
  return problems.length
    ? `${problems.join(" ")} Your edits have not been discarded. You can still save your work as Draft.`
    : null;
}
