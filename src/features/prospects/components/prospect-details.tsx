"use client";

import Link from "next/link";
import { useState } from "react";
import { ScanLine, SearchCheck } from "lucide-react";
import { useInterface } from "@/components/ui-preferences";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { scanIsActive, type ProspectWorkspaceData } from "../workspace-model";
import {
  WorkspaceAction,
  DeleteProspect,
  RefreshWorkspace,
} from "./workspace-controls";
import { CompactFinding } from "./compact-finding";

export function ProspectDetails({
  data,
  createProposal,
}: {
  data: ProspectWorkspaceData;
  createProposal: (form: FormData) => Promise<void>;
}) {
  const { t } = useInterface();
  const { prospect, scan, opportunities, services, insights, proposals } = data;
  const completed = scan?.status === "completed";
  const active = scanIsActive(scan);
  const existingProposal =
    proposals.find((proposal) => proposal.status === "draft") ?? proposals[0];
  const [checkedEmpty, setCheckedEmpty] = useState(false);
  function finding(item: (typeof opportunities)[number]) {
    return (
      <CompactFinding
        key={item.id}
        item={item}
        service={
          services.find((service) => service.id === item.agencyServiceId)?.name
        }
        insight={insights.find((insight) => insight.opportunityId === item.id)}
      />
    );
  }
  const scanControl = (
    <WorkspaceAction
      key={scan?.id}
      path={`/api/prospects/${prospect.id}/audits`}
      label={completed ? t.pRescan : t.pScan}
      pendingLabel={t.pScanning}
      primary={!completed}
      icon={<ScanLine size={16} aria-hidden="true" />}
    />
  );
  const findingsControl = scan && (
    <WorkspaceAction
      key={opportunities.map((item) => item.id).join()}
      path={`/api/audits/${scan.id}/opportunities`}
      label={opportunities.length ? t.pRefreshFindings : t.pViewOpportunities}
      pendingLabel={t.pReviewing}
      primary={!opportunities.length && !checkedEmpty && !existingProposal}
      expectFindings
      onEmpty={() => setCheckedEmpty(true)}
      icon={<SearchCheck size={16} aria-hidden="true" />}
    />
  );
  const proposalControl = completed && (
    <form action={createProposal}>
      <input type="hidden" name="auditId" value={scan.id} />
      <input type="hidden" name="title" value="" />
      <PendingSubmitButton
        label={t.pPrepare}
        pendingLabel={t.pPreparing}
        className="button-primary"
      />
    </form>
  );
  return (
    <div className="space-y-5">
      {active ? (
        <div className="space-y-3">
          <p className="max-w-xl text-sm text-muted">{t.pActiveDescription}</p>
          <RefreshWorkspace />
        </div>
      ) : !completed ? (
        <div className="space-y-3">
          <p className="max-w-xl text-sm text-muted">
            {scan?.status === "failed"
              ? t.pFailedDescription
              : t.pScanDescription}
          </p>
          {scanControl}
        </div>
      ) : (
        <section aria-label={t.pOpportunities}>
          <p className="text-sm text-muted">{t.pOnePageScanned}</p>
          {(existingProposal || opportunities.length > 0) && (
            <div className="my-5 space-y-2">
              {existingProposal ? (
                <Link
                  href={`/dashboard/proposals/${existingProposal.id}`}
                  className="button-primary"
                >
                  {existingProposal.status === "draft"
                    ? t.pContinue
                    : t.pOpenProposal}
                </Link>
              ) : (
                proposalControl
              )}
              <p className="max-w-xl text-xs leading-relaxed text-muted">
                {existingProposal ? t.pResumeProposalHelp : t.pPrepareHelp}
              </p>
            </div>
          )}
          {opportunities.length ? (
            <>
              <h3 className="mt-5 text-sm font-semibold">
                {opportunities.length} {t.pFoundLabel}
              </h3>
              <p className="mt-2 text-xs text-muted">{t.pPageEvidence}</p>
              {opportunities.slice(0, 3).map(finding)}
              {opportunities.length > 3 && (
                <details className="py-3">
                  <summary className="cursor-pointer py-2 text-sm text-accent">
                    {t.pMoreOpportunities} ({opportunities.length - 3})
                  </summary>
                  {opportunities.slice(3).map(finding)}
                </details>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p
                className="mt-3 text-sm text-muted"
                role={checkedEmpty ? "status" : undefined}
              >
                {checkedEmpty ? t.pNoSupportedFindings : t.pNoOpportunities}
              </p>
              {!checkedEmpty && findingsControl}
            </div>
          )}
        </section>
      )}
      <details>
        <summary className="w-fit cursor-pointer py-2 text-xs font-medium text-muted">
          {t.pMore}
        </summary>
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-start gap-3">
            <Link
              href={`/dashboard/prospects/${prospect.id}/edit`}
              className="button-secondary"
            >
              {t.pEdit}
            </Link>
            {completed && scanControl}
            {completed &&
              (opportunities.length > 0 || checkedEmpty) &&
              findingsControl}
          </div>
          {proposals.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium">{t.pProposals}</h3>
              <ul className="space-y-2">
                {proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <Link
                      href={`/dashboard/proposals/${proposal.id}`}
                      className="inline-flex min-h-11 items-center text-sm text-accent"
                    >
                      <bdi>{proposal.title}</bdi>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(prospect.contactName ||
            prospect.contactEmail ||
            prospect.notes) && (
            <dl className="space-y-3 text-sm">
              {[
                [t.pContactName, prospect.contactName],
                [t.pContactEmail, prospect.contactEmail],
                [t.pNotes, prospect.notes],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd dir="auto" className="mt-1 whitespace-pre-wrap">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
          <DeleteProspect id={prospect.id} name={prospect.businessName} />
        </div>
      </details>
    </div>
  );
}
