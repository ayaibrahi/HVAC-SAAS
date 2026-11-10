export function proposalReadyProblem(input: {
  summary: string;
  scope: string;
  lineItems: readonly unknown[];
}) {
  const missing = [
    !input.summary.trim() && "Summary",
    !input.scope.trim() && "Scope",
    input.lineItems.length === 0 && "at least one selected service",
  ].filter(Boolean);
  return missing.length
    ? `To mark this proposal Ready, add: ${missing.join(", ")}. Your edits have not been discarded.`
    : null;
}
