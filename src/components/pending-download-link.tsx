"use client";

import { useEffect, useRef, useState } from "react";
import { pdfDownloadTimeoutMs, requestPdfDownload } from "@/lib/pdf-download";

export function PendingDownloadLink({
  href,
  label,
  pendingLabel,
  className,
  errorLabel,
}: {
  href: string;
  label: string;
  pendingLabel: string;
  className: string;
  errorLabel: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <a
        href={href}
        className={className}
        aria-busy={isPending}
        aria-disabled={isPending}
        onClick={async (event) => {
          event.preventDefault();
          if (controller.current) return;
          const active = new AbortController();
          controller.current = active;
          const timeout = setTimeout(
            () => active.abort(),
            pdfDownloadTimeoutMs,
          );
          setIsPending(true);
          setFailed(false);
          try {
            const { blob, filename } = await requestPdfDownload(
              href,
              active.signal,
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            try {
              link.click();
            } finally {
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
          } catch {
            setFailed(true);
          } finally {
            active.abort();
            clearTimeout(timeout);
            controller.current = null;
            setIsPending(false);
          }
        }}
      >
        {isPending ? pendingLabel : label}
      </a>
      {failed && (
        <span
          role="alert"
          className="max-w-sm text-xs text-[var(--error-text)]"
        >
          {errorLabel}
        </span>
      )}
    </span>
  );
}
