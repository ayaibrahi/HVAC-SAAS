"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { FeedbackMessage } from "@/components/feedback-message";
import type { ProposalAiDraftOutput } from "@/lib/validation/proposal-ai";
import type { ProposalCopy } from "@/lib/i18n/proposals";
import { fillEmptyProposalCopy } from "../sales-content";

const EditingContext = createContext<{
  dirty: boolean;
  markDirty: () => void;
  saving: boolean;
  setSaving: (value: boolean) => void;
}>({
  dirty: false,
  markDirty: () => {},
  saving: false,
  setSaving: () => {},
});

export function ProposalEditingGuard({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <EditingContext.Provider
      value={{ dirty, markDirty: () => setDirty(true), saving, setSaving }}
    >
      {children}
    </EditingContext.Provider>
  );
}

export function ProposalEditForm({
  children,
  action,
  className,
  copy,
  fallbackAction,
  successHref,
}: {
  children: ReactNode;
  action: (form: FormData) => Promise<{ error?: string; saved?: true }>;
  className: string;
  copy: ProposalCopy;
  fallbackAction?: (form: FormData) => Promise<void>;
  successHref?: string;
}) {
  const { markDirty, setSaving } = useContext(EditingContext);
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error?: string; saved?: true }>({});
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice.error) errorRef.current?.focus();
  }, [notice]);
  return (
    <form
      action={fallbackAction}
      method={fallbackAction ? undefined : "post"}
      onChangeCapture={markDirty}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy.current) return;
        const form = new FormData(event.currentTarget);
        markDirty();
        busy.current = true;
        setPending(true);
        setSaving(true);
        setNotice({});
        try {
          const result = await action(form);
          setNotice(result);
          if (result.saved) {
            if (successHref) router.replace(successHref);
            router.refresh();
          }
        } catch {
          setNotice({ error: copy.saveUncertain });
        } finally {
          busy.current = false;
          setPending(false);
          setSaving(false);
        }
      }}
    >
      {notice.error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mb-4 text-sm text-muted"
        >
          {copy.editsPreserved} {notice.error}
        </p>
      )}
      {notice.saved && (
        <p role="status" className="mb-4 text-sm">
          {copy.saved}
        </p>
      )}
      {pending && (
        <p role="status" className="mb-4 text-sm">
          {copy.saving}
        </p>
      )}
      <fieldset disabled={pending} className={`min-w-0 ${className}`}>
        {children}
      </fieldset>
    </form>
  );
}

export function ProposalActionFeedback(
  props: ComponentProps<typeof FeedbackMessage>,
) {
  const { dirty, saving } = useContext(EditingContext);
  return dirty || saving ? null : <FeedbackMessage {...props} />;
}

export function ProposalGuardedSubmitButton({
  saveFirstLabel,
  ...props
}: ComponentProps<typeof PendingSubmitButton> & { saveFirstLabel: string }) {
  const { dirty, saving } = useContext(EditingContext);
  return (
    <>
      <PendingSubmitButton
        {...props}
        disabled={props.disabled || dirty || saving}
      />
      {dirty && (
        <p role="status" className="mt-2 max-w-sm text-xs text-muted">
          {saveFirstLabel}
        </p>
      )}
    </>
  );
}

export const ProposalAiSubmitButton = ProposalGuardedSubmitButton;

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
