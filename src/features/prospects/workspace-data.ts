import "server-only";
import { contentQualitySchema } from "@/features/audits/analyzer/content-quality";
import { readRenderedAudit, describeRenderedCoverage, hasVerifiedRenderedContent } from "@/features/audits/rendered/pipeline";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import {
  mapOpportunity,
  sortOpportunities,
} from "@/features/opportunities/data";
import { mapOpportunityAiInsight } from "@/features/opportunities/ai/data";
import { AppError } from "@/lib/errors";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  parseProspectSearch,
  prospectIdSchema,
  prospectPageSize,
  prospectSearchFilter,
  type ProspectListData,
  type ProspectWorkspaceData,
  type ScanSummary,
} from "./workspace-model";

async function latestScan(
  supabase: SupabaseServerClient,
  agencyId: string,
  prospectId: string,
): Promise<ScanSummary | null> {
  const { data, error } = await supabase
    .from("audits")
    .select(
      "id,status,created_at,completed_at,error_code,signal_schema_version,quality:normalized_signals->quality",
    )
    .eq("agency_id", agencyId)
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError("We could not load the scan.", 500);
  const quality = contentQualitySchema.safeParse(data?.quality);
  return data
    ? {
        id: data.id,
        status: data.status,
        createdAt: data.created_at,
        completedAt: data.completed_at,
        verification: data.signal_schema_version === "2.0.0" ? undefined :
          data.status === "completed" ||
          data.error_code === "CONTENT_NOT_VERIFIABLE"
            ? quality.success &&
              quality.data.status === "sufficient" &&
              quality.data.reasons.length === 0
              ? "verified"
              : "unverified"
            : undefined,
      }
    : null;
}

export async function getProspectsPage(input: {
  page?: unknown;
  q?: unknown;
}): Promise<ProspectListData> {
  const { supabase, agency } = await requireCurrentAgency();
  const { page, query } = parseProspectSearch(input);
  let request = supabase
    .from("prospects")
    .select("id,business_name,website_url,created_at")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (query) request = request.or(prospectSearchFilter(query));
  const start = (page - 1) * prospectPageSize;
  const { data, error } = await request.range(start, start + prospectPageSize);
  if (error || !data)
    throw new AppError("We could not load your prospects.", 500);
  // At most 12 small latest-scan queries, rather than loading agency-wide audit JSON.
  const items = await Promise.all(
    data.slice(0, prospectPageSize).map(async (row) => ({
      id: row.id,
      businessName: row.business_name,
      websiteUrl: row.website_url,
      createdAt: row.created_at,
      scan: await latestScan(supabase, agency.id, row.id),
    })),
  );
  return { items, page, query, hasNext: data.length > prospectPageSize };
}

export async function getEditableProspect(id: string) {
  const { agency } = await requireCurrentAgency();
  if (!prospectIdSchema.safeParse(id).success) return null;
  return getProspect(id, agency.id);
}

export async function findMatchingProspect(websiteUrl: string) {
  const { supabase, agency } = await requireCurrentAgency();
  const { data, error } = await supabase
    .from("prospects")
    .select("id,business_name")
    .eq("agency_id", agency.id)
    .eq("website_url", websiteUrl)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError("We could not check existing prospects.", 500);
  return data ? { id: data.id, name: data.business_name } : null;
}

export async function getProspectWorkspace(
  id: string,
): Promise<ProspectWorkspaceData | null> {
  const { supabase, agency } = await requireCurrentAgency();
  if (!prospectIdSchema.safeParse(id).success) return null;
  const prospect = await getProspect(id, agency.id);
  if (!prospect) return null;
  const scan = await latestScan(supabase, agency.id, prospect.id);
  // Load bounded engine-owned coverage for this selected scan only, never every
  // agency-wide audit JSON payload in the prospect list.
  if (scan) {
    const coverage = await supabase.from("audits")
      .select("rendered:normalized_signals->renderedAudit")
      .eq("id", scan.id).eq("agency_id", agency.id).eq("prospect_id", prospect.id).maybeSingle();
    if (coverage.error) throw new AppError("We could not load scan coverage.", 500);
    if (coverage.data?.rendered != null) {
      const rendered = readRenderedAudit({ renderedAudit: coverage.data.rendered });
      scan.verification = hasVerifiedRenderedContent({ renderedAudit: coverage.data.rendered }, prospect.websiteUrl) ? "verified" : "unverified";
      if (rendered) scan.renderedCoverage = describeRenderedCoverage(rendered);
    }
  }
  const proposals = await supabase
    .from("proposals")
    .select("id,title,status")
    .eq("agency_id", agency.id)
    .eq("prospect_id", prospect.id)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(5);
  if (proposals.error || !proposals.data)
    throw new AppError("We could not load proposals.", 500);
  const result: ProspectWorkspaceData = {
    prospect,
    scan,
    proposals: proposals.data,
    opportunities: [],
    insights: [],
    services: [],
  };
  if (!scan || scan.status !== "completed") return result;
  const opportunities = await supabase
    .from("opportunities")
    .select("*")
    .eq("agency_id", agency.id)
    .eq("prospect_id", prospect.id)
    .eq("audit_id", scan.id)
    .order("score", { ascending: false })
    .order("rule_key", { ascending: true })
    .limit(5);
  if (opportunities.error || !opportunities.data)
    throw new AppError("We could not load findings.", 500);
  result.opportunities = sortOpportunities(
    opportunities.data.map(mapOpportunity),
  );
  if (!result.opportunities.length) return result;
  const ids = result.opportunities.map((item) => item.id);
  const serviceIds = [
    ...new Set(
      result.opportunities.flatMap((item) =>
        item.agencyServiceId ? [item.agencyServiceId] : [],
      ),
    ),
  ];
  const insights = await supabase
    .from("opportunity_ai_insights")
    .select("*")
    .eq("agency_id", agency.id)
    .in("opportunity_id", ids)
    .limit(5);
  if (insights.error || !insights.data)
    throw new AppError("We could not load sales insights.", 500);
  result.insights = insights.data.map(mapOpportunityAiInsight);
  if (serviceIds.length) {
    const services = await supabase
      .from("agency_services")
      .select("id,name")
      .eq("agency_id", agency.id)
      .in("id", serviceIds)
      .limit(5);
    if (services.error || !services.data)
      throw new AppError("We could not load matching services.", 500);
    result.services = services.data;
  }
  return result;
}
