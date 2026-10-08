"use client";

import { useFormStatus } from "react-dom";
import { getPendingLabel } from "@/components/pending-button-labels";

type PendingSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
};

export function PendingSubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      className={className}
      disabled={isDisabled}
      aria-disabled={isDisabled}
    >
      {getPendingLabel({ isPending: pending, label, pendingLabel })}
    </button>
  );
}
