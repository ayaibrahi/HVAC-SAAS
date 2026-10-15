import { describe, expect, it } from "vitest";
import type { OpportunityRuleKey } from "../types";
import {
  makeAudit,
  makeDetectedSignals,
  makeService,
  signal,
} from "../test-fixtures";
import { evaluateHvacOpportunityRules } from "../rules/hvac";
import {
  mapOpportunityToAgencyService,
  mapOpportunitiesToServices,
} from "./map-services";
import { evaluateOpportunitiesForAudit } from "./evaluate";
import { rankOpportunities } from "./rank";

// Synthetic normalized signals only: no customer website is fetched or represented.
const signals = makeDetectedSignals();
signals.hvac.onlineBooking = signal(false);
signals.hvac.emergencyService = signal(false);
signals.hvac.financing = signal(false);
signals.hvac.maintenancePlan = signal(false);
signals.hvac.serviceArea = signal(false);
signals.hvac.hvacServicePages = signal({ detected: false, services: [] });
signals.contactConversion.ctaCount = signal(0);
const audit = makeAudit(signals);
const findings = evaluateHvacOpportunityRules({ audit });
type Case = {
  label: string;
  rule: OpportunityRuleKey;
  name: string;
  description?: string;
  expected: "catalog-service" | null;
};
const cases: Case[] = [
  {
    label: "financing section",
    rule: "financing_visibility",
    name: "Financing Conversion Section",
    expected: "catalog-service",
  },
  {
    label: "payment-plan messaging",
    rule: "financing_visibility",
    name: "Payment Plan Content",
    expected: "catalog-service",
  },
  {
    label: "generic redesign with explicit financing scope",
    rule: "financing_visibility",
    name: "Website Redesign",
    description:
      "Create financing information sections and payment plan pages.",
    expected: "catalog-service",
  },
  {
    label: "booking is not financing",
    rule: "financing_visibility",
    name: "Booking Integration",
    description:
      "Appointment scheduling and a conversion section for your website.",
    expected: null,
  },
  {
    label: "generic conversion section is not financing",
    rule: "financing_visibility",
    name: "Conversion Section",
    expected: null,
  },
  {
    label: "equipment finance is not website visibility work",
    rule: "financing_visibility",
    name: "Equipment Financing",
    description: "Loans for new vans and tools.",
    expected: null,
  },
  {
    label: "financing exclusion",
    rule: "financing_visibility",
    name: "Website Redesign",
    description: "We do not include financing sections.",
    expected: null,
  },
  {
    label: "online booking integration",
    rule: "missing_online_booking",
    name: "Online Booking Integration",
    expected: "catalog-service",
  },
  {
    label: "appointment scheduling",
    rule: "missing_online_booking",
    name: "Appointment Scheduling Setup",
    expected: "catalog-service",
  },
  {
    label: "description-only booking capability",
    rule: "missing_online_booking",
    name: "Website Improvements",
    description: "Add online booking and appointment scheduling.",
    expected: "catalog-service",
  },
  {
    label: "booking with no fee qualifier",
    rule: "missing_online_booking",
    name: "Online Booking Integration",
    description: "Online booking integration with no monthly fees.",
    expected: "catalog-service",
  },
  {
    label: "bookkeeping substring",
    rule: "missing_online_booking",
    name: "Bookkeeping Integration",
    expected: null,
  },
  {
    label: "plain redesign does not imply scheduling",
    rule: "missing_online_booking",
    name: "Website Redesign",
    expected: null,
  },
  {
    label: "explicitly excluded booking",
    rule: "missing_online_booking",
    name: "Website Redesign",
    description: "Online booking is not included.",
    expected: null,
  },
  {
    label: "emergency landing page",
    rule: "weak_emergency_conversion",
    name: "Emergency HVAC Landing Page",
    expected: "catalog-service",
  },
  {
    label: "emergency CTA",
    rule: "weak_emergency_conversion",
    name: "Emergency CTA Design",
    expected: "catalog-service",
  },
  {
    label: "generic conversion with explicit emergency work",
    rule: "weak_emergency_conversion",
    name: "Conversion Optimization",
    description: "Improve emergency service messaging and emergency CTAs.",
    expected: "catalog-service",
  },
  {
    label: "known financing to emergency false positive",
    rule: "weak_emergency_conversion",
    name: "Financing Conversion Section",
    expected: null,
  },
  {
    label: "generic landing page not emergency",
    rule: "weak_emergency_conversion",
    name: "Landing Page",
    expected: null,
  },
  {
    label: "emergency IT support unrelated",
    rule: "weak_emergency_conversion",
    name: "Emergency Server Recovery",
    expected: null,
  },
  {
    label: "maintenance landing page",
    rule: "maintenance_plan_visibility",
    name: "Maintenance Plan Landing Page",
    expected: "catalog-service",
  },
  {
    label: "membership promotion",
    rule: "maintenance_plan_visibility",
    name: "Membership Landing Page",
    expected: "catalog-service",
  },
  {
    label: "membership description",
    rule: "maintenance_plan_visibility",
    name: "Website Content",
    description: "Create membership pages to promote HVAC maintenance plans.",
    expected: "catalog-service",
  },
  {
    label: "website maintenance unrelated",
    rule: "maintenance_plan_visibility",
    name: "Website Maintenance",
    expected: null,
  },
  {
    label: "financing section not maintenance promotion",
    rule: "maintenance_plan_visibility",
    name: "Financing Conversion Section",
    expected: null,
  },
  {
    label: "contact form integration",
    rule: "weak_lead_capture",
    name: "Contact Form Integration",
    expected: "catalog-service",
  },
  {
    label: "CTA redesign",
    rule: "weak_lead_capture",
    name: "Call-to-Action Redesign",
    expected: "catalog-service",
  },
  {
    label: "generic website conversion applies to lead capture",
    rule: "weak_lead_capture",
    name: "Website Conversion Optimization",
    expected: "catalog-service",
  },
  {
    label: "website redesign applies to weak lead capture",
    rule: "weak_lead_capture",
    name: "Website Redesign",
    expected: "catalog-service",
  },
  {
    label: "mobile CTA capability for supported lead capture",
    rule: "weak_lead_capture",
    name: "Mobile Conversion Optimization",
    description: "Improve mobile CTAs and contact forms.",
    expected: "catalog-service",
  },
  {
    label: "general optimization with explicit contact scope",
    rule: "weak_lead_capture",
    name: "Website Optimization",
    description: "Improve contact forms and call to action placement.",
    expected: "catalog-service",
  },
  {
    label: "general optimization ambiguous without scope",
    rule: "weak_lead_capture",
    name: "Website Optimization",
    description:
      "Help HVAC businesses and customers with website marketing services.",
    expected: null,
  },
  {
    label: "platform substring",
    rule: "weak_lead_capture",
    name: "Platform Integration",
    expected: null,
  },
  {
    label: "file conversion unrelated",
    rule: "weak_lead_capture",
    name: "File Conversion",
    expected: null,
  },
  {
    label: "logo redesign unrelated",
    rule: "weak_lead_capture",
    name: "Logo Redesign",
    expected: null,
  },
  {
    label: "financing conversion not generic lead capture",
    rule: "weak_lead_capture",
    name: "Financing Conversion Section",
    expected: null,
  },
  {
    label: "local SEO",
    rule: "service_area_local_seo",
    name: "Local SEO Setup",
    expected: "catalog-service",
  },
  {
    label: "area pages",
    rule: "service_area_local_seo",
    name: "Service Area Pages",
    expected: "catalog-service",
  },
  {
    label: "SEO package with explicit location work",
    rule: "service_area_local_seo",
    name: "SEO Package",
    description: "Build location pages and areas served sections.",
    expected: "catalog-service",
  },
  {
    label: "generic SEO ambiguous",
    rule: "service_area_local_seo",
    name: "SEO",
    description: "Backlink outreach only.",
    expected: null,
  },
  {
    label: "service pages",
    rule: "hvac_service_visibility",
    name: "HVAC Service Pages",
    expected: "catalog-service",
  },
  {
    label: "service content scope",
    rule: "hvac_service_visibility",
    name: "Content Optimization",
    description: "Create dedicated service pages for heating and cooling.",
    expected: "catalog-service",
  },
  {
    label: "local SEO without service-page scope ambiguous",
    rule: "hvac_service_visibility",
    name: "Local SEO",
    expected: null,
  },
  {
    label: "social posts unrelated",
    rule: "hvac_service_visibility",
    name: "Social Media Marketing",
    expected: null,
  },
  {
    label: "explicit conflicting description vetoes name",
    rule: "missing_online_booking",
    name: "Online Booking Integration",
    description: "Booking integration is excluded from this package.",
    expected: null,
  },
];

describe("high-precision HVAC agency catalog dataset", () => {
  it.each(cases)("$label", ({ rule, name, description, expected }) => {
    const finding = findings.find((item) => item.ruleKey === rule)!;
    const service = makeService({
      id: "catalog-service",
      name,
      description: description ?? null,
    });
    expect(mapOpportunityToAgencyService(finding, [service])).toBe(expected);
  });
  it("leaves every finding unmatched for an empty or inactive catalog", () => {
    for (const finding of findings) {
      expect(mapOpportunityToAgencyService(finding, [])).toBeNull();
      expect(
        mapOpportunityToAgencyService(finding, [
          makeService({
            id: "inactive",
            name: finding.recommendedServiceCategory,
            isActive: false,
          }),
        ]),
      ).toBeNull();
    }
  });
  it("selects the specific name over description-only scope and resolves ties independently of input order", () => {
    const finding = findings.find(
      (item) => item.ruleKey === "financing_visibility",
    )!;
    const specific = makeService({
      id: "specific",
      name: "Financing Conversion Section",
    });
    const broad = makeService({
      id: "broad",
      name: "Website Redesign",
      description: "Create financing sections.",
    });
    for (const catalog of [
      [specific, broad],
      [broad, specific],
    ])
      expect(mapOpportunityToAgencyService(finding, catalog)).toBe("specific");
    const duplicate = { ...specific, id: "a-specific" };
    for (const catalog of [
      [specific, duplicate],
      [duplicate, specific],
    ])
      expect(mapOpportunityToAgencyService(finding, catalog)).toBe(
        "a-specific",
      );
  });
  it("preserves evidence, page scope and deterministic facts without mutating inputs", () => {
    const before = structuredClone(findings);
    const mapped = mapOpportunitiesToServices({
      opportunities: findings,
      agencyServices: [
        makeService({ id: "book", name: "Online Booking Integration" }),
      ],
    });
    expect(findings).toEqual(before);
    mapped.forEach(({ agencyServiceId, ...finding }, i) => {
      expect(finding).toEqual(before[i]);
      expect(["book", null]).toContain(agencyServiceId);
      expect(
        finding.evidence.every((item) => item.scope === "analyzed_page"),
      ).toBe(true);
    });
  });
  it("does not invent a mobile opportunity from viewport metadata alone", () => {
    const mobile = makeDetectedSignals();
    mobile.page.hasViewportMeta = signal(false);
    expect(
      evaluateOpportunitiesForAudit({
        audit: makeAudit(mobile),
        agencyServices: [
          makeService({ id: "mobile", name: "Mobile Conversion Optimization" }),
        ],
      }),
    ).toEqual([]);
  });
  it("does not let matching alter rule evaluation or ranking weights", () => {
    const catalog = [
      makeService({ id: "financing", name: "Financing Conversion Section" }),
    ];
    const first = evaluateOpportunitiesForAudit({
      audit,
      agencyServices: catalog,
    });
    expect(first).toEqual(
      evaluateOpportunitiesForAudit({ audit, agencyServices: catalog }),
    );
    expect(first.length).toBeLessThanOrEqual(5);
    expect(
      first.find((item) => item.ruleKey === "weak_emergency_conversion")
        ?.agencyServiceId,
    ).toBeNull();
    for (const finding of findings) {
      const [unmatched] = rankOpportunities([
        { ...finding, agencyServiceId: null },
      ]);
      const [mapped] = rankOpportunities(
        mapOpportunitiesToServices({
          opportunities: [finding],
          agencyServices: catalog,
        }),
      );
      expect(mapped.score).toBe(
        Math.min(
          100,
          unmatched.score +
            (finding.ruleKey === "financing_visibility" ? 12 : 0),
        ),
      );
      expect(mapped.evidence).toEqual(finding.evidence);
      expect(mapped.priority).toBe(finding.priority);
      expect(mapped.confidence).toBe(finding.confidence);
    }
  });
});
