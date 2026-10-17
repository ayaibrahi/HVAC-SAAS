"use client";

import { useState } from "react";
import type { Opportunity } from "@/domain/opportunities/types";
import type { AgencyService } from "@/domain/services/types";
import type { ProposalCopy } from "@/lib/i18n/proposals";

export function OpportunitySelection({
  opportunity,
  services,
  selectedServiceId,
  selected,
  unitPrice,
  quantity,
  description,
  aiSummary,
  copy,
}: {
  opportunity: Opportunity;
  services: AgencyService[];
  selectedServiceId: string;
  selected: boolean;
  unitPrice: number;
  quantity: number;
  description: string;
  aiSummary: string | null;
  copy: ProposalCopy;
}) {
  const [checked, setChecked] = useState(selected);
  const [serviceId, setServiceId] = useState(selectedServiceId);
  const recommended = services.find(
    (service) => service.id === opportunity.agencyServiceId,
  );
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="opportunityId"
            value={opportunity.id}
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            disabled={services.length === 0 && !selected}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              <bdi>{opportunity.title}</bdi>
            </span>
            <span className="mt-1 block text-xs text-muted">
              <bdi>{opportunity.shortDescription}</bdi>
            </span>
          </span>
        </label>
        <div className="flex gap-2 text-xs text-muted">
          <span>{opportunity.priority}</span>
          <span>{opportunity.confidence}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{copy.evidenceScope}</p>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {opportunity.evidence.map((item, index) => (
          <li key={`${item.signal}-${index}`}>
            <bdi>{item.details}</bdi>
          </li>
        ))}
      </ul>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer py-2">
          {copy.technicalEvidence}
        </summary>
        {opportunity.evidence.map((item, index) => (
          <p key={`${item.signal}-${index}`}>
            <bdi dir="ltr">
              {item.signal}: {JSON.stringify(item.observed_value)}; {item.scope}
              ; {item.source}
            </bdi>
          </p>
        ))}
      </details>
      {aiSummary && (
        <p className="mt-3 text-xs text-muted">
          {copy.aiInsight}: <bdi>{aiSummary}</bdi>
        </p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="md:col-span-3">
          <span className="text-xs font-medium text-ink">{copy.service}</span>
          <select
            name={`serviceId:${opportunity.id}`}
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            required={checked}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="">{copy.chooseService}</option>
            {selectedServiceId &&
              !services.some((service) => service.id === selectedServiceId) && (
                <option value={selectedServiceId} disabled>
                  {copy.unavailableService}
                </option>
              )}
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="space-y-1 text-xs text-muted md:col-span-3"
          aria-live="polite"
        >
          <p>
            {recommended ? (
              <>
                {copy.recommended}: <bdi>{recommended.name}</bdi>
              </>
            ) : (
              copy.unmatched
            )}
          </p>
          {serviceId && (
            <p>
              {serviceId === recommended?.id
                ? copy.selectedRecommendation
                : copy.manualService}
            </p>
          )}
        </div>
        <label>
          <span className="text-xs font-medium text-ink">{copy.quantity}</span>
          <input
            name={`quantity:${opportunity.id}`}
            type="number"
            disabled={!checked}
            min={1}
            max={100}
            step={1}
            required={checked}
            defaultValue={String(quantity)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-ink">{copy.unitPrice}</span>
          <input
            name={`unitPrice:${opportunity.id}`}
            inputMode="decimal"
            required={checked}
            defaultValue={unitPrice.toFixed(2)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="md:col-span-3">
          <span className="text-xs font-medium text-ink">{copy.lineNote}</span>
          <textarea
            name={`description:${opportunity.id}`}
            defaultValue={description}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
