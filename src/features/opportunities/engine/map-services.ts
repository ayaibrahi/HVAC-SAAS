import type { AgencyService } from "@/domain/services/types";
import { readApprovedServiceScope } from "@/lib/validation/service-scope";
import type {
  MappedOpportunityDraft,
  OpportunityDraft,
  OpportunityRuleKey,
} from "@/features/opportunities/types";

type ServiceMatchProfile = {
  phrases: string[];
  scopePhrases?: string[];
  exclusionTopics: string[];
  exactNames?: string[];
};

// Capabilities, not shared marketing vocabulary. Generic conversion work belongs
// to lead capture; specialized findings need an explicit corresponding scope.
const serviceMatchProfiles: Record<OpportunityRuleKey, ServiceMatchProfile> = {
  missing_online_booking: {
    scopePhrases: ["appointment link", "booking link"],
    phrases: [
      "online booking",
      "booking integration",
      "booking landing page",
      "appointment scheduling",
      "appointment booking",
      "scheduling integration",
    ],
    exclusionTopics: ["booking", "scheduling", "appointments"],
  },
  weak_emergency_conversion: {
    phrases: [
      "emergency hvac landing page",
      "emergency landing page",
      "emergency service page",
      "emergency cta",
      "emergency ctas",
      "emergency call to action",
      "emergency service messaging",
      "emergency messaging",
    ],
    exclusionTopics: ["emergency"],
  },
  financing_visibility: {
    phrases: [
      "financing conversion section",
      "financing section",
      "financing sections",
      "financing information",
      "financing page",
      "financing pages",
      "financing visibility",
      "financing messaging",
      "payment plan content",
      "payment plan page",
      "payment plan pages",
      "payment plan section",
      "payment plan sections",
    ],
    exclusionTopics: ["financing", "payment plan", "payment plans"],
  },
  maintenance_plan_visibility: {
    phrases: [
      "maintenance plan landing page",
      "maintenance plan page",
      "maintenance plan pages",
      "maintenance plan promotion",
      "maintenance plan messaging",
      "membership landing page",
      "membership page",
      "membership pages",
      "membership promotion",
      "service plan landing page",
    ],
    exclusionTopics: [
      "maintenance plan",
      "maintenance plans",
      "membership",
      "memberships",
    ],
  },
  service_area_local_seo: {
    phrases: [
      "service area page",
      "service area pages",
      "service area information",
      "areas served",
      "location page",
      "location pages",
      "local seo",
    ],
    exclusionTopics: [
      "service area",
      "service areas",
      "location pages",
      "local seo",
    ],
  },
  hvac_service_visibility: {
    phrases: [
      "service page",
      "service pages",
      "service navigation",
      "service link",
      "service links",
    ],
    exclusionTopics: ["service page", "service pages", "service links"],
  },
  weak_lead_capture: {
    scopePhrases: ["contact action", "phone link", "contact cta", "cta wording"],
    phrases: [
      "website conversion optimization",
      "mobile conversion optimization",
      "landing page conversion optimization",
      "lead capture",
      "cta redesign",
      "cta design",
      "call to action",
      "contact form",
      "contact forms",
      "website redesign",
    ],
    exactNames: ["conversion optimization", "conversion rate optimization"],
    exclusionTopics: [
      "contact form",
      "contact forms",
      "cta",
      "ctas",
      "call to action",
      "lead capture",
      "conversion optimization",
      "website redesign",
    ],
  },
};

export function mapOpportunitiesToServices(input: {
  opportunities: OpportunityDraft[];
  agencyServices: AgencyService[];
}): MappedOpportunityDraft[] {
  return input.opportunities.map((opportunity) => ({
    ...opportunity,
    agencyServiceId: mapOpportunityToAgencyService(
      opportunity,
      input.agencyServices,
    ),
  }));
}

export function mapOpportunityToAgencyService(
  opportunity: OpportunityDraft,
  agencyServices: AgencyService[],
) {
  const activeServices = agencyServices.filter((service) => service.isActive);
  const candidates = activeServices
    .map((service) => ({
      service,
      score: scoreServiceMatch(opportunity, service),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const nameComparison = left.service.name.localeCompare(
        right.service.name,
      );

      return nameComparison === 0
        ? left.service.id.localeCompare(right.service.id)
        : nameComparison;
    });

  return candidates[0]?.service.id ?? null;
}

function scoreServiceMatch(
  opportunity: OpportunityDraft,
  service: AgencyService,
) {
  const profile = serviceMatchProfiles[opportunity.ruleKey];
  if (service.approvedScope != null) {
    const scope = readApprovedServiceScope(service.approvedScope);
    if (!scope) return 0;
    const deliverables = normalizeSearchText(scope.deliverables);
    const exclusions = normalizeSearchText(scope.exclusions);
    const approvedProfile = { ...profile, exclusionTopics: [...profile.exclusionTopics, ...(profile.scopePhrases ?? [])] };
    // Explicit approved scope overrides marketing labels. Conservatively leave
    // ambiguous/excluded capabilities unmatched; never rewrite scope or prices.
    if (approvedProfile.exclusionTopics.some(topic => hasPhrase(exclusions, topic)) ||
        hasScopeExclusion(deliverables, approvedProfile)) return 0;
    return [...profile.phrases, ...(profile.scopePhrases ?? [])].some(phrase => hasPhrase(deliverables, phrase)) ? 100 : 0;
  }
  const name = normalizeSearchText(service.name);
  const description = normalizeSearchText(service.description ?? "");
  if (
    hasScopeExclusion(name, profile) ||
    hasScopeExclusion(description, profile)
  )
    return 0;

  // Do not accumulate weak/repeated words. A named capability outranks one in
  // the description, and the canonical category only breaks already-valid ties.
  const named = profile.phrases.some((phrase) => hasPhrase(name, phrase));
  const described = profile.phrases.some((phrase) =>
    hasPhrase(description, phrase),
  );
  if (!named && !described && !profile.exactNames?.includes(name)) return 0;
  const category = normalizeSearchText(opportunity.recommendedServiceCategory);
  return (
    (named ? 100 : profile.exactNames?.includes(name) ? 80 : 50) +
    (hasPhrase(name, category) ? 20 : 0)
  );
}

function hasPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

function hasScopeExclusion(text: string, profile: ServiceMatchProfile) {
  // Finite English scope exclusions, not a claim to parse arbitrary prose.
  // Topic proximity avoids treating "booking with no monthly fees" as excluded.
  return profile.exclusionTopics.some((topic) =>
    new RegExp(
      `\\b(?:no|not|without|except|exclude[sd]?|excluding) (?:[a-z]+ ){0,3}${topic}\\b|\\b${topic} (?:[a-z]+ ){0,3}(?:not included|not offered|not supported|excluded)\\b`,
    ).test(text),
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
