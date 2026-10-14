"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { useInterface } from "@/components/ui-preferences";
import { getDrawerFocusTarget } from "@/components/dashboard/navigation";
import {
  requestWorkspaceAction,
  type WorkspaceRequestResult,
} from "../workspace-request";

export function WorkspaceAction({
  path,
  label,
  pendingLabel,
  disabled = false,
  primary = false,
  icon,
  successHref,
  expectFindings = false,
  onEmpty,
}: {
  path: string;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  primary?: boolean;
  icon?: ReactNode;
  successHref?: string;
  expectFindings?: boolean;
  onEmpty?: () => void;
}) {
  const router = useRouter();
  const { t } = useInterface();
  const [pending, setPending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [result, setResult] = useState<WorkspaceRequestResult | null>(null);
  const locked = useRef(false);
  const messages = {
    done: t.pDone,
    empty: t.pNoSupportedFindings,
    session: t.pSessionError,
    limit: t.pLimitError,
    busy: t.pBusyError,
    error: t.pActionError,
    unknown: t.pResultUnknown,
  };
  async function run() {
    if (locked.current || disabled) return;
    locked.current = true;
    setPending(true);
    setResult(null);
    try {
      const response = await requestWorkspaceAction(
        path,
        "POST",
        expectFindings,
      );
      setResult(response);
      if (response === "empty") onEmpty?.();
      if (response === "done" && successHref) router.push(successHref);
      // Wait for fresh server state before enabling another request.
      startRefresh(() => router.refresh());
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="min-w-0 space-y-2">
      <button
        type="button"
        disabled={disabled || pending || refreshing || result !== null}
        onClick={run}
        className={primary ? "button-primary" : "button-secondary"}
      >
        {icon}
        {pending ? pendingLabel : label}
      </button>
      <p role="status" className="max-w-md text-xs leading-relaxed text-muted">
        {pending ? pendingLabel : result ? messages[result] : ""}
      </p>
      {result && !pending && !refreshing && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent"
          onClick={() => {
            locked.current = false;
            setResult(null);
            startRefresh(() => router.refresh());
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t.pRefresh}
        </button>
      )}
    </div>
  );
}

export function RefreshWorkspace() {
  const router = useRouter();
  const { t } = useInterface();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
      className="button-secondary"
    >
      <RefreshCw size={16} aria-hidden="true" />
      {pending ? t.pLoading : t.pRefresh}
    </button>
  );
}

export function DeleteProspect({ id, name }: { id: string; name: string }) {
  const { t } = useInterface();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  async function remove() {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    const result = await requestWorkspaceAction(
      `/api/prospects/${id}`,
      "DELETE",
    );
    if (result === "done") {
      router.replace("/dashboard/prospects");
      router.refresh();
      return;
    }
    setFailed(true);
    setPending(false);
    // An uncertain result must be checked before offering another destructive request.
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-[var(--error-text)]"
      >
        <Trash2 size={16} aria-hidden="true" />
        {t.pDelete}
      </button>
      <dialog
        ref={dialog}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not([disabled])",
            ),
          );
          const target = getDrawerFocusTarget(
            controls,
            document.activeElement,
            event.shiftKey,
          );
          if (target || controls.length === 0) {
            event.preventDefault();
            (target ?? event.currentTarget).focus();
          }
        }}
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg border border-border bg-panel p-6 text-ink backdrop:bg-black/50"
      >
        <h2 id="delete-title" className="text-lg font-semibold">
          {t.pDeleteTitle}
        </h2>
        <p dir="auto" className="mt-3 break-words font-medium">
          {name}
        </p>
        <p
          id="delete-description"
          className="mt-3 text-sm leading-relaxed text-muted"
        >
          {t.pDeleteDescription}
        </p>
        <p role="status" className="mt-3 text-sm text-[var(--error-text)]">
          {failed ? t.pResultUnknown : pending ? t.pDeleting : ""}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            ref={cancel}
            disabled={pending}
            type="button"
            className="button-secondary"
            onClick={() => dialog.current?.close()}
          >
            {t.pCancel}
          </button>
          <button
            disabled={pending || failed || refreshing}
            onClick={remove}
            type="button"
            className="button-secondary !text-[var(--error-text)]"
          >
            <Trash2 size={16} aria-hidden="true" />
            {pending ? t.pDeleting : t.pDelete}
          </button>
          {failed && (
            <button
              type="button"
              className="button-secondary"
              disabled={refreshing}
              onClick={() => {
                startRefresh(() => router.refresh());
                locked.current = false;
                setFailed(false);
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {t.pRefresh}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
