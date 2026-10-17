import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FeedbackMessage } from "@/components/feedback-message";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgencyForUser } from "@/features/agencies/data";
import { updateServiceAction } from "@/features/services/actions";
import { ServiceForm } from "@/features/services/components/service-form";
import { getAgencyService } from "@/features/services/data";
import { getUiPreferences } from "@/lib/ui/server-preferences";

type EditServicePageProps = {
  params: Promise<{
    serviceId: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditServicePage({
  params,
  searchParams,
}: EditServicePageProps) {
  const [{ serviceId }, feedbackParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    redirect(
      buildFeedbackUrl("/dashboard/settings", {
        error: "Create your agency profile before editing services.",
      }),
    );
  }

  const service = await getAgencyService(serviceId, agency.id);

  if (!service) {
    notFound();
  }

  const updateAction = updateServiceAction.bind(null, service.id);
  const { locale } = await getUiPreferences();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/services"
          className="text-sm font-semibold text-accent"
        >
          Back to services
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Edit service</h1>
      </div>

      <FeedbackMessage error={feedbackParams.error} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <ServiceForm
          locale={locale}
          action={updateAction}
          service={service}
          submitLabel="Update service"
        />
      </section>
    </div>
  );
}
