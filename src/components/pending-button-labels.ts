export function getPendingLabel(input: {
  isPending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return input.isPending ? input.pendingLabel : input.label;
}
