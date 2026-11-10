"use client";

import { useState } from "react";
import type { AgencyService } from "@/domain/services/types";
import { serviceStarterTemplates, starterScope } from "../starter-templates";
import { supportedCurrencies } from "@/config/currencies";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCompleteProposalCopy } from "@/lib/i18n/complete-proposal";
import type { Locale } from "@/lib/ui/preferences";

type ServiceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  service?: AgencyService | null;
  submitLabel?: string;
  pendingLabel?: string;
  locale?: Locale;
  scopeAvailable?: boolean;
};

export function ServiceForm({
  action,
  service,
  submitLabel = "Save service",
  pendingLabel = "Saving...",
  locale = "en",
  scopeAvailable = true,
}: ServiceFormProps) {
  const copy = getCompleteProposalCopy(locale);
  const [name, setName] = useState(service?.name ?? "");
  const [scope, setScope] = useState(
    service?.approvedScope ?? {
      deliverables: "",
      exclusions: "",
      clientInputs: "",
      completionChecks: "",
    },
  );
  const [approved, setApproved] = useState(false);
  return (
    <form action={action} className="space-y-5">
      {scopeAvailable && (
        <fieldset className="space-y-3 rounded-md border border-border p-4">
          <legend className="font-semibold">{copy.starterTemplates}</legend>
          <p className="text-sm text-muted">{copy.starterHelp}</p>
          {serviceStarterTemplates.map((template) => (
            <div key={template.id} className="space-y-2">
              <p className="font-medium">{template.name}</p>
              <p className="text-sm" dir="auto">
                {template.deliverables}
              </p>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  if (!service) setName(template.name);
                  setScope(starterScope(template));
                  setApproved(true);
                }}
              >
                {copy.useStarter} — {template.name}
              </button>
            </div>
          ))}
        </fieldset>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Service name</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Local SEO Setup"
            required
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Price</span>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={service?.price ?? 0}
            required
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_180px]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Description</span>
          <textarea
            name="description"
            defaultValue={service?.description ?? ""}
            rows={3}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Currency</span>
          <select
            name="currency"
            defaultValue={service?.currency ?? "USD"}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            {supportedCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium text-ink">
        <input type="hidden" name="isActive" value="false" />
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={service?.isActive ?? true}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
        />
        Active
      </label>

      {!scopeAvailable && (
        <p
          role="status"
          className="border-t border-border pt-4 text-sm text-muted"
        >
          {copy.scopeUnavailable}
        </p>
      )}
      {scopeAvailable && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-base font-semibold">
            {copy.catalogScope}
          </legend>
          <p className="text-sm text-muted">{copy.scopeHelp}</p>
          <p className="text-sm">
            {service?.approvedScope ? copy.approved : copy.notApproved}
          </p>
          {(
            [
              "deliverables",
              "exclusions",
              "clientInputs",
              "completionChecks",
            ] as const
          ).map((field) => (
            <label key={field} className="block space-y-2">
              <span className="text-sm font-medium">
                {copy[field]}
                {field !== "deliverables" && ` (${copy.optional})`}
              </span>
              <textarea
                name={field}
                value={scope[field]}
                onChange={(event) => {
                  setScope((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }));
                  setApproved(false);
                }}
                rows={3}
                maxLength={800}
                dir="auto"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>
          ))}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="approveScope"
              className="mt-1"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            {copy.approveScope}
          </label>
        </fieldset>
      )}

      <PendingSubmitButton
        label={submitLabel}
        pendingLabel={pendingLabel}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </form>
  );
}
