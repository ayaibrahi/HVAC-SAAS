import type { Audit } from "@/domain/audits/types";
import type { AgencyService } from "@/domain/services/types";
import { mapOpportunitiesToServices } from "@/features/opportunities/engine/map-services";
import { rankOpportunities } from "@/features/opportunities/engine/rank";
import { evaluateHvacOpportunityRules } from "@/features/opportunities/rules/hvac";
import { evaluateRenderedOpportunities } from "./rendered";
import type { RankedOpportunityDraft } from "@/features/opportunities/types";

export function evaluateOpportunitiesForAudit(input: {
  audit: Audit;
  agencyServices: AgencyService[];
}): RankedOpportunityDraft[] {
  const ruleResults =
    input.audit.verticalKey === "hvac"
      ? Object.hasOwn(input.audit.normalizedSignals, "renderedAudit")
        ? evaluateRenderedOpportunities(input.audit)
        : evaluateHvacOpportunityRules({ audit: input.audit })
      : [];

  return rankOpportunities(
    mapOpportunitiesToServices({
      opportunities: ruleResults,
      agencyServices: input.agencyServices,
    }),
  );
}
