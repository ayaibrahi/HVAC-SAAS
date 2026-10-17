import Link from "next/link";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { PendingDownloadLink } from "@/components/pending-download-link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { Opportunity } from "@/domain/opportunities/types";
import type {
  ProposalDeliverySnapshot,
  ProposalShareLinkMetadata,
} from "@/domain/proposals/types";
import type { AgencyService } from "@/domain/services/types";
import { getProposalBuilderData } from "@/features/proposals/data";
import { getProposalContentSuggestion } from "@/features/proposals/content-suggestion";
import { OpportunitySelection } from "@/features/proposals/components/opportunity-selection";
import { buildDeliverySnapshotPayload } from "@/features/proposals/delivery/snapshot";
import { getPublicErrorMessage } from "@/lib/errors";
import {
  ProposalContentFields,
  ProposalEditingGuard,
  ProposalEditForm,
  ProposalAiSubmitButton,
  ProposalGuardedSubmitButton,
  ProposalActionFeedback,
} from "@/features/proposals/components/content-fields";
import {
  generateProposalAiDraftAction,
  saveProposalFormAction,
  updateProposalAction,
} from "@/features/proposals/actions";
import { createDeliverySnapshotAction } from "@/features/proposals/delivery/actions";
import { listDeliverySnapshotsForProposal } from "@/features/proposals/delivery/data";
import { ShareLinkControls } from "@/features/proposals/share-links/components/share-link-controls";
import { listShareLinksForSnapshots } from "@/features/proposals/share-links/data";
import { getProposalCopy, type ProposalCopy } from "@/lib/i18n/proposals";
import {
  formatInterfaceDate,
  localeDirection,
  type Locale,
} from "@/lib/ui/preferences";
import { getUiPreferences } from "@/lib/ui/server-preferences";

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
  const { locale } = await getUiPreferences();
  const copy = getProposalCopy(locale);
  const deliverySnapshots = await listDeliverySnapshotsForProposal(
    data.proposal.id,
  );
  const shareLinks = await listShareLinksForSnapshots(
    deliverySnapshots.map((snapshot) => snapshot.id),
  );
  const activeServices = data.services.filter((service) => service.isActive);
  const suggestion = getProposalContentSuggestion(data);
  const preserveCopy =
    data.proposal.status !== "draft" ||
    Boolean(
      data.proposal.summary.trim() ||
      data.proposal.scope.trim() ||
      data.proposal.nextStep.trim(),
    );
  const updateAction = saveProposalFormAction.bind(null, data.proposal.id);
  let deliveryProblem: string | null = null;
  try {
    buildDeliverySnapshotPayload({
      agency: data.agency,
      userId: data.agency.ownerUserId,
      proposal: data.proposal,
      prospect: data.prospect,
      proposalOpportunities: [
        ...data.proposalOpportunitiesByOpportunityId.values(),
      ],
      lineItems: [...data.lineItemsByOpportunityId.values()],
    });
  } catch (error) {
    deliveryProblem = getPublicErrorMessage(error, copy.deliveryReview);
  }
  const generateAction = generateProposalAiDraftAction.bind(
    null,
    data.proposal.id,
  );
  const createSnapshotAction = createDeliverySnapshotAction.bind(
    null,
    data.proposal.id,
  );

  return (
    <ProposalEditingGuard key={data.proposal.updatedAt}>
      <div className="space-y-8" lang={locale} dir={localeDirection(locale)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard/proposals" className="text-sm text-muted">
              {copy.back}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              {copy.builder}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              {copy.forBusiness} <bdi>{data.prospect.businessName}</bdi>.{" "}
              {copy.sourcePage}:{" "}
              <bdi dir="ltr">
                {data.audit.finalUrl ?? data.audit.websiteUrl}
              </bdi>
              .
            </p>
          </div>
          <form action={generateAction}>
            <ProposalAiSubmitButton
              saveFirstLabel={copy.saveBeforeAi}
              label={copy.generate}
              pendingLabel={copy.generating}
              className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                data.lineItemsByOpportunityId.size === 0 ||
                preserveCopy ||
                !suggestion
              }
            />
            <p className="mt-2 max-w-sm text-xs text-muted">
              {preserveCopy
                ? copy.aiPreserve
                : data.lineItemsByOpportunityId.size === 0
                  ? copy.aiSaveFirst
                  : !suggestion
                    ? copy.aiEvidenceRequired
                    : copy.aiOptional}
            </p>
          </form>
        </div>

        <ProposalActionFeedback
          error={feedback.error}
          success={feedback.success}
        />

        <section
          aria-labelledby="proposal-workflow"
          className="border-y border-border py-5"
        >
          <h2
            id="proposal-workflow"
            className="text-base font-semibold text-ink"
          >
            {copy.workflow}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {data.proposal.status === "ready"
              ? copy.readyGuidance
              : copy.draftGuidance}
          </p>
          <ol className="mt-3 grid gap-3 text-sm text-accent md:grid-cols-3">
            <li>
              <a href="#proposal-work" className="hover:underline">
                {copy.chooseWorkStep}
              </a>
            </li>
            <li>
              <a href="#proposal-copy" className="hover:underline">
                {copy.editCopyStep}
              </a>
            </li>
            <li>
              <a href="#proposal-delivery" className="hover:underline">
                {copy.approveStep}
              </a>
            </li>
          </ol>
          <Link
            href={`/dashboard/prospects?prospect=${data.prospect.id}#website-results`}
            className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
          >
            {copy.businessResults}
          </Link>
          <p className="mt-1 text-xs text-muted">{copy.sourceNote}</p>
          {data.lineItemsByOpportunityId.size === 0 && (
            <p className="mt-3 text-sm font-medium text-ink">
              {copy.emptyDraft}
            </p>
          )}
        </section>

        <DeliverySnapshotPanel
          snapshots={deliverySnapshots}
          shareLinks={shareLinks}
          proposalStatus={data.proposal.status}
          deliveryProblem={deliveryProblem}
          createSnapshotAction={createSnapshotAction}
          copy={copy}
          locale={locale}
        />

        {activeServices.length === 0 ? (
          <div className="rounded-md border border-border bg-white p-4 text-sm text-muted">
            {copy.noServices}{" "}
            <Link
              href="/dashboard/services"
              className="font-semibold text-accent hover:underline"
            >
              {copy.manageServices}
            </Link>
          </div>
        ) : null}

        <ProposalEditForm
          action={updateAction}
          fallbackAction={updateProposalAction.bind(null, data.proposal.id)}
          successHref={buildFeedbackUrl(
            `/dashboard/proposals/${data.proposal.id}`,
            { success: "Proposal saved." },
          )}
          copy={copy}
          className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
        >
          <div className="space-y-6">
            <section
              id="proposal-copy"
              className="scroll-mt-5 rounded-md border border-border bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-ink">{copy.details}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="text-sm font-medium text-ink">
                    {copy.title}
                  </span>
                  <input
                    name="title"
                    defaultValue={data.proposal.title}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-ink">
                    {copy.status}
                  </span>
                  <select
                    name="status"
                    defaultValue={data.proposal.status}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <option value="draft">{copy.draft}</option>
                    <option value="ready">{copy.ready}</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-ink">
                    {copy.currency}
                  </span>
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
                <ProposalContentFields
                  key={data.proposal.updatedAt}
                  initial={{
                    summary: data.proposal.summary,
                    scope: data.proposal.scope,
                    nextStep: data.proposal.nextStep,
                  }}
                  suggestion={suggestion}
                  copy={copy}
                />
              </div>
            </section>

            <section
              id="proposal-work"
              className="scroll-mt-5 rounded-md border border-border bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-ink">
                {copy.opportunities}
              </h2>
              <p className="mt-2 text-xs text-muted">{copy.serviceHelp}</p>
              {data.opportunities.length === 0 && (
                <p className="mt-3 text-sm text-muted">
                  {copy.noOpportunities}
                </p>
              )}
              <div className="mt-4 space-y-4">
                {data.opportunities.map((opportunity) => (
                  <OpportunitySelection
                    key={opportunity.id}
                    opportunity={opportunity}
                    services={activeServices}
                    selectedServiceId={
                      data.lineItemsByOpportunityId.get(opportunity.id)
                        ?.agencyServiceId ??
                      activeServices.find(
                        (service) => service.id === opportunity.agencyServiceId,
                      )?.id ??
                      ""
                    }
                    selected={data.lineItemsByOpportunityId.has(opportunity.id)}
                    unitPrice={
                      data.lineItemsByOpportunityId.get(opportunity.id)
                        ?.unitPrice ??
                      getDefaultServicePrice(opportunity, activeServices)
                    }
                    quantity={
                      data.lineItemsByOpportunityId.get(opportunity.id)
                        ?.quantity ?? 1
                    }
                    description={
                      data.lineItemsByOpportunityId.get(opportunity.id)
                        ?.description ?? ""
                    }
                    aiSummary={
                      data.aiInsightsByOpportunityId.get(opportunity.id)
                        ?.salesSummary ?? null
                    }
                    copy={copy}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-md border border-border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">
                {copy.discount}
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium text-ink">
                    {copy.discountType}
                  </span>
                  <select
                    name="discountType"
                    defaultValue={data.proposal.discountType}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <option value="none">{copy.none}</option>
                    <option value="fixed">{copy.fixed}</option>
                    <option value="percentage">{copy.percentage}</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-ink">
                    {copy.discountValue}
                  </span>
                  <input
                    name="discountValue"
                    defaultValue={data.proposal.discountValue.toFixed(2)}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </section>

            <PendingSubmitButton
              label={copy.save}
              pendingLabel={copy.saving}
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <ProposalPreview data={data} copy={copy} />
        </ProposalEditForm>
      </div>
    </ProposalEditingGuard>
  );
}

function DeliverySnapshotPanel({
  snapshots,
  shareLinks,
  proposalStatus,
  deliveryProblem,
  createSnapshotAction,
  copy,
  locale,
}: {
  snapshots: ProposalDeliverySnapshot[];
  shareLinks: ProposalShareLinkMetadata[];
  proposalStatus: string;
  deliveryProblem: string | null;
  createSnapshotAction: () => Promise<void>;
  copy: ProposalCopy;
  locale: Locale;
}) {
  const activeSnapshot = snapshots.find(
    (snapshot) => snapshot.status === "active",
  );

  return (
    <section
      id="proposal-delivery"
      className="scroll-mt-5 rounded-md border border-border bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{copy.delivery}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {copy.deliveryDescription}
          </p>
        </div>
        <form action={createSnapshotAction}>
          <ProposalGuardedSubmitButton
            saveFirstLabel={copy.deliverySaveFirst}
            label={copy.prepare}
            pendingLabel={copy.preparing}
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(deliveryProblem)}
          />
        </form>
      </div>

      {proposalStatus !== "ready" ? (
        <p className="mt-3 text-sm text-muted">{copy.readyRequired}</p>
      ) : deliveryProblem ? (
        <p className="mt-3 text-sm text-muted">
          {copy.deliveryReview} {deliveryProblem}
        </p>
      ) : null}

      {activeSnapshot ? (
        <div className="mt-4 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {copy.currentVersion}
            </p>
            <DownloadPdfLink snapshot={activeSnapshot} copy={copy} />
          </div>
          <SnapshotSummary
            snapshot={activeSnapshot}
            copy={copy}
            locale={locale}
          />
          <ShareLinkControls
            snapshotId={activeSnapshot.id}
            activeLink={findUsableActiveShareLink(
              shareLinks,
              activeSnapshot.id,
            )}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{copy.noVersion}</p>
      )}

      {snapshots.length > 1 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink">
            {copy.versionHistory}
          </p>
          <div className="mt-2 space-y-2">
            {snapshots
              .filter((snapshot) => snapshot.status !== "active")
              .map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <SnapshotSummary
                      snapshot={snapshot}
                      copy={copy}
                      locale={locale}
                    />
                    <DownloadPdfLink snapshot={snapshot} copy={copy} />
                  </div>
                  <ShareLinkControls
                    snapshotId={snapshot.id}
                    activeLink={findUsableActiveShareLink(
                      shareLinks,
                      snapshot.id,
                    )}
                  />
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DownloadPdfLink({
  snapshot,
  copy,
}: {
  snapshot: ProposalDeliverySnapshot;
  copy: ProposalCopy;
}) {
  return (
    <PendingDownloadLink
      href={`/api/proposal-delivery-snapshots/${snapshot.id}/pdf`}
      label={copy.download}
      pendingLabel={copy.downloading}
      errorLabel={copy.downloadError}
      className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-ink"
    />
  );
}

function SnapshotSummary({
  snapshot,
  copy,
  locale,
}: {
  snapshot: ProposalDeliverySnapshot;
  copy: ProposalCopy;
  locale: Locale;
}) {
  return (
    <div className="mt-2 grid gap-2 text-sm text-muted md:grid-cols-4">
      <span>
        {copy.status}:{" "}
        {snapshot.status === "active" ? copy.active : copy.archived}
      </span>
      <span>
        {copy.created}: {formatInterfaceDate(snapshot.createdAt, locale)}
      </span>
      <span>
        {copy.total}:{" "}
        <bdi dir="ltr">
          {snapshot.currency} {snapshot.total.toFixed(2)}
        </bdi>
      </span>
      <span>
        {copy.lineItems}: {snapshot.lineItems.length}
      </span>
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

function ProposalPreview({
  data,
  copy,
}: {
  data: Awaited<ReturnType<typeof getProposalBuilderData>>;
  copy: ProposalCopy;
}) {
  const lineItems = [...data.lineItemsByOpportunityId.values()].sort(
    (left, right) => left.position - right.position,
  );

  return (
    <aside className="min-w-0 space-y-4 self-start rounded-md border border-border bg-white p-6 shadow-sm lg:sticky lg:top-6">
      <div>
        <p className="text-xs font-semibold uppercase text-muted">
          {copy.savedPreview}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-ink">
          <bdi>{data.proposal.title}</bdi>
        </h2>
        <p className="mt-1 text-sm text-muted">
          <bdi>{data.prospect.businessName}</bdi>
        </p>
        <p className="mt-2 text-xs text-muted">{copy.savedPreviewNote}</p>
      </div>

      <PreviewBlock
        label={copy.summary}
        value={data.proposal.summary}
        empty={copy.emptySummary}
      />
      <PreviewBlock
        label={copy.scope}
        value={data.proposal.scope}
        empty={copy.emptyScope}
      />

      <div>
        <p className="text-sm font-semibold text-ink">{copy.selectedWork}</p>
        {lineItems.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{copy.noLines}</p>
        ) : (
          <div className="mt-2 space-y-3">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border p-3"
              >
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
          label={copy.subtotal}
          currency={data.proposal.currency}
          value={data.proposal.subtotal}
        />
        <PriceRow
          label={copy.discount}
          currency={data.proposal.currency}
          value={data.proposal.discountAmount}
        />
        <PriceRow
          label={copy.total}
          currency={data.proposal.currency}
          value={data.proposal.total}
          strong
        />
      </div>

      <PreviewBlock label={copy.nextStep} value={data.proposal.nextStep} />
    </aside>
  );
}

function PreviewBlock({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty?: string;
}) {
  if (!value.trim() && !empty) {
    return null;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-muted">
        {value.trim() ? value : empty}
      </p>
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
      <span
        dir="ltr"
        className={strong ? "font-semibold text-ink" : "text-ink"}
      >
        {currency} {value.toFixed(2)}
      </span>
    </div>
  );
}

function getDefaultServicePrice(
  opportunity: Opportunity,
  services: AgencyService[],
) {
  const service = services.find(
    (item) => item.id === opportunity.agencyServiceId,
  );

  return service?.price ?? 0;
}
