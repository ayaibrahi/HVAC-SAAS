import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import type { Opportunity } from "@/domain/opportunities/types";
import type {
  ProposalDeliverySnapshot,
  ProposalShareLinkMetadata,
} from "@/domain/proposals/types";
import type { AgencyService } from "@/domain/services/types";
import { getProposalBuilderData } from "@/features/proposals/data";
import {
  generateProposalAiDraftAction,
  updateProposalAction,
} from "@/features/proposals/actions";
import { createDeliverySnapshotAction } from "@/features/proposals/delivery/actions";
import { listDeliverySnapshotsForProposal } from "@/features/proposals/delivery/data";
import { ShareLinkControls } from "@/features/proposals/share-links/components/share-link-controls";
import { listShareLinksForSnapshots } from "@/features/proposals/share-links/data";

type ProposalBuilderPageProps = {
  params: Promise<{
    proposalId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function ProposalBuilderPage({
  params,
  searchParams,
}: ProposalBuilderPageProps) {
  const { proposalId } = await params;
  const feedback = await searchParams;
  const data = await getProposalBuilderData(proposalId);
  const deliverySnapshots = await listDeliverySnapshotsForProposal(data.proposal.id);
  const shareLinks = await listShareLinksForSnapshots(
    deliverySnapshots.map((snapshot) => snapshot.id),
  );
  const activeServices = data.services.filter((service) => service.isActive);
  const updateAction = updateProposalAction.bind(null, data.proposal.id);
  const generateAction = generateProposalAiDraftAction.bind(null, data.proposal.id);
  const createSnapshotAction = createDeliverySnapshotAction.bind(
    null,
    data.proposal.id,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/proposals" className="text-sm text-muted">
            Back to proposals
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-ink">
            Proposal Builder
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Draft and price a proposal for {data.prospect.businessName} from the
            completed audit of {data.audit.finalUrl ?? data.audit.websiteUrl}.
          </p>
        </div>
        <form action={generateAction}>
          <button className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-ink">
            Generate summary and scope
          </button>
        </form>
      </div>

      <FeedbackMessage error={feedback.error} success={feedback.success} />

      <DeliverySnapshotPanel
        snapshots={deliverySnapshots}
        shareLinks={shareLinks}
        proposalStatus={data.proposal.status}
        createSnapshotAction={createSnapshotAction}
      />

      {activeServices.length === 0 ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-muted">
          Add at least one active service before selecting proposal
          opportunities.
        </div>
      ) : null}

      <form action={updateAction} className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Proposal details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-ink">Title</span>
                <input
                  name="title"
                  defaultValue={data.proposal.title}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                  required
                />
              </label>
              <label>
                <span className="text-sm font-medium text-ink">Status</span>
                <select
                  name="status"
                  defaultValue={data.proposal.status}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-ink">Currency</span>
                <select
                  name="currency"
                  defaultValue={data.proposal.currency}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                >
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-ink">Summary</span>
                <textarea
                  name="summary"
                  defaultValue={data.proposal.summary}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-ink">Scope</span>
                <textarea
                  name="scope"
                  defaultValue={data.proposal.scope}
                  rows={8}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-ink">Next step</span>
                <textarea
                  name="nextStep"
                  defaultValue={data.proposal.nextStep}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">
              Selected opportunities
            </h2>
            <div className="mt-4 space-y-4">
              {data.opportunities.map((opportunity) => (
                <OpportunitySelection
                  key={opportunity.id}
                  opportunity={opportunity}
                  services={activeServices}
                  selectedServiceId={
                    data.lineItemsByOpportunityId.get(opportunity.id)
                      ?.agencyServiceId ??
                    opportunity.agencyServiceId ??
                    activeServices[0]?.id ??
                    ""
                  }
                  selected={data.lineItemsByOpportunityId.has(opportunity.id)}
                  unitPrice={
                    data.lineItemsByOpportunityId.get(opportunity.id)?.unitPrice ??
                    getDefaultServicePrice(
                      opportunity,
                      activeServices,
                    )
                  }
                  quantity={
                    data.lineItemsByOpportunityId.get(opportunity.id)?.quantity ?? 1
                  }
                  description={
                    data.lineItemsByOpportunityId.get(opportunity.id)
                      ?.description ?? ""
                  }
                  aiSummary={
                    data.aiInsightsByOpportunityId.get(opportunity.id)
                      ?.salesSummary ?? null
                  }
                />
              ))}
            </div>
          </section>

          <section className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Discount</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-medium text-ink">Discount type</span>
                <select
                  name="discountType"
                  defaultValue={data.proposal.discountType}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                >
                  <option value="none">None</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-ink">Discount value</span>
                <input
                  name="discountValue"
                  defaultValue={data.proposal.discountValue.toFixed(2)}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Save proposal
          </button>
        </div>

        <ProposalPreview data={data} />
      </form>
    </div>
  );
}

function DeliverySnapshotPanel({
  snapshots,
  shareLinks,
  proposalStatus,
  createSnapshotAction,
}: {
  snapshots: ProposalDeliverySnapshot[];
  shareLinks: ProposalShareLinkMetadata[];
  proposalStatus: string;
  createSnapshotAction: () => Promise<void>;
}) {
  const activeSnapshot = snapshots.find((snapshot) => snapshot.status === "active");

  return (
    <section className="rounded-md border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Delivery snapshots</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Create an immutable delivery record from the current ready proposal.
          </p>
        </div>
        <form action={createSnapshotAction}>
          <button
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            disabled={proposalStatus !== "ready"}
          >
            Create delivery snapshot
          </button>
        </form>
      </div>

      {proposalStatus !== "ready" ? (
        <p className="mt-3 text-sm text-muted">
          Mark the proposal ready before creating a delivery snapshot.
        </p>
      ) : null}

      {activeSnapshot ? (
        <div className="mt-4 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Current snapshot</p>
            <DownloadPdfLink snapshot={activeSnapshot} />
          </div>
          <SnapshotSummary snapshot={activeSnapshot} />
          <ShareLinkControls
            snapshotId={activeSnapshot.id}
            activeLink={findUsableActiveShareLink(shareLinks, activeSnapshot.id)}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No delivery snapshot exists yet.</p>
      )}

      {snapshots.length > 1 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink">Snapshot history</p>
          <div className="mt-2 space-y-2">
            {snapshots
              .filter((snapshot) => snapshot.status !== "active")
              .map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <SnapshotSummary snapshot={snapshot} />
                    <DownloadPdfLink snapshot={snapshot} />
                  </div>
                  <ShareLinkControls
                    snapshotId={snapshot.id}
                    activeLink={findUsableActiveShareLink(shareLinks, snapshot.id)}
                  />
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DownloadPdfLink({ snapshot }: { snapshot: ProposalDeliverySnapshot }) {
  return (
    <a
      href={`/api/proposal-delivery-snapshots/${snapshot.id}/pdf`}
      className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-ink"
    >
      Download PDF
    </a>
  );
}

function SnapshotSummary({ snapshot }: { snapshot: ProposalDeliverySnapshot }) {
  return (
    <div className="mt-2 grid gap-2 text-sm text-muted md:grid-cols-4">
      <span>Status: {snapshot.status}</span>
      <span>Created: {new Date(snapshot.createdAt).toLocaleDateString()}</span>
      <span>
        Total: {snapshot.currency} {snapshot.total.toFixed(2)}
      </span>
      <span>Line items: {snapshot.lineItems.length}</span>
    </div>
  );
}

function findUsableActiveShareLink(
  shareLinks: ProposalShareLinkMetadata[],
  snapshotId: string,
) {
  const now = Date.now();

  return (
    shareLinks.find(
      (link) =>
        link.deliverySnapshotId === snapshotId &&
        link.status === "active" &&
        (!link.expiresAt || Date.parse(link.expiresAt) > now),
    ) ?? null
  );
}

function OpportunitySelection({
  opportunity,
  services,
  selectedServiceId,
  selected,
  unitPrice,
  quantity,
  description,
  aiSummary,
}: {
  opportunity: Opportunity;
  services: AgencyService[];
  selectedServiceId: string;
  selected: boolean;
  unitPrice: number;
  quantity: number;
  description: string;
  aiSummary: string | null;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="opportunityId"
            value={opportunity.id}
            defaultChecked={selected}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              {opportunity.title}
            </span>
            <span className="mt-1 block text-xs text-muted">
              {opportunity.shortDescription}
            </span>
          </span>
        </label>
        <div className="flex gap-2 text-xs text-muted">
          <span className="rounded-md border border-border px-2 py-1">
            {opportunity.priority}
          </span>
          <span className="rounded-md border border-border px-2 py-1">
            {opportunity.confidence}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-muted">
        {opportunity.evidence.map((item, index) => (
          <li key={`${opportunity.id}-${item.signal}-${index}`}>
            {item.details} Signal: {item.signal}; observed{" "}
            {formatEvidenceValue(item.observed_value)}; scope {item.scope}.
          </li>
        ))}
      </ul>

      {aiSummary ? (
        <p className="mt-3 text-xs text-muted">AI sales insight: {aiSummary}</p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="md:col-span-3">
          <span className="text-xs font-medium text-ink">Service</span>
          <select
            name={`serviceId:${opportunity.id}`}
            defaultValue={selectedServiceId}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-medium text-ink">Quantity</span>
          <input
            name={`quantity:${opportunity.id}`}
            defaultValue={String(quantity)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-ink">Unit price</span>
          <input
            name={`unitPrice:${opportunity.id}`}
            defaultValue={unitPrice.toFixed(2)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-ink">Line note</span>
          <input
            name={`description:${opportunity.id}`}
            defaultValue={description}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>
    </div>
  );
}

function ProposalPreview({ data }: { data: Awaited<ReturnType<typeof getProposalBuilderData>> }) {
  const lineItems = [...data.lineItemsByOpportunityId.values()].sort(
    (left, right) => left.position - right.position,
  );

  return (
    <aside className="space-y-4 rounded-md border border-border bg-white p-6 shadow-sm lg:sticky lg:top-6">
      <div>
        <p className="text-xs font-semibold uppercase text-muted">
          Authenticated preview
        </p>
        <h2 className="mt-2 text-xl font-semibold text-ink">
          {data.proposal.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{data.prospect.businessName}</p>
      </div>

      <PreviewBlock label="Summary" value={data.proposal.summary} />
      <PreviewBlock label="Scope" value={data.proposal.scope} />

      <div>
        <p className="text-sm font-semibold text-ink">Selected work</p>
        {lineItems.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No line items selected.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold text-ink">
                  {item.serviceName}
                </p>
                <p className="mt-1 text-xs text-muted">{item.description}</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {item.quantity} × {data.proposal.currency}{" "}
                  {item.unitPrice.toFixed(2)} = {data.proposal.currency}{" "}
                  {item.lineTotal.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-4 text-sm">
        <PriceRow
          label="Subtotal"
          currency={data.proposal.currency}
          value={data.proposal.subtotal}
        />
        <PriceRow
          label="Discount"
          currency={data.proposal.currency}
          value={data.proposal.discountAmount}
        />
        <PriceRow
          label="Total"
          currency={data.proposal.currency}
          value={data.proposal.total}
          strong
        />
      </div>

      <PreviewBlock label="Next step" value={data.proposal.nextStep} />
    </aside>
  );
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{value}</p>
    </div>
  );
}

function PriceRow({
  label,
  currency,
  value,
  strong = false,
}: {
  label: string;
  currency: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={strong ? "font-semibold text-ink" : "text-muted"}>
        {label}
      </span>
      <span className={strong ? "font-semibold text-ink" : "text-ink"}>
        {currency} {value.toFixed(2)}
      </span>
    </div>
  );
}

function getDefaultServicePrice(
  opportunity: Opportunity,
  services: AgencyService[],
) {
  const service =
    services.find((item) => item.id === opportunity.agencyServiceId) ??
    services[0];

  return service?.price ?? 0;
}

function formatEvidenceValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  return "structured value";
}
