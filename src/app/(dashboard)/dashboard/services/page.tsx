import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/workspace-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getAgencyForUser } from "@/features/agencies/data";
import {
  deleteServiceAction,
  toggleServiceActiveAction,
} from "@/features/services/actions";
import { ServiceForm } from "@/features/services/components/service-form";
import { listAgencyServices } from "@/features/services/data";
import { createServiceAction } from "@/features/services/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getUiPreferences } from "@/lib/ui/server-preferences";

type ServicesPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function ServicesPage({
  searchParams,
}: ServicesPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Services</h1>
          <p className="mt-2 text-sm text-muted">
            Create your agency profile before adding services.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Create agency profile
        </Link>
      </div>
    );
  }

  const services = await listAgencyServices(agency.id);
  const { locale } = await getUiPreferences();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Services"
        description="Your agency's service catalog."
      />

      <FeedbackMessage error={params.error} success={params.success} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold text-ink">Add service</h2>
        <ServiceForm
          locale={locale}
          action={createServiceAction}
          submitLabel="Add service"
          pendingLabel="Adding..."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Service catalog</h2>
        {services.length === 0 ? (
          <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">
            No services yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => {
                  const toggleAction = toggleServiceActiveAction.bind(
                    null,
                    service.id,
                    !service.isActive,
                  );
                  const deleteAction = deleteServiceAction.bind(
                    null,
                    service.id,
                  );

                  return (
                    <tr key={service.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{service.name}</p>
                        {service.description ? (
                          <p className="mt-1 max-w-xl text-muted">
                            {service.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {service.currency} {service.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {service.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/services/${service.id}/edit`}
                            className="rounded-md border border-border px-3 py-2 font-semibold text-ink"
                          >
                            Edit
                          </Link>
                          <form action={toggleAction}>
                            <PendingSubmitButton
                              label={service.isActive ? "Disable" : "Enable"}
                              pendingLabel="Updating..."
                              className="rounded-md border border-border px-3 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </form>
                          <form action={deleteAction}>
                            <PendingSubmitButton
                              label="Delete"
                              pendingLabel="Deleting..."
                              className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
