import type { Prospect } from "@/domain/prospects/types";

type ProspectFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  prospect?: Prospect | null;
  submitLabel?: string;
};

export function ProspectForm({
  action,
  prospect,
  submitLabel = "Save prospect",
}: ProspectFormProps) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Business name</span>
          <input
            name="businessName"
            defaultValue={prospect?.businessName ?? ""}
            required
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Website URL</span>
          <input
            name="websiteUrl"
            defaultValue={prospect?.websiteUrl ?? ""}
            placeholder="https://prospect.example"
            required
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Contact name</span>
          <input
            name="contactName"
            defaultValue={prospect?.contactName ?? ""}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Contact email</span>
          <input
            name="contactEmail"
            type="email"
            defaultValue={prospect?.contactEmail ?? ""}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-ink">Notes</span>
        <textarea
          name="notes"
          defaultValue={prospect?.notes ?? ""}
          rows={3}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
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
