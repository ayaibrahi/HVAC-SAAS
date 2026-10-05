import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { AgencyForm } from "@/features/agencies/components/agency-form";
import { getAgencyForUser } from "@/features/agencies/data";
import { listProspects } from "@/features/prospects/data";
import { listAgencyServices } from "@/features/services/data";
import { getCurrentUser } from "@/lib/auth/session";

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Create your agency profile</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The workspace needs one agency profile before you can add services and
            prospects.
          </p>
        </div>
        <FeedbackMessage error={params.error} success={params.success} />
        <section className="rounded-md border border-border bg-white p-6 shadow-sm">
          <AgencyForm submitLabel="Create agency" />
        </section>
      </div>
    );
  }

  const [services, prospects] = await Promise.all([
    listAgencyServices(agency.id),
    listProspects(agency.id),
  ]);
  const activeServices = services.filter((service) => service.isActive).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          {agency.name} is ready for service catalog and prospect management.
        </p>
      </div>

      <FeedbackMessage error={params.error} success={params.success} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-muted">Prospects</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{prospects.length}</p>
        </div>
        <div className="rounded-md border border-border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-muted">Services</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{services.length}</p>
        </div>
        <div className="rounded-md border border-border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-muted">Active services</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{activeServices}</p>
        </div>
      </section>

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Foundation status</h2>
        <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
          <Link href="/dashboard/services" className="rounded-md border border-border p-4">
            Add agency services
          </Link>
          <Link href="/dashboard/prospects" className="rounded-md border border-border p-4">
            Add prospects
          </Link>
        </div>
      </section>
    </div>
  );
}
