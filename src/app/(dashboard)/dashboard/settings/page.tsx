import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/workspace-ui";
import { AgencyForm } from "@/features/agencies/components/agency-form";
import { getAgencyForUser } from "@/features/agencies/data";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoSettings } from "@/features/agencies/branding/components/logo-settings";
import { getBrandingSettings } from "@/features/agencies/branding/data";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;
  const branding = agency
    ? await getBrandingSettings().catch(() => ({
        available: false,
        activeAssetId: null,
      }))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your agency profile and workspace preferences."
      />

      <FeedbackMessage error={params.error} success={params.success} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <AgencyForm
          agency={agency}
          submitLabel={agency ? "Update agency" : "Create agency"}
        />
      </section>
      {agency && branding ? (
        <LogoSettings agencyName={agency.name} initial={branding} />
      ) : null}
    </div>
  );
}
