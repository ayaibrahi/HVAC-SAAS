import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAgencyForUser } from "@/features/agencies/data";

export default async function ProtectedDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    redirect(
      buildFeedbackUrl("/sign-in", {
        error: "Supabase is not configured. Add the required environment variables.",
      }),
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const agency = await getAgencyForUser(user.id);

  return (
    <DashboardShell agencyName={agency?.name} userEmail={user.email}>
      {children}
    </DashboardShell>
  );
}
