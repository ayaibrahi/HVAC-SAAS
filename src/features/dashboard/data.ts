import "server-only";
import { requireCurrentAgency } from "@/features/agencies/data";
import type { DashboardOverviewData } from "@/features/dashboard/types";
import { AppError } from "@/lib/errors";

const recentActivityLimit = 5;

export async function getDashboardOverview(): Promise<DashboardOverviewData> {
  // Ownership is session-derived, never accepted from page parameters or clients.
  const { supabase, agency } = await requireCurrentAgency();
  const [
    prospects,
    audits,
    opportunities,
    proposals,
    recentProspects,
    recentAudits,
    recentProposals,
  ] = await Promise.all([
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id),
    supabase
      .from("audits")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id)
      .eq("status", "completed"),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id)
      .in("status", ["open", "selected"]),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id),
    supabase
      .from("prospects")
      .select("id,business_name,website_url,created_at")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(recentActivityLimit),
    supabase
      .from("audits")
      .select("id,prospect_id,status,website_url,created_at")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(recentActivityLimit),
    supabase
      .from("proposals")
      .select("id,title,status,updated_at")
      .eq("agency_id", agency.id)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(recentActivityLimit),
  ]);

  if (
    [
      prospects,
      audits,
      opportunities,
      proposals,
      recentProspects,
      recentAudits,
      recentProposals,
    ].some((result) => result.error) ||
    [prospects, audits, opportunities, proposals].some(
      (result) => result.count === null,
    ) ||
    !recentProspects.data ||
    !recentAudits.data ||
    !recentProposals.data
  ) {
    throw new AppError(
      "We could not load your workspace overview. Please try again.",
      500,
    );
  }

  return {
    counts: {
      prospects: prospects.count!,
      completedAudits: audits.count!,
      opportunities: opportunities.count!,
      proposals: proposals.count!,
    },
    recentProspects: recentProspects.data,
    recentAudits: recentAudits.data,
    recentProposals: recentProposals.data,
  };
}
