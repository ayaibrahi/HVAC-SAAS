import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
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

export default async function ProspectsPage({ searchParams }: ProspectsPageProps) {
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
        <ProspectForm action={createProspectAction} submitLabel="Add prospect" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Prospect list</h2>
        {prospects.length === 0 ? (
          <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">
            No prospects yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Website</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((prospect) => {
                  const deleteAction = deleteProspectAction.bind(null, prospect.id);
                  const analyzeAction = startProspectAuditAction.bind(null, prospect.id);
                  const latestAudit = latestAuditByProspect.get(prospect.id);
                  const auditOpportunities = latestAudit
                    ? opportunitiesByAudit.get(latestAudit.id) ?? []
                    : [];
                  const generateAction = latestAudit
                    ? generateAuditOpportunitiesAction.bind(null, latestAudit.id)
                    : null;

                  return (
                    <tr key={prospect.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{prospect.businessName}</p>
                        {prospect.notes ? (
                          <p className="mt-1 max-w-xl text-muted">{prospect.notes}</p>
                        ) : null}
                        <div className="mt-4 space-y-3">
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
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <a
                          href={prospect.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-accent"
                        >
                          {prospect.websiteUrl}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {prospect.contactName ?? prospect.contactEmail ?? "Not set"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <form action={analyzeAction}>
                            <button className="rounded-md bg-accent px-3 py-2 font-semibold text-white">
                              Analyze
                            </button>
                          </form>
                          <Link
                            href={`/dashboard/prospects/${prospect.id}/edit`}
                            className="rounded-md border border-border px-3 py-2 font-semibold text-ink"
                          >
                            Edit
                          </Link>
                          <form action={deleteAction}>
                            <button className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Latest audit</p>
          <p className="mt-1 text-sm text-ink">
            {formatAuditStatus(audit.status)}
            {audit.completedAt ? ` on ${formatDate(audit.completedAt)}` : ""}
          </p>
        </div>
        {audit.status === "completed" && generateAction ? (
          <form action={generateAction}>
            <button className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white">
              Generate opportunities
            </button>
          </form>
        ) : null}
      </div>
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
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase text-muted">
        Ranked opportunities
      </p>
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
            className="rounded-md border border-border bg-white p-3"
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
                <span className="rounded-md border border-border px-2 py-1 text-muted">
                  {opportunity.priority}
                </span>
                <span className="rounded-md border border-border px-2 py-1 text-muted">
                  {opportunity.confidence}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Service:{" "}
              <span className="font-medium text-ink">
                {service ? service.name : "No matching active service"}
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {opportunity.evidence.map((item, evidenceIndex) => (
                <li key={`${opportunity.id}-${item.signal}-${evidenceIndex}`}>
                  {item.details} Signal: {item.signal}; observed{" "}
                  {formatEvidenceValue(item.observed_value)}; scope {item.scope}.
                </li>
              ))}
            </ul>
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
          <button className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white">
            {insight?.status === "completed"
              ? "Regenerate AI insight"
              : insight?.status === "failed"
                ? "Retry AI insight"
                : "Generate AI insight"}
          </button>
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
