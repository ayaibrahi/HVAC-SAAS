import type { Audit } from "@/domain/audits/types";
import type { Json, Database } from "@/lib/supabase/database.types";
import type { RankedOpportunityDraft } from "@/features/opportunities/types";

type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityInsert =
  Database["public"]["Tables"]["opportunities"]["Insert"];

export type ExistingOpportunityForReconciliation = Pick<
  OpportunityRow,
  "id" | "rule_key"
>;

export type OpportunityReconciliationPlan = {
  insertOrUpdateRows: OpportunityInsert[];
  deleteOpportunityIds: string[];
  preservedRemovedOpportunityIds: string[];
};

export function createOpportunityInsertRows(input: {
  audit: Audit;
  opportunities: RankedOpportunityDraft[];
}): OpportunityInsert[] {
  const seenRuleKeys = new Set<string>();

  return input.opportunities.flatMap((opportunity) => {
    if (seenRuleKeys.has(opportunity.ruleKey)) {
      return [];
    }

    seenRuleKeys.add(opportunity.ruleKey);

    return [
      {
        agency_id: input.audit.agencyId,
        audit_id: input.audit.id,
        prospect_id: input.audit.prospectId,
        agency_service_id: opportunity.agencyServiceId,
        vertical_key: opportunity.verticalKey,
        playbook_version: opportunity.playbookVersion,
        rule_key: opportunity.ruleKey,
        title: opportunity.title,
        short_description: opportunity.shortDescription,
        business_impact: opportunity.businessImpact,
        evidence: opportunity.evidence as unknown as Json,
        priority: opportunity.priority,
        confidence: opportunity.confidence,
        recommended_service_category: opportunity.recommendedServiceCategory,
        score: opportunity.score,
        ranking_rationale: opportunity.rankingRationale,
      },
    ];
  });
}

export function createOpportunityReconciliationPlan(input: {
  existingOpportunities: ExistingOpportunityForReconciliation[];
  nextRows: OpportunityInsert[];
  referencedOpportunityIds: Set<string>;
}): OpportunityReconciliationPlan {
  const nextRows = dedupeRowsByRuleKey(input.nextRows);
  const nextRuleKeys = new Set(nextRows.map((row) => row.rule_key));
  const removedOpportunities = input.existingOpportunities.filter(
    (opportunity) => !nextRuleKeys.has(opportunity.rule_key),
  );

  return {
    insertOrUpdateRows: nextRows,
    deleteOpportunityIds: removedOpportunities
      .filter((opportunity) => !input.referencedOpportunityIds.has(opportunity.id))
      .map((opportunity) => opportunity.id),
    preservedRemovedOpportunityIds: removedOpportunities
      .filter((opportunity) => input.referencedOpportunityIds.has(opportunity.id))
      .map((opportunity) => opportunity.id),
  };
}

function dedupeRowsByRuleKey(rows: OpportunityInsert[]) {
  const seenRuleKeys = new Set<string>();

  return rows.filter((row) => {
    if (seenRuleKeys.has(row.rule_key)) {
      return false;
    }

    seenRuleKeys.add(row.rule_key);
    return true;
  });
}
