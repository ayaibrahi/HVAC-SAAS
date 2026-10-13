import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
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
          className="text-muted group-hover:text-accent"
        />
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">
        {value.toLocaleString("en-US")}
      </p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </Link>
  );
}

const statusLabels = {
  pending: { label: "Queued", className: "bg-amber-50 text-amber-900" },
  running: { label: "Analyzing", className: "bg-sky-50 text-sky-900" },
  completed: {
    label: "Completed",
    className: "bg-emerald-50 text-emerald-900",
  },
  failed: { label: "Failed", className: "bg-red-50 text-red-800" },
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-900" },
} as const;

export function StatusLabel({ status }: { status: keyof typeof statusLabels }) {
  const item = statusLabels[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-2 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.label}
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
