import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { Audit } from "@/domain/audits/types";
import type {
  Opportunity,
  OpportunityAiInsight,
} from "@/domain/opportunities/types";
import type { AgencyService } from "@/domain/services/types";
import { startProspectAuditAction } from "@/features/audits/actions";
import { listAuditsForAgency } from "@/features/audits/data";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgencyForUser } from "@/features/agencies/data";
import { generateOpportunityAiInsightAction } from "@/features/opportunities/ai/actions";
import { listOpportunityAiInsightsForAgency } from "@/features/opportunities/ai/data";
import { generateAuditOpportunitiesAction } from "@/features/opportunities/actions";
import { listOpportunitiesForAgency } from "@/features/opportunities/data";
import {
  createProspectAction,
  deleteProspectAction,
} from "@/features/prospects/actions";
import { ProspectForm } from "@/features/prospects/components/prospect-form";
import { listProspects } from "@/features/prospects/data";
import { listAgencyServices } from "@/features/services/data";

type ProspectsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function ProspectsPage({
  searchParams,
}: ProspectsPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Prospects</h1>
          <p className="mt-2 text-sm text-muted">
            Create your agency profile before adding prospects.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Create agency profile
        </Link>
      </div>
    );
  }

  const [prospects, audits, opportunities, agencyServices, aiInsights] =
    await Promise.all([
      listProspects(agency.id),
      listAuditsForAgency(agency.id),
      listOpportunitiesForAgency(agency.id),
      listAgencyServices(agency.id),
      listOpportunityAiInsightsForAgency(agency.id),
    ]);
  const latestAuditByProspect = getLatestAuditByProspect(audits);
  const opportunitiesByAudit = groupOpportunitiesByAudit(opportunities);
  const servicesById = new Map(
    agencyServices.map((service) => [service.id, service]),
  );
  const aiInsightsByOpportunityId = new Map(
    aiInsights.map((insight) => [insight.opportunityId, insight]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Prospects</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Store target businesses and run deterministic website analysis.
        </p>
      </div>

      <FeedbackMessage error={params.error} success={params.success} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold text-ink">Add prospect</h2>
        <ProspectForm
          action={createProspectAction}
          submitLabel="Add prospect"
          pendingLabel="Adding..."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Prospect list</h2>
        {prospects.length === 0 ? (
          <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">
            No prospects yet. Add a business above to run your first website
            analysis.
          </div>
        ) : (
          <div className="space-y-4">
            {prospects.map((prospect) => {
              const deleteAction = deleteProspectAction.bind(null, prospect.id);
              const analyzeAction = startProspectAuditAction.bind(
                null,
                prospect.id,
              );
              const latestAudit = latestAuditByProspect.get(prospect.id);
              const auditIsActive = isAuditActive(latestAudit);
              const auditOpportunities = latestAudit
                ? (opportunitiesByAudit.get(latestAudit.id) ?? [])
                : [];
              const generateAction = latestAudit
                ? generateAuditOpportunitiesAction.bind(null, latestAudit.id)
                : null;

              return (
                <article
                  key={prospect.id}
                  className="rounded-md border border-border bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-ink">
                        {prospect.businessName}
                      </h3>
                      <a
                        href={prospect.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-words text-sm font-medium text-accent"
                      >
                        {prospect.websiteUrl}
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={analyzeAction}>
                        <PendingSubmitButton
                          label={
                            auditIsActive ? "Analysis in progress" : "Analyze"
                          }
                          pendingLabel="Analyzing..."
                          disabled={auditIsActive}
                          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </form>
                      <Link
                        href={`/dashboard/prospects/${prospect.id}/edit`}
                        className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-ink"
                      >
                        Edit
                      </Link>
                      <form action={deleteAction}>
                        <PendingSubmitButton
                          label="Delete"
                          pendingLabel="Deleting..."
                          className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </form>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <MetadataItem
                      label="Contact"
                      value={
                        prospect.contactName ??
                        prospect.contactEmail ??
                        "Not set"
                      }
                    />
                    <MetadataItem
                      label="Latest audit"
                      value={
                        latestAudit
                          ? `${formatAuditStatus(latestAudit.status)}${
                              latestAudit.completedAt
                                ? ` on ${formatDate(latestAudit.completedAt)}`
                                : ""
                            }`
                          : "Not analyzed"
                      }
                    />
                    <MetadataItem
                      label="Opportunities"
                      value={`${auditOpportunities.length} ranked`}
                    />
                  </div>

                  {prospect.notes ? (
                    <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm text-muted">
                      {prospect.notes}
                    </p>
                  ) : null}

                  <div className="mt-5 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                    <AuditSummary
                      audit={latestAudit}
                      generateAction={generateAction}
                    />
                    <OpportunityList
                      opportunities={auditOpportunities}
                      servicesById={servicesById}
                      aiInsightsByOpportunityId={aiInsightsByOpportunityId}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 break-words text-sm text-ink">{value}</p>
    </div>
  );
}

function AuditSummary({
  audit,
  generateAction,
}: {
  audit: Audit | undefined;
  generateAction: (() => Promise<void>) | null;
}) {
  if (!audit) {
    return (
      <p className="text-xs text-muted">
        No stored audit yet. Run an analysis to generate website signals.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">
            Latest audit
          </p>
          <p className="mt-1 text-sm text-ink">
            {formatAuditStatus(audit.status)}
            {audit.completedAt ? ` on ${formatDate(audit.completedAt)}` : ""}
          </p>
        </div>
        {audit.status === "completed" && generateAction ? (
          <form action={generateAction}>
            <PendingSubmitButton
              label="Generate opportunities"
              pendingLabel="Generating..."
              className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </form>
        ) : null}
      </div>
      {isAuditActive(audit) ? (
        <p className="mt-2 text-xs text-muted">
          Analysis is running. New analysis requests are blocked until this
          audit finishes.
        </p>
      ) : null}
      {audit.status === "failed" && audit.errorMessage ? (
        <p className="mt-2 text-xs text-red-700">{audit.errorMessage}</p>
      ) : null}
    </div>
  );
}

function OpportunityList({
  opportunities,
  servicesById,
  aiInsightsByOpportunityId,
}: {
  opportunities: Opportunity[];
  servicesById: Map<string, AgencyService>;
  aiInsightsByOpportunityId: Map<string, OpportunityAiInsight>;
}) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-md border border-border bg-white p-4 text-sm text-muted">
        No ranked opportunities yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase text-muted">
          Ranked opportunities
        </p>
        <p className="mt-1 text-sm text-muted">
          Deterministic findings are separated from AI sales insight text.
        </p>
      </div>
      {opportunities.map((opportunity, index) => {
        const service = opportunity.agencyServiceId
          ? servicesById.get(opportunity.agencyServiceId)
          : null;
        const aiInsight = aiInsightsByOpportunityId.get(opportunity.id);
        const generateAiInsightAction = generateOpportunityAiInsightAction.bind(
          null,
          opportunity.id,
        );

        return (
          <div
            key={opportunity.id}
            className="rounded-md border border-border bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {index + 1}. {opportunity.title}
                </p>
                <p className="mt-1 max-w-2xl text-xs text-muted">
                  {opportunity.shortDescription}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-muted">
                  {opportunity.priority}
                </span>
                <span className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-muted">
                  {opportunity.confidence}
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-xs font-semibold uppercase text-muted">
                  Mapped service
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {service ? service.name : "No matching active service"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-xs font-semibold uppercase text-muted">
                  Deterministic evidence
                </p>
                <ul className="mt-2 space-y-2 text-xs text-muted">
                  {opportunity.evidence.map((item, evidenceIndex) => (
                    <li
                      key={`${opportunity.id}-${item.signal}-${evidenceIndex}`}
                    >
                      <span className="font-medium text-ink">
                        {item.signal}
                      </span>
                      : {item.details} Observed{" "}
                      {formatEvidenceValue(item.observed_value)} on {item.scope}
                      .
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <AiInsightPanel
              insight={aiInsight}
              generateAction={generateAiInsightAction}
            />
          </div>
        );
      })}
    </div>
  );
}

function AiInsightPanel({
  insight,
  generateAction,
}: {
  insight: OpportunityAiInsight | undefined;
  generateAction: () => Promise<void>;
}) {
  const hasInsightContent = Boolean(
    insight?.salesSummary ||
    insight?.whyItMatters ||
    insight?.clientFacingExplanation ||
    insight?.agencyTalkingPoints.length ||
    insight?.recommendedNextStep,
  );

  if (insight?.status === "generating") {
    return (
      <div className="mt-3 rounded-md border border-border bg-surface p-3 text-xs text-muted">
        <p>AI insight generation is in progress.</p>
        {hasInsightContent ? (
          <div className="mt-3 space-y-3">
            <AiInsightContent insight={insight} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted">
          AI sales insight
        </p>
        <form action={generateAction}>
          <PendingSubmitButton
            label={
              insight?.status === "completed"
                ? "Regenerate AI insight"
                : insight?.status === "failed"
                  ? "Retry AI insight"
                  : "Generate AI insight"
            }
            pendingLabel={
              insight?.status === "failed" ? "Retrying..." : "Generating..."
            }
            className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
        </form>
      </div>

      {insight?.status === "failed" ? (
        <p className="mt-2 text-xs text-red-700">
          {insight.errorMessage ?? "AI insight generation failed."}
        </p>
      ) : null}

      {hasInsightContent && insight ? (
        <div className="mt-3 space-y-3 text-xs">
          <AiInsightContent insight={insight} />
        </div>
      ) : null}
    </div>
  );
}

function AiInsightContent({ insight }: { insight: OpportunityAiInsight }) {
  return (
    <>
      <InsightField label="Sales Summary" value={insight.salesSummary} />
      <InsightField label="Why It Matters" value={insight.whyItMatters} />
      <InsightField
        label="Client-Facing Explanation"
        value={insight.clientFacingExplanation}
      />
      {insight.agencyTalkingPoints.length > 0 ? (
        <div>
          <p className="font-semibold text-ink">Agency Talking Points</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
            {insight.agencyTalkingPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <InsightField
        label="Recommended Next Step"
        value={insight.recommendedNextStep}
      />
    </>
  );
}

function InsightField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="font-semibold text-ink">{label}</p>
      <p className="mt-1 text-muted">{value}</p>
    </div>
  );
}

function getLatestAuditByProspect(audits: Audit[]) {
  const map = new Map<string, Audit>();

  for (const audit of audits) {
    if (!map.has(audit.prospectId)) {
      map.set(audit.prospectId, audit);
    }
  }

  return map;
}

function groupOpportunitiesByAudit(opportunities: Opportunity[]) {
  const map = new Map<string, Opportunity[]>();

  for (const opportunity of opportunities) {
    const current = map.get(opportunity.auditId) ?? [];
    current.push(opportunity);
    map.set(opportunity.auditId, current);
  }

  return map;
}

function formatAuditStatus(status: Audit["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isAuditActive(audit: Audit | undefined) {
  return audit?.status === "pending" || audit?.status === "running";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEvidenceValue(value: unknown) {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }

  return JSON.stringify(value) ?? "unknown";
}
