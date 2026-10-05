import { FeedbackMessage } from "@/components/feedback-message";
import { AgencyForm } from "@/features/agencies/components/agency-form";
import { getAgencyForUser } from "@/features/agencies/data";
import { getCurrentUser } from "@/lib/auth/session";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Manage the agency profile used across services, prospects, and future
          proposals.
        </p>
      </div>

      <FeedbackMessage error={params.error} success={params.success} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <AgencyForm agency={agency} submitLabel={agency ? "Update agency" : "Create agency"} />
      </section>
    </div>
  );
}
