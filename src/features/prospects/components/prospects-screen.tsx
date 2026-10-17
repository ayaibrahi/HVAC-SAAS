"use client";
import Link from "next/link";
import { useEffect, useRef, type MouseEvent } from "react";
import { revealSavedResults } from "../results-focus";
import { ArrowRight, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/workspace-ui";
import { useInterface } from "@/components/ui-preferences";
import { AddProspectDialog } from "./add-prospect-dialog";
import { ProspectDetails } from "./prospect-details";
import { WorkspaceAction } from "./workspace-controls";
import {
  prospectsListHref,
  scanIsActive,
  type ProspectListData,
  type ProspectWorkspaceData,
  type ProspectFormState,
  type ScanSummary,
} from "../workspace-model";

export function ScanLabel({ scan }: { scan: ScanSummary | null }) {
  const { t } = useInterface();
  const label =
    scan?.verification === "unverified"
      ? t.pUnverified
      : scan
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
  const resultsRef = useRef<HTMLElement>(null);
  const requestedResult = useRef<string | null>(null);
  useEffect(() => {
    if (selected?.prospect.id === requestedResult.current) {
      revealSavedResults(resultsRef.current);
      requestedResult.current = null;
    }
  }, [selected?.prospect.id, selected?.scan?.id]);
  function viewResults(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (id === selected?.prospect.id) {
      event.preventDefault();
      revealSavedResults(resultsRef.current);
    } else {
      requestedResult.current = id;
    }
  }
  const visible =
    selected && !items.some((item) => item.id === selected.prospect.id)
      ? [{ ...selected.prospect, scan: selected.scan }, ...items]
      : items;
  function href(id: string) {
    return (
      listHref +
      (listHref.includes("?") ? "&" : "?") +
      "prospect=" +
      encodeURIComponent(id) +
      "#website-results"
    );
  }
  return (
    <div className="space-y-8">
      <section className="space-y-5 border-b border-border pb-7">
        <PageHeader title={t.pTitle} description={t.pSimpleDescription} />
        {!problem && (
          <AddProspectDialog
            key={selected?.prospect.id ?? "list"}
            action={addProspect}
            secondary={Boolean(selected)}
          />
        )}
      </section>
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
          {missing && (
            <p role="alert" className="text-sm text-muted">
              {t.pNotFoundDescription}
            </p>
          )}
          {selected && (
            <section
              id="website-results"
              ref={resultsRef}
              tabIndex={-1}
              aria-labelledby="results-name"
              className="scroll-mt-5 space-y-4 border-b border-border pb-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-medium text-accent">
                    {t.pResults}
                  </p>
                  <h2
                    id="results-name"
                    dir="auto"
                    className="text-xl font-semibold"
                  >
                    {selected.prospect.businessName}
                  </h2>
                  <a
                    href={selected.prospect.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="mt-2 block break-all text-xs text-accent"
                  >
                    {selected.prospect.websiteUrl}
                  </a>
                </div>
                <ScanLabel scan={selected.scan} />
              </div>
              <ProspectDetails
                key={selected.prospect.id + ":" + selected.scan?.id}
                data={selected}
                createProposal={createProposal}
              />
            </section>
          )}
          <section aria-labelledby="saved-businesses" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 id="saved-businesses" className="text-base font-semibold">
                {t.pSavedBusinesses}
              </h2>
              <form
                action="/dashboard/prospects"
                method="get"
                className="flex w-full max-w-md gap-2"
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
                    className="inline-flex min-h-11 items-center text-xs text-accent"
                  >
                    {t.pClear}
                  </Link>
                )}
              </form>
            </div>
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
              <div>
                {visible.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4"
                  >
                    <div className="min-w-0 flex-1 basis-64">
                      <h3 className="text-sm font-semibold">
                        <Link
                          href={href(item.id)}
                          onClick={(event) => viewResults(event, item.id)}
                        >
                          <bdi>{item.businessName}</bdi>
                        </Link>
                      </h3>
                      <a
                        href={item.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        dir="ltr"
                        className="mt-1 block break-all text-xs text-muted"
                      >
                        {item.websiteUrl}
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <ScanLabel scan={item.scan} />
                      {item.scan || selected?.prospect.id === item.id ? (
                        <Link
                          href={href(item.id)}
                          onClick={(event) => viewResults(event, item.id)}
                          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent"
                        >
                          {scanIsActive(item.scan) ? t.pViewStatus : t.pView}
                          <ArrowRight
                            size={15}
                            className="rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </Link>
                      ) : (
                        <WorkspaceAction
                          key={item.id}
                          path={`/api/prospects/${item.id}/audits`}
                          label={t.pScan}
                          pendingLabel={t.pScanning}
                          successHref={href(item.id)}
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {data && (data.page > 1 || data.hasNext) && (
              <nav
                aria-label={t.pPage}
                className="flex items-center justify-between gap-3"
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
          </section>
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
