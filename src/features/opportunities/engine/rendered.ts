import type { Audit } from "@/domain/audits/types";
import type { OpportunityDraft } from "../types";
import { readRenderedAudit } from "@/features/audits/rendered/pipeline";
import { sameSitePage } from "@/features/audits/rendered/discovery";
import { evaluateHvacOpportunityRules } from "../rules/hvac";

// One record per rule remains compatible with audit_id/rule_key uniqueness.
// Keep the first deterministic page/viewport instance rather than combining
// contradicting positive/negative observations into a whole-website claim.
export function evaluateRenderedOpportunities(audit: Audit): OpportunityDraft[] {
  const result = readRenderedAudit(audit.normalizedSignals);
  if (!result || result.entryUrl !== sameSitePage(audit.websiteUrl, audit.websiteUrl)) return [];
  const opportunities = new Map<string, OpportunityDraft>();
  for (const page of result.pages) {
    if (page.status !== 'observed' || !page.signals) continue;
    const pageAudit: Audit = { ...audit, finalUrl: page.finalUrl, normalizedSignals: page.signals };
    for (const opportunity of evaluateHvacOpportunityRules({ audit: pageAudit })) {
      if (opportunities.has(opportunity.ruleKey)) continue;
      const attribution = `Observed page: ${page.finalUrl} (${page.viewport}; ${page.source === 'rendered_dom' ? 'rendered snapshot' : 'static fallback'}). `;
      opportunities.set(opportunity.ruleKey, {
        ...opportunity,
        evidence: opportunity.evidence.map(item => ({
          ...item, details: attribution + item.details,
          analyzer_evidence: [{ source: page.source, detail: 'Exact observation source; sampled page only.', url: page.finalUrl }, ...(item.analyzer_evidence ?? []).slice(0, 4)],
        })),
      });
    }
  }
  return [...opportunities.values()];
}
