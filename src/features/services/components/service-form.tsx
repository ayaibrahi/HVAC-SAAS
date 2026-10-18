import type { AgencyService } from "@/domain/services/types";
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
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Service name</span>
          <input
            name="name"
            defaultValue={service?.name ?? ""}
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
              <span className="text-sm font-medium">{copy[field]}</span>
              <textarea
                name={field}
                defaultValue={service?.approvedScope?.[field] ?? ""}
                rows={3}
                maxLength={800}
                dir="auto"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>
          ))}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="approveScope" className="mt-1" />
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
