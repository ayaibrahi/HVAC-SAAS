"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Globe2,
  ListChecks,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { getLocalizedDashboardAction } from "@/features/dashboard/localized-action";
import { useInterface } from "@/components/ui-preferences";
import { formatInterfaceDate } from "@/lib/ui/preferences";
import {
  EmptyState,
  MetricDisplay,
  PageHeader,
  SectionHeading,
  StatusLabel,
} from "@/components/workspace-ui";
import type { DashboardOverviewData } from "@/features/dashboard/types";

function websiteLabel(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

export function DashboardOverview({ data }: { data: DashboardOverviewData }) {
  const { t, locale } = useInterface();
  const nextAction = getLocalizedDashboardAction(data, locale);
  return (
    <div className="space-y-9">
      <PageHeader
        title={t.salesWorkspace}
        description={t.dashboardDescription}
        actions={
          <>
            <Link href="/dashboard/prospects" className="button-primary">
              <Plus size={18} aria-hidden="true" /> {t.addProspect}
            </Link>
          </>
        }
      />
      <section
        aria-label={t.totals}
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        <MetricDisplay
          label={t.totalProspects}
          icon={<Users size={19} aria-hidden="true" />}
          tone="blue"
          value={data.counts.prospects}
          description={t.prospectCountDescription}
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label={t.completedAudits}
          icon={<Globe2 size={19} aria-hidden="true" />}
          value={data.counts.completedAudits}
          description={t.auditCountDescription}
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label={t.availableOpportunities}
          icon={<Target size={19} aria-hidden="true" />}
          tone="amber"
          value={data.counts.opportunities}
          description={t.opportunityCountDescription}
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label={t.proposals}
          icon={<FileText size={19} aria-hidden="true" />}
          tone="violet"
          value={data.counts.proposals}
          description={t.proposalCountDescription}
          href="/dashboard/proposals"
        />
      </section>
      <section
        aria-labelledby="next-action-title"
        className="next-action-band flex flex-col justify-between gap-5 border-y border-border px-5 py-6 sm:flex-row sm:items-center sm:px-6"
      >
        <div className="min-w-0 border-s-2 border-accent ps-4">
          <p className="mb-2 text-xs font-semibold uppercase text-accent">
            {t.nextAction}{" "}
            <span aria-hidden="true" className="mx-1">
              /
            </span>{" "}
            {nextAction.context}
          </p>
          <h2 id="next-action-title" className="text-lg font-semibold text-ink">
            {nextAction.title}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            <bdi>{nextAction.description}</bdi>
          </p>
        </div>
        <Link
          href={nextAction.href}
          className="button-secondary shrink-0 border-teal-800/20"
        >
          {nextAction.label}
          <ArrowRight size={17} aria-hidden="true" className="rtl:rotate-180" />
        </Link>
      </section>
      <div className="dashboard-activity grid min-w-0 gap-9 xl:grid-cols-2 xl:gap-10">
        <section aria-labelledby="recent-prospects-title" className="min-w-0">
          <SectionHeading
            id="recent-prospects-title"
            title={t.recentProspects}
            action={
              <Link
                href="/dashboard/prospects"
                className="text-sm font-semibold text-accent hover:underline"
              >
                {t.viewAll}{" "}
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="inline rtl:rotate-180"
                />
              </Link>
            }
          />
          {data.recentProspects.length === 0 ? (
            <EmptyState
              title={t.noProspectsTitle}
              description={t.noProspectsDescription}
              action={
                <Link href="/dashboard/prospects" className="button-secondary">
                  {t.addAProspect}
                </Link>
              }
            />
          ) : (
            <ul>
              {data.recentProspects.map((prospect) => (
                <li key={prospect.id} className="activity-row">
                  <span aria-hidden="true" className="activity-monogram">
                    {prospect.business_name.trim().slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/prospects?prospect=${prospect.id}#website-results`}
                      className="activity-link text-sm"
                    >
                      <bdi>{prospect.business_name}</bdi>
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      <bdi dir="ltr">
                        {websiteLabel(prospect.website_url) ||
                          t.websiteAnalysis}
                      </bdi>
                    </p>
                  </div>
                  <time
                    dateTime={prospect.created_at}
                    className="ms-auto text-xs text-muted"
                  >
                    {formatInterfaceDate(prospect.created_at, locale)}
                  </time>
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-muted rtl:rotate-180"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="recent-proposals-title" className="min-w-0">
          <SectionHeading
            id="recent-proposals-title"
            title={t.recentProposals}
            action={
              <Link
                href="/dashboard/proposals"
                className="text-sm font-semibold text-accent hover:underline"
              >
                {t.viewAll}{" "}
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="inline rtl:rotate-180"
                />
              </Link>
            }
          />
          {data.recentProposals.length === 0 ? (
            <EmptyState
              title={t.noProposalsTitle}
              description={t.noProposalsDescription}
              action={
                <Link href="/dashboard/proposals" className="button-secondary">
                  {t.viewProposals}
                </Link>
              }
            />
          ) : (
            <ul>
              {data.recentProposals.map((proposal) => (
                <li key={proposal.id} className="activity-row">
                  <span className="activity-monogram">
                    <FileText size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/proposals/${proposal.id}`}
                      className="activity-link text-sm"
                    >
                      <bdi>{proposal.title}</bdi>
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {t.updated}{" "}
                      <time dateTime={proposal.updated_at}>
                        {formatInterfaceDate(proposal.updated_at, locale)}
                      </time>
                    </p>
                  </div>
                  <StatusLabel status={proposal.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section
        aria-labelledby="recent-analyses-title"
        className="dashboard-activity min-w-0 border-t border-border pt-7"
      >
        <SectionHeading
          id="recent-analyses-title"
          title={t.recentAnalyses}
          action={
            <Link
              href="/dashboard/prospects"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t.viewProspects}{" "}
              <ArrowRight
                size={14}
                aria-hidden="true"
                className="inline rtl:rotate-180"
              />
            </Link>
          }
        />
        {data.recentAudits.length === 0 ? (
          <EmptyState
            title={t.noAnalysesTitle}
            description={t.noAnalysesDescription}
          />
        ) : (
          <ul className="grid gap-x-8 xl:grid-cols-2">
            {data.recentAudits.map((audit) => (
              <li key={audit.id} className="activity-row">
                <span className="activity-monogram">
                  <ListChecks size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    <bdi dir="ltr">
                      {websiteLabel(audit.website_url) || t.websiteAnalysis}
                    </bdi>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    <time dateTime={audit.created_at}>
                      {formatInterfaceDate(audit.created_at, locale)}
                    </time>
                  </p>
                </div>
                <StatusLabel status={audit.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
