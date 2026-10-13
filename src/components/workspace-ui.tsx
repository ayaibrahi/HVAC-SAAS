"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useInterface } from "@/components/ui-preferences";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold leading-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function MetricDisplay({
  label,
  value,
  href,
  description,
  icon,
  tone = "teal",
}: {
  label: string;
  value: number;
  href: string;
  description: string;
  icon?: ReactNode;
  tone?: "teal" | "blue" | "amber" | "violet";
}) {
  const { locale } = useInterface();
  return (
    <Link
      href={href}
      className={`metric-display metric-${tone} group block min-w-0 rounded-lg border border-border bg-white p-5 sm:p-6`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="metric-icon">{icon}</span>
        <ArrowUpRight
          size={16}
          aria-hidden="true"
          className="text-muted group-hover:text-accent rtl:-scale-x-100"
        />
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">
        {value.toLocaleString(locale === "ar" ? "ar-u-nu-arab" : "en-US")}
      </p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </Link>
  );
}

const statusKeys = {
  pending: { label: "queued", className: "status-pending" },
  running: { label: "analyzing", className: "status-running" },
  completed: { label: "completed", className: "status-completed" },
  failed: { label: "failed", className: "status-failed" },
  draft: { label: "draft", className: "status-draft" },
  ready: { label: "ready", className: "status-ready" },
} as const;

export function StatusLabel({ status }: { status: keyof typeof statusKeys }) {
  const { t, locale } = useInterface();
  return (
    <span
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${statusKeys[status].className} inline-flex shrink-0 items-center rounded px-2 py-1 text-xs font-semibold`}
    >
      {t[statusKeys[status].label]}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-8">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
