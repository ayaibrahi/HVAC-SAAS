import type { Audit } from "@/domain/audits/types";
import { hasVerifiedPageContent } from "@/features/audits/analyzer/content-quality";
import type { OpportunityEvidence } from "@/domain/opportunities/types";
import {
  createOpportunityEvidence,
  getBooleanSignal,
  getHvacServicePagesSignal,
  getNumberSignal,
} from "@/features/opportunities/engine/signal-utils";
import type { OpportunityDraft } from "@/features/opportunities/types";

const coreHvacServices = ["Air conditioning", "Heating", "Furnace"] as const;

export function evaluateHvacOpportunityRules(input: {
  audit: Audit;
}): OpportunityDraft[] {
  if (
    input.audit.verticalKey !== "hvac" ||
    !hasVerifiedPageContent(input.audit.normalizedSignals)
  ) {
    return [];
  }

  const context = {
    signals: input.audit.normalizedSignals,
    verticalKey: input.audit.verticalKey,
    playbookVersion: input.audit.playbookVersion,
  };

  return [
    evaluateOnlineBooking(context),
    evaluateEmergencyConversion(context),
    evaluateFinancing(context),
    evaluateMaintenancePlans(context),
    evaluateServiceAreas(context),
    evaluateHvacServiceCoverage(context),
    evaluateLeadCapture(context),
  ].filter((opportunity): opportunity is OpportunityDraft =>
    Boolean(opportunity),
  );
}

type RuleContext = {
  signals: Record<string, unknown>;
  verticalKey: "hvac";
  playbookVersion: string;
};

function evaluateOnlineBooking(context: RuleContext): OpportunityDraft | null {
  const onlineBooking = getBooleanSignal(context.signals, [
    "hvac",
    "onlineBooking",
  ]);

  if (!onlineBooking || onlineBooking.value !== false) {
    return null;
  }

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "missing_online_booking",
    title: "Missing Online Booking",
    shortDescription:
      "Online booking or scheduling was not detected on the analyzed page.",
    businessImpact:
      "Clear booking paths can reduce friction for high-intent visitors and improve lead capture.",
    evidence: [
      createOpportunityEvidence(
        "hvac.onlineBooking",
        onlineBooking,
        "No booking-related link or CTA was detected on the analyzed page.",
      ),
    ],
    priority: "high",
    confidence: onlineBooking.confidence,
    recommendedServiceCategory: "Online Booking Integration",
  };
}

function evaluateEmergencyConversion(
  context: RuleContext,
): OpportunityDraft | null {
  const emergencyService = getBooleanSignal(context.signals, [
    "hvac",
    "emergencyService",
  ]);

  if (!emergencyService || emergencyService.value !== false) {
    return null;
  }

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "weak_emergency_conversion",
    title: "Weak Emergency-Service Conversion",
    shortDescription:
      "Emergency-service messaging was not detected on the analyzed page.",
    businessImpact:
      "Stronger emergency positioning can help capture urgent HVAC demand when visitors need immediate help.",
    evidence: [
      createOpportunityEvidence(
        "hvac.emergencyService",
        emergencyService,
        "Emergency HVAC wording or an emergency CTA was not detected on the analyzed page.",
      ),
    ],
    priority: "high",
    confidence: emergencyService.confidence,
    recommendedServiceCategory: "Emergency HVAC Landing Page",
  };
}

function evaluateFinancing(context: RuleContext): OpportunityDraft | null {
  const financing = getBooleanSignal(context.signals, ["hvac", "financing"]);

  if (!financing || financing.value !== false) {
    return null;
  }

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "financing_visibility",
    title: "Financing Visibility Opportunity",
    shortDescription:
      "Financing information was not detected on the analyzed page.",
    businessImpact:
      "Visible financing messaging can reduce price hesitation on larger repair or replacement decisions.",
    evidence: [
      createOpportunityEvidence(
        "hvac.financing",
        financing,
        "Financing or payment-plan wording was not detected on the analyzed page.",
      ),
    ],
    priority: "medium",
    confidence: financing.confidence,
    recommendedServiceCategory: "Financing Conversion Section",
  };
}

function evaluateMaintenancePlans(
  context: RuleContext,
): OpportunityDraft | null {
  const maintenancePlan = getBooleanSignal(context.signals, [
    "hvac",
    "maintenancePlan",
  ]);

  if (!maintenancePlan || maintenancePlan.value !== false) {
    return null;
  }

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "maintenance_plan_visibility",
    title: "Maintenance Plan Visibility",
    shortDescription:
      "Maintenance-plan messaging was not detected on the analyzed page.",
    businessImpact:
      "Maintenance-plan visibility can support recurring-service promotion and repeat-customer lead capture.",
    evidence: [
      createOpportunityEvidence(
        "hvac.maintenancePlan",
        maintenancePlan,
        "Maintenance-plan, service-plan, or tune-up-plan wording was not detected on the analyzed page.",
      ),
    ],
    priority: "medium",
    confidence: maintenancePlan.confidence,
    recommendedServiceCategory: "Maintenance Plan Landing Page",
  };
}

function evaluateServiceAreas(context: RuleContext): OpportunityDraft | null {
  const serviceArea = getBooleanSignal(context.signals, [
    "hvac",
    "serviceArea",
  ]);

  if (!serviceArea || serviceArea.value !== false) {
    return null;
  }

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "service_area_local_seo",
    title: "Service Area / Local SEO Opportunity",
    shortDescription:
      "Service-area information was not clearly detected on the analyzed page.",
    businessImpact:
      "Clear service-area signals can support local discoverability and help visitors confirm fit quickly.",
    evidence: [
      createOpportunityEvidence(
        "hvac.serviceArea",
        serviceArea,
        "Service-area or areas-served wording was not detected on the analyzed page.",
      ),
    ],
    priority: "high",
    confidence: serviceArea.confidence,
    recommendedServiceCategory: "Service Area Pages / Local SEO",
  };
}

function evaluateHvacServiceCoverage(
  context: RuleContext,
): OpportunityDraft | null {
  const servicePages = getHvacServicePagesSignal(context.signals);

  if (!servicePages) {
    return null;
  }

  const detectedServices = new Set(
    servicePages.value.services.map((service) => normalizeServiceName(service)),
  );
  const missingServices = coreHvacServices.filter(
    (service) => !detectedServices.has(normalizeServiceName(service)),
  );

  if (missingServices.length === 0) {
    return null;
  }

  const details =
    servicePages.value.services.length > 0
      ? `This analyzed page surfaces ${servicePages.value.services.join(
          ", ",
        )}, but does not clearly surface a dedicated page/link for ${formatList(
          missingServices,
        )}.`
      : `This analyzed page does not clearly surface dedicated page links for ${formatList(
          missingServices,
        )}.`;

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "hvac_service_visibility",
    title: "HVAC Service Coverage Opportunity",
    shortDescription:
      "Core HVAC service links are not fully surfaced on the analyzed page.",
    businessImpact:
      "Clear service visibility can help visitors find relevant HVAC services and support service-intent landing pages.",
    evidence: [
      createOpportunityEvidence("hvac.hvacServicePages", servicePages, details),
    ],
    priority: "medium",
    confidence: servicePages.confidence,
    recommendedServiceCategory: "HVAC Service Pages",
  };
}

function evaluateLeadCapture(context: RuleContext): OpportunityDraft | null {
  const ctaCount = getNumberSignal(context.signals, [
    "contactConversion",
    "ctaCount",
  ]);
  const phoneDetected = getBooleanSignal(context.signals, [
    "contactConversion",
    "phoneDetected",
  ]);
  const contactLinkDetected = getBooleanSignal(context.signals, [
    "contactConversion",
    "contactLinkDetected",
  ]);
  const contactFormDetected = getBooleanSignal(context.signals, [
    "contactConversion",
    "contactFormDetected",
  ]);

  const evidence: OpportunityEvidence[] = [];

  if (ctaCount?.value === 0) {
    evidence.push(
      createOpportunityEvidence(
        "contactConversion.ctaCount",
        ctaCount,
        "No CTA-like links or buttons were detected on the analyzed page.",
      ),
    );
  }

  if (
    phoneDetected?.value === false &&
    contactLinkDetected?.value === false &&
    contactFormDetected?.value === false
  ) {
    evidence.push(
      createOpportunityEvidence(
        "contactConversion.phoneDetected",
        phoneDetected,
        "No phone number was detected on the analyzed page.",
      ),
      createOpportunityEvidence(
        "contactConversion.contactLinkDetected",
        contactLinkDetected,
        "No contact link was detected on the analyzed page.",
      ),
      createOpportunityEvidence(
        "contactConversion.contactFormDetected",
        contactFormDetected,
        "No contact or conversion form was detected on the analyzed page.",
      ),
    );
  }

  if (evidence.length === 0) {
    return null;
  }

  return {
    verticalKey: context.verticalKey,
    playbookVersion: context.playbookVersion,
    ruleKey: "weak_lead_capture",
    title: "Weak Lead Capture",
    shortDescription:
      "The analyzed page has limited deterministic lead-capture signals.",
    businessImpact:
      "Stronger CTAs and contact paths can improve conversion from high-intent HVAC visitors.",
    evidence,
    priority: "high",
    confidence: evidence.some(
      (item) => item.signal === "contactConversion.ctaCount",
    )
      ? "high"
      : "medium",
    recommendedServiceCategory: "Conversion Optimization / CTA Redesign",
  };
}

function normalizeServiceName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatList(values: readonly string[]) {
  if (values.length === 1) {
    return values[0];
  }

  const leading = values.slice(0, -1).join(", ");
  const finalValue = values[values.length - 1];

  return `${leading}, and ${finalValue}`;
}
