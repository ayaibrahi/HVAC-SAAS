import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/workspace-ui";
import { AgencyForm } from "@/features/agencies/components/agency-form";
import { getAgencyForUser } from "@/features/agencies/data";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { getDashboardOverview } from "@/features/dashboard/data";
import { getCurrentUser } from "@/lib/auth/session";
import { EnglishWorkflow, InterfaceText } from "@/components/ui-preferences";

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    return (
      <EnglishWorkflow>
        <div className="space-y-6">
          <PageHeader
            title="Create your agency profile"
            description="Set up your agency workspace."
          />
          <FeedbackMessage error={params.error} success={params.success} />
          <section className="max-w-3xl border-t border-border bg-white p-5 sm:p-6">
            <AgencyForm submitLabel="Create agency" />
          </section>
        </div>
      </EnglishWorkflow>
    );
  }

  let overview;
  try {
    overview = await getDashboardOverview();
  } catch {
    // Do not render failed reads as zero totals or expose database details.
    return (
      <div className="space-y-6">
        <PageHeader title={<InterfaceText name="salesWorkspace" />} />
        <FeedbackMessage error="We could not load your workspace overview. Please try again." />
        <Link href="/dashboard" className="button-secondary">
          <InterfaceText name="reload" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FeedbackMessage error={params.error} success={params.success} />
      <DashboardOverview data={overview} />
    </div>
  );
}
