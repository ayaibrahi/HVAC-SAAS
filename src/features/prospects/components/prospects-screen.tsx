"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/workspace-ui";
import { useInterface } from "@/components/ui-preferences";
import { AddProspectDialog } from "./add-prospect-dialog";
import { ProspectDetails } from "./prospect-details";
import {
  prospectsListHref,
  type ProspectListData,
  type ProspectWorkspaceData,
  type ProspectFormState,
  type ScanSummary,
} from "../workspace-model";

export function ScanLabel({ scan }: { scan: ScanSummary | null }) {
  const { t } = useInterface();
  const label = scan
    ? {
        pending: t.pQueued,
        running: t.pScanning,
        completed: t.pCompleted,
        failed: t.pFailed,
      }[scan.status]
    : t.pNotScanned;
  return (
    <span
      className={`status-${scan?.status ?? "draft"} inline-block rounded px-2 py-1 text-xs font-medium`}
    >
      {label}
    </span>
  );
}

type Props = {
  data: ProspectListData | null;
  selected: ProspectWorkspaceData | null;
  missing?: boolean;
  problem?: "agency" | "load";
  addProspect: (
    state: ProspectFormState,
    form: FormData,
  ) => Promise<ProspectFormState>;
  createProposal: (form: FormData) => Promise<void>;
};

export function ProspectsScreen({
  data,
  selected,
  missing,
  problem,
  addProspect,
  createProposal,
}: Props) {
  const { t, locale } = useInterface();
  const listHref = prospectsListHref(data?.page ?? 1, data?.query ?? "");
  const items = data?.items ?? [];
  const visible =
    selected && !items.some((item) => item.id === selected.prospect.id)
      ? [{ ...selected.prospect, scan: selected.scan }, ...items]
      : items;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pTitle}
        description={t.pSimpleDescription}
        actions={
          <AddProspectDialog
            key={selected?.prospect.id ?? "list"}
            action={addProspect}
          />
        }
      />
      {problem ? (
        <div role="alert" className="space-y-3 border-s-2 border-accent ps-4">
          <p className="text-sm">
            {problem === "agency" ? t.pAgencyError : t.pLoadErrorDescription}
          </p>
          <Link
            href={problem === "agency" ? "/dashboard/settings" : listHref}
            className="button-secondary"
          >
            {problem === "agency" ? t.pSetup : t.pRetry}
          </Link>
        </div>
      ) : (
        <>
          <form
            action="/dashboard/prospects"
            method="get"
            className="flex max-w-lg gap-2"
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t.pSearch}</span>
              <input
                key={data?.query}
                name="q"
                type="search"
                maxLength={100}
                defaultValue={data?.query}
                placeholder={t.pSearch}
                className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              title={t.pSearchButton}
              aria-label={t.pSearchButton}
              className="button-secondary !px-3"
            >
              <Search size={18} aria-hidden="true" />
            </button>
            {data?.query && (
              <Link
                href="/dashboard/prospects"
                className="inline-flex min-h-11 items-center text-xs font-medium text-accent"
              >
                {t.pClear}
              </Link>
            )}
          </form>
          {missing && (
            <p
              role="alert"
              className="border-s-2 border-accent ps-3 text-sm text-muted"
            >
              {t.pNotFoundDescription}
            </p>
          )}
          {!visible.length ? (
            <EmptyState
              title={
                data?.query || (data?.page ?? 1) > 1
                  ? t.pNoResults
                  : t.pEmptyTitle
              }
              description={
                data?.query || (data?.page ?? 1) > 1
                  ? t.pNoResultsDescription
                  : t.pEmptyDescription
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.map((item) => {
                const expanded = selected?.prospect.id === item.id;
                const href = expanded
                  ? listHref
                  : listHref +
                    (listHref.includes("?") ? "&" : "?") +
                    "prospect=" +
                    encodeURIComponent(item.id) +
                    "#prospect-" +
                    item.id;
                return (
                  <article
                    key={item.id}
                    id={"prospect-" + item.id}
                    className="scroll-mt-5 rounded-md border border-border bg-panel p-4 shadow-sm sm:p-5"
                  >
                    <div className={expanded ? "mb-5" : ""}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 dir="auto" className="text-base font-semibold">
                            {item.businessName}
                          </h2>
                          <a
                            href={item.websiteUrl}
                            dir="ltr"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-start text-xs text-accent"
                          >
                            {item.websiteUrl}
                          </a>
                        </div>
                        <Link
                          href={href}
                          scroll={false}
                          aria-expanded={expanded}
                          aria-controls={
                            expanded ? "prospect-details" : undefined
                          }
                          className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-ink hover:bg-surface"
                        >
                          {expanded ? t.pClose : t.pView}
                          {expanded ? (
                            <ChevronUp size={16} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={16} aria-hidden="true" />
                          )}
                        </Link>
                      </div>
                      <div className="mt-3">
                        <ScanLabel scan={item.scan} />
                      </div>
                    </div>
                    {expanded && (
                      <div id="prospect-details">
                        <ProspectDetails
                          key={selected.prospect.id}
                          data={selected}
                          createProposal={createProposal}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {data && (data.page > 1 || data.hasNext) && (
            <nav
              aria-label={t.pPage}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-xs text-muted">
                {t.pPage} {data.page.toLocaleString(locale)}
              </p>
              <div className="flex gap-2">
                {data.page > 1 && (
                  <Link
                    href={prospectsListHref(data.page - 1, data.query)}
                    className="button-secondary"
                  >
                    <ChevronLeft
                      size={16}
                      className="rtl:rotate-180"
                      aria-hidden="true"
                    />
                    {t.pPrevious}
                  </Link>
                )}
                {data.hasNext && (
                  <Link
                    href={prospectsListHref(data.page + 1, data.query)}
                    className="button-secondary"
                  >
                    {t.pNext}
                    <ChevronRight
                      size={16}
                      className="rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export function ProspectsLoading() {
  const { t } = useInterface();
  return (
    <p role="status" className="py-8 text-sm text-muted">
      {t.pLoading}
    </p>
  );
}
export function ProspectsError({ retry }: { retry: () => void }) {
  const { t } = useInterface();
  return (
    <div role="alert" className="space-y-4 py-8">
      <h1 className="text-xl font-semibold">{t.pLoadError}</h1>
      <p className="text-sm text-muted">{t.pLoadErrorDescription}</p>
      <button type="button" onClick={retry} className="button-secondary">
        {t.pRetry}
      </button>
    </div>
  );
}
