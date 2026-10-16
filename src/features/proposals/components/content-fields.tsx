"use client";

import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { ProposalAiDraftOutput } from "@/lib/validation/proposal-ai";
import type { ProposalCopy } from "@/lib/i18n/proposals";
import { fillEmptyProposalCopy } from "../sales-content";

const EditingContext = createContext({ dirty: false, markDirty: () => {} });

export function ProposalEditingGuard({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return (
    <EditingContext.Provider value={{ dirty, markDirty: () => setDirty(true) }}>
      {children}
    </EditingContext.Provider>
  );
}

export function ProposalEditForm({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action: (form: FormData) => Promise<void>;
  className: string;
}) {
  const { markDirty } = useContext(EditingContext);
  return (
    <form action={action} className={className} onChangeCapture={markDirty}>
      {children}
    </form>
  );
}

export function ProposalAiSubmitButton({
  saveFirstLabel,
  ...props
}: ComponentProps<typeof PendingSubmitButton> & { saveFirstLabel: string }) {
  const { dirty } = useContext(EditingContext);
  return (
    <>
      <PendingSubmitButton {...props} disabled={props.disabled || dirty} />
      {dirty && (
        <p role="status" className="mt-2 max-w-sm text-xs text-muted">
          {saveFirstLabel}
        </p>
      )}
    </>
  );
}

export function ProposalContentFields({
  initial,
  suggestion,
  copy,
}: {
  initial: ProposalAiDraftOutput;
  suggestion: ProposalAiDraftOutput | null;
  copy: ProposalCopy;
}) {
  const [values, setValues] = useState(initial);
  const [applied, setApplied] = useState(false);
  const { markDirty } = useContext(EditingContext);
  const hasEmpty = Object.values(values).some((value) => !value.trim());
  return (
    <div className="space-y-4 md:col-span-2">
      <div className="space-y-2 border-s-2 border-accent ps-3">
        <button
          type="button"
          className="button-secondary"
          disabled={!suggestion || !hasEmpty}
          onClick={() => {
            if (!suggestion) return;
            setValues((current) => fillEmptyProposalCopy(current, suggestion));
            markDirty();
            setApplied(true);
          }}
        >
          {copy.suggestCopy}
        </button>
        <p className="text-xs text-muted" role={applied ? "status" : undefined}>
          {applied
            ? copy.suggestionApplied
            : suggestion
              ? copy.contentReview
              : copy.contentUnavailable}
        </p>
      </div>
      {(
        [
          ["summary", copy.summary, 8, 4000],
          ["scope", copy.scope, 8, 8000],
          ["nextStep", copy.nextStep, 3, 1000],
        ] as const
      ).map(([field, label, rows, maxLength]) => (
        <label className="block" key={field} htmlFor={`proposal-${field}`}>
          <span className="text-sm font-medium text-ink">{label}</span>
          <textarea
            id={`proposal-${field}`}
            name={field}
            dir="auto"
            value={values[field]}
            onChange={(event) => {
              markDirty();
              setValues((current) => ({
                ...current,
                [field]: event.target.value,
              }));
            }}
            rows={rows}
            maxLength={maxLength}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
      ))}
    </div>
  );
}
