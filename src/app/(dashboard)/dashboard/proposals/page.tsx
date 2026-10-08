import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { Audit } from "@/domain/audits/types";
import type { Prospect } from "@/domain/prospects/types";
import { getAgencyForUser } from "@/features/agencies/data";
import { listAuditsForAgency } from "@/features/audits/data";
import { createProposalAction } from "@/features/proposals/actions";
import { listProposalsForAgency } from "@/features/proposals/data";
import { listProspects } from "@/features/prospects/data";
import { getCurrentUser } from "@/lib/auth/session";

type ProposalsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function ProposalsPage({
  searchParams,
}: ProposalsPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Proposals</h1>
          <p className="mt-2 text-sm text-muted">
            Create your agency profile before drafting proposals.
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

  const [proposals, audits, prospects] = await Promise.all([
    listProposalsForAgency(agency.id),
    listAuditsForAgency(agency.id),
    listProspects(agency.id),
  ]);
  const prospectsById = new Map(
    prospects.map((prospect) => [prospect.id, prospect]),
  );
  const completedAudits = audits.filter(
    (audit) => audit.status === "completed",
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Proposals</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Create internal proposal drafts from completed audits, selected
          opportunities, agency services, and manual pricing.
        </p>
      </div>

      <FeedbackMessage error={params.error} success={params.success} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Create draft</h2>
        {completedAudits.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Run and complete an audit before creating a proposal.
          </p>
        ) : (
          <form
            action={createProposalAction}
            className="mt-4 grid gap-4 md:grid-cols-3"
          >
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-ink">
                Completed audit
              </span>
              <select
                name="auditId"
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                required
              >
                {completedAudits.map((audit) => (
                  <option key={audit.id} value={audit.id}>
                    {formatAuditLabel(
                      audit,
                      prospectsById.get(audit.prospectId),
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium text-ink">Title</span>
              <input
                name="title"
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <div className="md:col-span-3">
              <PendingSubmitButton
                label="Create proposal draft"
                pendingLabel="Creating..."
                className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </form>
        )}
      </section>

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Drafts</h2>
        {proposals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No proposals yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {proposals.map((proposal) => (
              <Link
                key={proposal.id}
                href={`/dashboard/proposals/${proposal.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-semibold text-ink">{proposal.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {prospectsById.get(proposal.prospectId)?.businessName ??
                      "Prospect"}{" "}
                    · {proposal.status}
                  </p>
                </div>
                <p className="text-sm font-semibold text-ink">
                  {proposal.currency} {proposal.total.toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatAuditLabel(audit: Audit, prospect: Prospect | undefined) {
  const prospectName = prospect?.businessName ?? "Unknown prospect";
  const url = audit.finalUrl ?? audit.websiteUrl;

  return `${prospectName} — ${url}`;
}
