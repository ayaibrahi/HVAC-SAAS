import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FeedbackMessage } from "@/components/feedback-message";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgencyForUser } from "@/features/agencies/data";
import { updateProspectAction } from "@/features/prospects/actions";
import { ProspectForm } from "@/features/prospects/components/prospect-form";
import { getProspect } from "@/features/prospects/data";

type EditProspectPageProps = {
  params: Promise<{
    prospectId: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditProspectPage({
  params,
  searchParams,
}: EditProspectPageProps) {
  const [{ prospectId }, feedbackParams] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const agency = user ? await getAgencyForUser(user.id) : null;

  if (!agency) {
    redirect(
      buildFeedbackUrl("/dashboard/settings", {
        error: "Create your agency profile before editing prospects.",
      }),
    );
  }

  const prospect = await getProspect(prospectId, agency.id);

  if (!prospect) {
    notFound();
  }

  const updateAction = updateProspectAction.bind(null, prospect.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/prospects" className="text-sm font-semibold text-accent">
          Back to prospects
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Edit prospect</h1>
      </div>

      <FeedbackMessage error={feedbackParams.error} />

      <section className="rounded-md border border-border bg-white p-6 shadow-sm">
        <ProspectForm action={updateAction} prospect={prospect} submitLabel="Update prospect" />
      </section>
    </div>
  );
}
