import type { Agency } from "@/domain/agencies/types";
import { supportedCurrencies } from "@/config/currencies";
import { upsertAgencyAction } from "@/features/agencies/actions";

type AgencyFormProps = {
  agency?: Agency | null;
  submitLabel?: string;
};

export function AgencyForm({ agency, submitLabel = "Save agency" }: AgencyFormProps) {
  return (
    <form action={upsertAgencyAction} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Agency name</span>
          <input
            name="name"
            defaultValue={agency?.name ?? ""}
            required
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Website</span>
          <input
            name="website"
            defaultValue={agency?.website ?? ""}
            placeholder="https://agency.example"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
      </div>

      <label className="block max-w-xs space-y-2">
        <span className="text-sm font-medium text-ink">Default currency</span>
        <select
          name="defaultCurrency"
          defaultValue={agency?.defaultCurrency ?? "USD"}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        >
          {supportedCurrencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
