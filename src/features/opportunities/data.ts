import "server-only";

import type { Audit } from "@/domain/audits/types";
import type { Opportunity, OpportunityEvidence } from "@/domain/opportunities/types";
import { mapAudit } from "@/features/audits/data";
import { assertProspectBelongsToAgency } from "@/features/audits/authorization";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import { listAgencyServices } from "@/features/services/data";
import { assertAuditReadyForOpportunityGeneration } from "@/features/opportunities/authorization";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { opportunityRuleOrder } from "@/features/opportunities/engine/rank";
import {
  createOpportunityInsertRows,
  createOpportunityReconciliationPlan,
} from "@/features/opportunities/persistence";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateOpportunitiesInputSchema } from "@/lib/validation/opportunities";
import { opportunityEvidenceSchema } from "@/lib/validation/opportunities";

type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];

export async function generateOpportunitiesForAudit(auditId: string) {
  const input = generateOpportunitiesInputSchema.parse({ auditId });
  const { supabase, agency } = await requireCurrentAgency();
  const audit = await getAuditForAgency(input.auditId, agency.id, supabase);

  assertAuditReadyForOpportunityGeneration(audit, agency.id);

  const prospect = await getProspect(audit.prospectId, agency.id);

  assertProspectBelongsToAgency(prospect, agency.id);

  const agencyServices = await listAgencyServices(agency.id);
  const opportunities = evaluateOpportunitiesForAudit({
    audit,
    agencyServices,
  });

  return replaceOpportunitySetForAudit({
    audit,
    opportunities,
  });
}

export async function listOpportunitiesForAgency(agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("agency_id", agencyId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("We could not load opportunities.", 500);
  }

  return sortOpportunities(data.map(mapOpportunity));
}

export async function getOpportunityForAgency(
  opportunityId: string,
  agencyId: string,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("opportunities")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that opportunity.", 500);
  }

  return data ? mapOpportunity(data) : null;
}

async function getAuditForAgency(
  auditId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Audit | null> {
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that audit.", 500);
  }

  return data ? mapAudit(data) : null;
}

async function replaceOpportunitySetForAudit(input: {
  audit: Audit;
  opportunities: ReturnType<typeof evaluateOpportunitiesForAudit>;
}) {
  const admin = createSupabaseAdminClient();
  const existingOpportunities = await listExistingOpportunitiesForAudit({
    admin,
    audit: input.audit,
  });
  const rows = createOpportunityInsertRows({
    audit: input.audit,
    opportunities: input.opportunities,
  });
  const removedOpportunityIds = existingOpportunities
    .filter(
      (opportunity) =>
        !rows.some((row) => row.rule_key === opportunity.rule_key),
    )
    .map((opportunity) => opportunity.id);
  const referencedOpportunityIds = await listProposalReferencedOpportunityIds({
    admin,
    agencyId: input.audit.agencyId,
    opportunityIds: removedOpportunityIds,
  });
  const plan = createOpportunityReconciliationPlan({
    existingOpportunities,
    nextRows: rows,
    referencedOpportunityIds,
  });

  if (plan.insertOrUpdateRows.length > 0) {
    const { error } = await admin
      .from("opportunities")
      .upsert(plan.insertOrUpdateRows, {
        onConflict: "audit_id,rule_key",
      });

    if (error) {
      throw new AppError("We could not store generated opportunities.", 500);
    }
  }

  if (plan.deleteOpportunityIds.length > 0) {
    const { error } = await admin
      .from("opportunities")
      .delete()
      .eq("agency_id", input.audit.agencyId)
      .in("id", plan.deleteOpportunityIds);

    if (error) {
      throw new AppError("We could not refresh the opportunity set.", 500);
    }
  }

  const { data, error } = await admin
    .from("opportunities")
    .select("*")
    .eq("agency_id", input.audit.agencyId)
    .eq("audit_id", input.audit.id);

  if (error) {
    throw new AppError("We could not load generated opportunities.", 500);
  }

  return sortOpportunities(data.map(mapOpportunity));
}

async function listExistingOpportunitiesForAudit(input: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  audit: Audit;
}) {
  const { data, error } = await input.admin
    .from("opportunities")
    .select("id, rule_key")
    .eq("agency_id", input.audit.agencyId)
    .eq("audit_id", input.audit.id);

  if (error) {
    throw new AppError("We could not load existing opportunities.", 500);
  }

  return data;
}

async function listProposalReferencedOpportunityIds(input: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  agencyId: string;
  opportunityIds: string[];
}) {
  if (input.opportunityIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await input.admin
    .from("proposal_opportunities")
    .select("opportunity_id")
    .eq("agency_id", input.agencyId)
    .in("opportunity_id", input.opportunityIds);

  if (error) {
    throw new AppError("We could not verify proposal-linked opportunities.", 500);
  }

  return new Set(data.map((row) => row.opportunity_id));
}

export function mapOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    agencyId: row.agency_id,
    auditId: row.audit_id,
    prospectId: row.prospect_id,
    agencyServiceId: row.agency_service_id,
    verticalKey: row.vertical_key,
    playbookVersion: row.playbook_version,
    ruleKey: row.rule_key,
    title: row.title,
    shortDescription: row.short_description,
    businessImpact: row.business_impact,
    evidence: parseOpportunityEvidence(row.evidence),
    priority: row.priority,
    confidence: row.confidence,
    recommendedServiceCategory: row.recommended_service_category,
    score: row.score,
    rankingRationale: row.ranking_rationale,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseOpportunityEvidence(value: unknown): OpportunityEvidence[] {
  const result = opportunityEvidenceSchema.array().safeParse(value);

  return result.success ? result.data : [];
}

function sortOpportunities(opportunities: Opportunity[]) {
  return [...opportunities].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftRuleOrder =
      opportunityRuleOrder[left.ruleKey as keyof typeof opportunityRuleOrder] ??
      Number.MAX_SAFE_INTEGER;
    const rightRuleOrder =
      opportunityRuleOrder[right.ruleKey as keyof typeof opportunityRuleOrder] ??
      Number.MAX_SAFE_INTEGER;

    return leftRuleOrder - rightRuleOrder;
  });
}
