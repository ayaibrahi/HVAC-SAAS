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
import { getNextDashboardAction } from "@/features/dashboard/next-action";
import {
  EmptyState,
  MetricDisplay,
  PageHeader,
  SectionHeading,
  StatusLabel,
} from "@/components/workspace-ui";
import type { DashboardOverviewData } from "@/features/dashboard/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function websiteLabel(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "Website analysis";
  }
}

export function DashboardOverview({ data }: { data: DashboardOverviewData }) {
  const nextAction = getNextDashboardAction(data);
  return (
    <div className="space-y-9">
      <PageHeader
        title="Sales workspace"
        description="Your prospects, website findings, and proposals in one place."
        actions={
          <>
            <Link href="/dashboard/prospects" className="button-primary">
              <Plus size={18} aria-hidden="true" /> Add prospect
            </Link>
          </>
        }
      />
      <section
        aria-label="Workspace totals"
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        <MetricDisplay
          label="Total prospects"
          icon={<Users size={19} aria-hidden="true" />}
          tone="blue"
          value={data.counts.prospects}
          description="Businesses in your workspace"
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label="Completed audits"
          icon={<Globe2 size={19} aria-hidden="true" />}
          value={data.counts.completedAudits}
          description="Completed page analyses"
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label="Available opportunities"
          icon={<Target size={19} aria-hidden="true" />}
          tone="amber"
          value={data.counts.opportunities}
          description="Open or selected findings"
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label="Proposals"
          icon={<FileText size={19} aria-hidden="true" />}
          tone="violet"
          value={data.counts.proposals}
          description="Draft and ready proposals"
          href="/dashboard/proposals"
        />
      </section>
      <section
        aria-labelledby="next-action-title"
        className="flex flex-col justify-between gap-5 border-y border-teal-900/10 bg-teal-50/60 px-5 py-6 sm:flex-row sm:items-center sm:px-6"
      >
        <div className="min-w-0 border-l-2 border-accent pl-4">
          <p className="mb-2 text-xs font-semibold uppercase text-accent">
            Next best action{" "}
            <span aria-hidden="true" className="mx-1">
              /
            </span>{" "}
            {nextAction.context}
          </p>
          <h2 id="next-action-title" className="text-lg font-semibold text-ink">
            {nextAction.title}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            {nextAction.description}
          </p>
        </div>
        <Link
          href={nextAction.href}
          className="button-secondary shrink-0 border-teal-800/20"
        >
          {nextAction.label}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
      <div className="dashboard-activity grid min-w-0 gap-9 xl:grid-cols-2 xl:gap-10">
        <section aria-labelledby="recent-prospects-title" className="min-w-0">
          <SectionHeading
            id="recent-prospects-title"
            title="Recent prospects"
            action={
              <Link
                href="/dashboard/prospects"
                className="text-sm font-semibold text-accent hover:underline"
              >
                View all <span aria-hidden="true">&rarr;</span>
              </Link>
            }
          />
          {data.recentProspects.length === 0 ? (
            <EmptyState
              title="Your next opportunity starts here"
              description="Add your first prospect to begin a website analysis."
              action={
                <Link href="/dashboard/prospects" className="button-secondary">
                  Add a prospect
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
                      href={`/dashboard/prospects/${prospect.id}/edit`}
                      className="activity-link text-sm"
                    >
                      {prospect.business_name}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {websiteLabel(prospect.website_url)}
                    </p>
                  </div>
                  <time
                    dateTime={prospect.created_at}
                    className="ml-auto text-xs text-muted"
                  >
                    {formatDate(prospect.created_at)}
                  </time>
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="recent-proposals-title" className="min-w-0">
          <SectionHeading
            id="recent-proposals-title"
            title="Recent proposals"
            action={
              <Link
                href="/dashboard/proposals"
                className="text-sm font-semibold text-accent hover:underline"
              >
                View all <span aria-hidden="true">&rarr;</span>
              </Link>
            }
          />
          {data.recentProposals.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              description="A completed audit gives you the starting point for a proposal."
              action={
                <Link href="/dashboard/proposals" className="button-secondary">
                  View proposals
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
                      {proposal.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      Updated{" "}
                      <time dateTime={proposal.updated_at}>
                        {formatDate(proposal.updated_at)}
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
          title="Recent analyses"
          action={
            <Link
              href="/dashboard/prospects"
              className="text-sm font-semibold text-accent hover:underline"
            >
              View prospects <span aria-hidden="true">&rarr;</span>
            </Link>
          }
        />
        {data.recentAudits.length === 0 ? (
          <EmptyState
            title="No website analyses yet"
            description="Analyze a prospect's page to find evidence-based sales opportunities."
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
                    {websiteLabel(audit.website_url)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    <time dateTime={audit.created_at}>
                      {formatDate(audit.created_at)}
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
