"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useInterface } from "@/components/ui-preferences";
import { getDrawerFocusTarget } from "@/components/dashboard/navigation";
import {
  prospectHref,
  type ProspectField,
  type ProspectFormState,
} from "../workspace-model";

export function AddProspectDialog({
  action,
}: {
  action: (
    state: ProspectFormState,
    form: FormData,
  ) => Promise<ProspectFormState>;
}) {
  const { t } = useInterface();
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    first = useRef<HTMLInputElement>(null),
    feedback = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const [state, submit, pending] = useActionState(action, {});
  const [values, setValues] = useState({
    businessName: "",
    websiteUrl: "",
    contactName: "",
    contactEmail: "",
    notes: "",
  });
  useEffect(() => {
    if (!pending) lock.current = false;
  }, [pending, state]);
  useEffect(() => {
    if (state.error || state.duplicate) feedback.current?.focus();
  }, [state]);
  const errors = {
    businessName: t.pNameError,
    websiteUrl: t.pWebsiteError,
    contactName: t.pContactNameError,
    contactEmail: t.pContactEmailError,
    notes: t.pNotesError,
  };
  const close = () => {
    if (!pending) dialog.current?.close();
  };
  function field(name: ProspectField, label: string, maxLength?: number) {
    const invalid = state.fields?.includes(name);
    return (
      <div>
        <label htmlFor={name} className="mb-2 block text-sm font-medium">
          {label}
        </label>
        <input
          id={name}
          ref={name === "businessName" ? first : undefined}
          name={name}
          type={name === "contactEmail" ? "email" : "text"}
          dir={["websiteUrl", "contactEmail"].includes(name) ? "ltr" : "auto"}
          value={values[name]}
          onChange={(e) => setValues({ ...values, [name]: e.target.value })}
          maxLength={maxLength}
          required={name === "businessName" || name === "websiteUrl"}
          aria-invalid={invalid || undefined}
          aria-describedby={
            invalid
              ? name + "-error"
              : name === "websiteUrl"
                ? "website-help"
                : undefined
          }
          className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
        />
        {invalid && (
          <p
            id={name + "-error"}
            className="mt-2 text-sm text-[var(--error-text)]"
          >
            {errors[name]}
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      <button
        ref={trigger}
        className="button-primary"
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          first.current?.focus();
        }}
      >
        <Plus size={17} aria-hidden="true" />
        {t.pAdd}
      </button>
      <dialog
        ref={dialog}
        tabIndex={-1}
        aria-labelledby="add-prospect-title"
        onClose={() => trigger.current?.focus()}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], summary",
            ),
          ).filter(
            (el) =>
              el.tabIndex >= 0 &&
              el.getClientRects().length > 0 &&
              !el.closest("fieldset[disabled]"),
          );
          const target = getDrawerFocusTarget(
            controls,
            document.activeElement,
            e.shiftKey,
          );
          if (target || !controls.length) {
            e.preventDefault();
            (target ?? e.currentTarget).focus();
          }
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-panel p-5 text-ink shadow-xl backdrop:bg-black/50 sm:p-6"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id="add-prospect-title" className="text-xl font-semibold">
            {t.pAdd}
          </h2>
          <button
            type="button"
            disabled={pending}
            onClick={close}
            title={t.pClose}
            aria-label={t.pClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form
          action={submit}
          noValidate
          onSubmit={(e) => {
            if (lock.current) e.preventDefault();
            else lock.current = true;
          }}
          className="space-y-5"
        >
          {(state.error || state.duplicate) && (
            <div
              ref={feedback}
              tabIndex={-1}
              role="alert"
              className="border-s-2 border-accent ps-3 text-sm"
            >
              <p className="font-medium">
                {state.duplicate
                  ? t.pDuplicateTitle
                  : {
                      invalid: t.pInvalid,
                      save: t.pSaveError,
                      session: t.pSessionError,
                      agency: t.pAgencyError,
                    }[state.error!]}
              </p>
              {state.duplicate && (
                <>
                  <Link
                    href={prospectHref(state.duplicate.id)}
                    onClick={close}
                    className="my-3 inline-flex min-h-11 items-center font-medium text-accent"
                  >
                    <bdi>{state.duplicate.name}</bdi>
                  </Link>
                  <label className="flex items-start gap-2">
                    <input
                      key={values.websiteUrl}
                      type="checkbox"
                      name="allowDuplicate"
                      value="yes"
                      className="mt-1 h-4 w-4"
                    />
                    {t.pDuplicateAllow}
                  </label>
                </>
              )}
              {state.error === "agency" && (
                <Link
                  href="/dashboard/settings"
                  onClick={close}
                  className="mt-3 block text-accent"
                >
                  {t.pSetup}
                </Link>
              )}
              {state.error === "session" && (
                <Link
                  href="/sign-in"
                  onClick={close}
                  className="mt-3 block text-accent"
                >
                  {t.pSignIn}
                </Link>
              )}
            </div>
          )}
          <fieldset disabled={pending} className="min-w-0 space-y-5">
            {field("businessName", t.pName, 160)}
            <div>
              {field("websiteUrl", t.pWebsite)}
              <p
                id="website-help"
                className="mt-2 text-xs leading-relaxed text-muted"
              >
                {t.pWebsiteHelp}
              </p>
            </div>
            <details
              open={
                state.fields?.some((name) =>
                  ["contactName", "contactEmail", "notes"].includes(name),
                ) || undefined
              }
            >
              <summary className="cursor-pointer py-2 text-sm text-muted">
                {t.pOptional}
              </summary>
              <div className="mt-3 space-y-4">
                {field("contactName", t.pContactName, 120)}
                {field("contactEmail", t.pContactEmail)}
                <label className="block text-sm">
                  <span className="mb-2 block">{t.pNotes}</span>
                  <textarea
                    name="notes"
                    rows={3}
                    dir="auto"
                    maxLength={2000}
                    value={values.notes}
                    onChange={(e) =>
                      setValues({ ...values, notes: e.target.value })
                    }
                    aria-invalid={state.fields?.includes("notes") || undefined}
                    aria-describedby={
                      state.fields?.includes("notes")
                        ? "notes-error"
                        : undefined
                    }
                    className="w-full rounded-md border border-border bg-panel p-3"
                  />
                </label>
                {state.fields?.includes("notes") && (
                  <p
                    id="notes-error"
                    className="text-sm text-[var(--error-text)]"
                  >
                    {t.pNotesError}
                  </p>
                )}
              </div>
            </details>
          </fieldset>
          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            <button disabled={pending} className="button-primary" type="submit">
              {pending ? t.pCreating : t.pAdd}
            </button>
            <button
              disabled={pending}
              type="button"
              onClick={close}
              className="button-secondary"
            >
              {t.pCancel}
            </button>
          </div>
          <p role="status" className="sr-only">
            {pending ? t.pCreating : ""}
          </p>
        </form>
      </dialog>
    </>
  );
}
