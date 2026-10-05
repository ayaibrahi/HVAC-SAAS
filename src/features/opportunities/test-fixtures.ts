import type { Audit } from "@/domain/audits/types";
import type { AgencyService } from "@/domain/services/types";
import type {
  AuditSignal,
  NormalizedAuditSignals,
  SignalConfidence,
} from "@/features/audits/analyzer/signals";

export function makeAudit(
  signals: NormalizedAuditSignals,
  overrides: Partial<Audit> = {},
): Audit {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    agencyId: "22222222-2222-4222-8222-222222222222",
    prospectId: "33333333-3333-4333-8333-333333333333",
    status: "completed",
    websiteUrl: "https://example.com",
    finalUrl: "https://example.com",
    startedAt: "2026-09-23T00:00:00.000Z",
    completedAt: "2026-09-23T00:01:00.000Z",
    errorCode: null,
    errorMessage: null,
    normalizedSignals: signals as unknown as Record<string, unknown>,
    signalSchemaVersion: "1.0.0",
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:01:00.000Z",
    ...overrides,
  };
}

export function makeDetectedSignals(): NormalizedAuditSignals {
  return {
    schemaVersion: "1.0.0",
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    analyzedUrl: "https://example.com",
    finalUrl: "https://example.com",
    fetchedAt: "2026-09-23T00:00:30.000Z",
    fetch: {
      httpStatus: signal(200),
      responseTimeMs: signal(250),
      responseSizeBytes: signal(10000),
      redirectCount: signal(0),
      httpsEnabled: signal(true),
    },
    page: {
      title: signal("Example HVAC"),
      metaDescription: signal("Heating and cooling services"),
      canonicalUrl: signal("https://example.com"),
      h1Count: signal(1),
      h2Count: signal(3),
      hasViewportMeta: signal(true),
      robotsMeta: signal(null),
      hasJsonLd: signal(true),
      imageCount: signal(4),
      imagesMissingAlt: signal(0),
    },
    contactConversion: {
      phoneDetected: signal(true),
      emailDetected: signal(true),
      contactLinkDetected: signal(true),
      contactFormDetected: signal(true),
      ctaCount: signal(3),
      bookingLinkDetected: signal(true),
      estimateLinkDetected: signal(true),
    },
    hvac: {
      emergencyService: signal(true),
      maintenancePlan: signal(true),
      financing: signal(true),
      serviceArea: signal(true),
      hvacServicePages: signal({
        detected: true,
        services: ["Air conditioning", "Heating", "Furnace"],
      }),
      onlineBooking: signal(true),
      requestEstimate: signal(true),
    },
  };
}

export function signal<T>(
  value: T,
  confidence: SignalConfidence = "high",
): AuditSignal<T> {
  return {
    value,
    confidence,
    evidence: [
      {
        source: "test",
        detail: `Observed ${String(value)}.`,
      },
    ],
  };
}

export function makeService(
  overrides: Partial<AgencyService> & Pick<AgencyService, "id" | "name">,
): AgencyService {
  return {
    agencyId: "agency-1",
    description: null,
    price: 500,
    currency: "USD",
    isActive: true,
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}
