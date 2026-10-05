import type { AgencyService } from "@/domain/services/types";
import type {
  MappedOpportunityDraft,
  OpportunityDraft,
  OpportunityRuleKey,
} from "@/features/opportunities/types";

type ServiceMatchProfile = {
  keywords: string[];
};

const serviceMatchProfiles: Record<OpportunityRuleKey, ServiceMatchProfile> = {
  missing_online_booking: {
    keywords: [
      "online booking",
      "booking integration",
      "booking",
      "scheduling",
      "schedule",
      "appointment",
    ],
  },
  weak_emergency_conversion: {
    keywords: [
      "emergency",
      "emergency landing",
      "landing page",
      "cta",
      "conversion",
    ],
  },
  financing_visibility: {
    keywords: [
      "financing",
      "finance",
      "payment plan",
      "monthly payment",
      "conversion section",
    ],
  },
  maintenance_plan_visibility: {
    keywords: [
      "maintenance plan",
      "service plan",
      "membership",
      "maintenance",
      "landing page",
      "conversion section",
    ],
  },
  service_area_local_seo: {
    keywords: [
      "service area",
      "areas served",
      "location page",
      "area page",
      "local seo",
      "seo",
    ],
  },
  hvac_service_visibility: {
    keywords: [
      "service page",
      "service pages",
      "hvac service",
      "landing page",
      "local seo",
      "seo",
    ],
  },
  weak_lead_capture: {
    keywords: [
      "conversion optimization",
      "lead capture",
      "cta",
      "contact form",
      "form",
      "conversion",
      "redesign",
    ],
  },
};

const genericStopWords = new Set([
  "and",
  "cta",
  "for",
  "hvac",
  "page",
  "pages",
  "section",
  "service",
  "services",
  "the",
]);

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
    .filter((candidate) => candidate.score >= 3)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const nameComparison = left.service.name.localeCompare(right.service.name);

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
  const name = normalizeSearchText(service.name);
  const description = normalizeSearchText(service.description ?? "");
  const category = normalizeSearchText(opportunity.recommendedServiceCategory);
  const categoryTerms = category
    .split(" ")
    .filter((term) => term.length > 3 && !genericStopWords.has(term));
  let score = 0;

  if (name.includes(category)) {
    score += 8;
  }

  for (const keyword of profile.keywords.map(normalizeSearchText)) {
    if (name.includes(keyword)) {
      score += 5;
    }

    if (description.includes(keyword)) {
      score += 2;
    }
  }

  for (const term of categoryTerms) {
    if (name.includes(term)) {
      score += 1;
    }

    if (description.includes(term)) {
      score += 1;
    }
  }

  return score;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
