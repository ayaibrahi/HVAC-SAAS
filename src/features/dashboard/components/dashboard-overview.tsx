import Link from "next/link";
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
  return (
    <div className="space-y-8">
      <PageHeader
        title="Sales workspace"
        description="Your prospects, website findings, and proposals in one place."
        actions={
          <>
            <Link href="/dashboard/services" className="button-secondary">
              Service catalog
            </Link>
            <Link href="/dashboard/prospects" className="button-primary">
              Add prospect <span aria-hidden="true">&rarr;</span>
            </Link>
          </>
        }
      />
      <section
        aria-label="Workspace totals"
        className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-4"
      >
        <MetricDisplay
          label="Total prospects"
          value={data.counts.prospects}
          description="Businesses in your workspace"
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label="Completed audits"
          value={data.counts.completedAudits}
          description="Completed page analyses"
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label="Available opportunities"
          value={data.counts.opportunities}
          description="Open or selected findings"
          href="/dashboard/prospects"
        />
        <MetricDisplay
          label="Proposals"
          value={data.counts.proposals}
          description="Draft and ready proposals"
          href="/dashboard/proposals"
        />
      </section>

      <div className="grid min-w-0 gap-8 xl:grid-cols-2 xl:gap-10">
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
                    className="text-xs text-muted"
                  >
                    {formatDate(prospect.created_at)}
                  </time>
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
      <section aria-labelledby="recent-analyses-title" className="min-w-0">
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
          <ul>
            {data.recentAudits.map((audit) => (
              <li key={audit.id} className="activity-row">
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
