import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";
import {
  getCanonicalUrl,
  getMetaContent,
  parseHtmlDocument,
  type HtmlElement,
  type HtmlLink,
} from "@/features/audits/analyzer/html";
import type { SafeFetchResult } from "@/features/audits/analyzer/safe-fetch";
import { assessContentQuality, type ContentQuality } from "./content-quality";

export const auditSignalSchemaVersion = "1.0.0";

export type SignalConfidence = "high" | "medium" | "low";

export type SignalEvidence = {
  source: string;
  detail: string;
  snippet?: string;
  url?: string;
  count?: number;
};

export type AuditSignal<T> = {
  value: T;
  confidence: SignalConfidence;
  evidence: SignalEvidence[];
};

export type NormalizedAuditSignals = {
  quality?: ContentQuality;
  schemaVersion: string;
  verticalKey: VerticalPlaybookKey;
  playbookVersion: string;
  analyzedUrl: string;
  finalUrl: string;
  fetchedAt: string;
  fetch: {
    httpStatus: AuditSignal<number>;
    responseTimeMs: AuditSignal<number>;
    responseSizeBytes: AuditSignal<number>;
    redirectCount: AuditSignal<number>;
    httpsEnabled: AuditSignal<boolean>;
  };
  page: {
    title: AuditSignal<string | null>;
    metaDescription: AuditSignal<string | null>;
    canonicalUrl: AuditSignal<string | null>;
    h1Count: AuditSignal<number>;
    h2Count: AuditSignal<number>;
    hasViewportMeta: AuditSignal<boolean>;
    robotsMeta: AuditSignal<string | null>;
    hasJsonLd: AuditSignal<boolean>;
    imageCount: AuditSignal<number>;
    imagesMissingAlt: AuditSignal<number>;
  };
  contactConversion: {
    phoneDetected: AuditSignal<boolean>;
    emailDetected: AuditSignal<boolean>;
    contactLinkDetected: AuditSignal<boolean>;
    contactFormDetected: AuditSignal<boolean>;
    ctaCount: AuditSignal<number>;
    bookingLinkDetected: AuditSignal<boolean>;
    estimateLinkDetected: AuditSignal<boolean>;
  };
  hvac: {
    emergencyService: AuditSignal<boolean>;
    maintenancePlan: AuditSignal<boolean>;
    financing: AuditSignal<boolean>;
    serviceArea: AuditSignal<boolean>;
    hvacServicePages: AuditSignal<{
      detected: boolean;
      services: string[];
    }>;
    onlineBooking: AuditSignal<boolean>;
    requestEstimate: AuditSignal<boolean>;
  };
};

export function extractNormalizedAuditSignals(input: {
  fetchResult: SafeFetchResult;
  verticalKey: VerticalPlaybookKey;
  playbookVersion: string;
  fetchedAt?: string;
}): NormalizedAuditSignals {
  const document = parseHtmlDocument(
    input.fetchResult.html,
    input.fetchResult.finalUrl,
  );
  const metaDescription = getMetaContent(document, "description");
  const viewportMeta = getMetaContent(document, "viewport");
  const robotsMeta = getMetaContent(document, "robots");
  const canonicalUrl = getCanonicalUrl(document, input.fetchResult.finalUrl);
  const imagesMissingAlt = document.images.filter(isMissingAlt).length;
  const phoneEvidence = [
    ...findPatternEvidence(
      document.visibleText,
      /\b(?:\+?1[\s.-]?)?(?:\(?[2-9]\d{2}\)?[\s.-]?)?[2-9]\d{2}[\s.-]?\d{4}\b/,
      "phone number",
    ),
    ...document.anchors
      .filter((link) => /^tel:\+?[\d(][\d() .-]{4,}/i.test(link.href ?? ""))
      .slice(0, 5)
      .map((link) =>
        evidence("link", "Phone link detected.", link.text, link.href),
      ),
  ];
  const emailEvidence = findPatternEvidence(
    document.visibleText,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    "email address",
  );
  const contactLinkEvidence = findLinkEvidence(
    document.anchors,
    /(contact|contact-us|get-in-touch)/i,
    "Contact link",
  );
  const contactFormEvidence = findFormEvidence(document.forms);
  const ctaEvidence = findCtaEvidence(
    document.anchors,
    document.buttons,
    document.inputs,
  );
  const bookingEvidence = [
    ...findLinkEvidence(
      document.anchors,
      /(book|booking|schedule|appointment)/i,
      "Booking or scheduling link",
    ),
    ...document.buttons
      .filter((button) =>
        /(book|booking|schedule|appointment)/i.test(
          `${button.text} ${button.attrs["aria-label"] ?? ""} ${button.attrs.title ?? ""}`,
        ),
      )
      .slice(0, 5)
      .map((button) =>
        evidence(
          "button",
          "Booking or scheduling control detected.",
          button.text || button.attrs["aria-label"],
        ),
      ),
  ];
  const estimateEvidence = findLinkEvidence(
    document.anchors,
    /(estimate|quote)/i,
    "Quote or estimate link",
  );
  const emergencyEvidence = [
    ...findPatternEvidence(
      document.visibleText,
      /(24\s*\/\s*7|24-hour|24 hour|emergency)\s+(ac|air conditioning|heating|hvac|furnace|cooling|repair|service)/i,
      "emergency HVAC wording",
    ),
    ...findLinkEvidence(
      document.anchors,
      /emergency[-\s/]*(?:hvac|ac|heating|air|service|repair)|(?:hvac|ac|heating)[-\s]*emergenc/i,
      "Emergency service link detected.",
    ),
  ];
  const maintenanceEvidence = findPatternEvidence(
    document.visibleText,
    /(maintenance plan|service plan|preventive maintenance|preventative maintenance|tune[-\s]?up plan)/i,
    "maintenance plan wording",
  );
  const financingEvidence = findPatternEvidence(
    document.visibleText,
    /(financing|finance options|payment plan|monthly payments)/i,
    "financing wording",
  );
  const serviceAreaEvidence = findPatternEvidence(
    document.visibleText,
    /(service areas|areas we serve|serving [a-z][a-z\s,.-]{2,60})/i,
    "service-area wording",
  );
  const hvacServiceEvidence = findHvacServiceLinkEvidence(document.anchors);

  return {
    quality: assessContentQuality(input.fetchResult, document),
    schemaVersion: auditSignalSchemaVersion,
    verticalKey: input.verticalKey,
    playbookVersion: input.playbookVersion,
    analyzedUrl: input.fetchResult.analyzedUrl,
    finalUrl: input.fetchResult.finalUrl,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    fetch: {
      httpStatus: signal(input.fetchResult.status, "HTTP response status", [
        evidence("fetch", `Received HTTP ${input.fetchResult.status}.`),
      ]),
      responseTimeMs: signal(
        input.fetchResult.responseTimeMs,
        "Response time",
        [
          evidence(
            "fetch",
            `Fetched in ${input.fetchResult.responseTimeMs} ms.`,
          ),
        ],
      ),
      responseSizeBytes: signal(
        input.fetchResult.responseSizeBytes,
        "Response size",
        [
          evidence(
            "fetch",
            `Read ${input.fetchResult.responseSizeBytes} response bytes.`,
          ),
        ],
      ),
      redirectCount: signal(input.fetchResult.redirectCount, "Redirect count", [
        evidence(
          "fetch",
          `Followed ${input.fetchResult.redirectCount} redirect(s).`,
        ),
      ]),
      httpsEnabled: signal(
        new URL(input.fetchResult.finalUrl).protocol === "https:",
        "HTTPS",
        [
          evidence(
            "fetch",
            `Final URL is ${input.fetchResult.finalUrl}.`,
            undefined,
            input.fetchResult.finalUrl,
          ),
        ],
      ),
    },
    page: {
      title: signal(
        document.title,
        "Page title",
        textEvidence("title", document.title),
      ),
      metaDescription: signal(
        metaDescription,
        "Meta description",
        textEvidence("meta", metaDescription),
      ),
      canonicalUrl: signal(
        canonicalUrl,
        "Canonical URL",
        canonicalUrl
          ? [
              evidence(
                "link",
                "Canonical URL detected.",
                undefined,
                canonicalUrl,
              ),
            ]
          : [evidence("link", "No canonical URL detected.")],
      ),
      h1Count: countSignal(document.h1.length, "H1 headings"),
      h2Count: countSignal(document.h2.length, "H2 headings"),
      hasViewportMeta: signal(Boolean(viewportMeta), "Viewport meta", [
        viewportMeta
          ? evidence("meta", "Viewport meta tag detected.", viewportMeta)
          : evidence("meta", "No viewport meta tag detected."),
      ]),
      robotsMeta: signal(
        robotsMeta,
        "Robots meta",
        textEvidence("meta", robotsMeta),
      ),
      hasJsonLd: signal(document.hasJsonLd, "JSON-LD structured data", [
        document.hasJsonLd
          ? evidence("script", "JSON-LD script tag detected.")
          : evidence("script", "No JSON-LD script tag detected."),
      ]),
      imageCount: countSignal(document.images.length, "Images"),
      imagesMissingAlt: signal(imagesMissingAlt, "Images missing alt text", [
        evidence(
          "img",
          `${imagesMissingAlt} image(s) missing alt text.`,
          undefined,
          undefined,
          imagesMissingAlt,
        ),
      ]),
    },
    contactConversion: {
      phoneDetected: booleanPatternSignal(phoneEvidence, "Phone number"),
      emailDetected: booleanPatternSignal(emailEvidence, "Email address"),
      contactLinkDetected: booleanPatternSignal(
        contactLinkEvidence,
        "Contact link",
      ),
      contactFormDetected: booleanPatternSignal(
        contactFormEvidence,
        "Contact form",
      ),
      ctaCount: signal(
        ctaEvidence.length,
        "CTA-like links and buttons",
        ctaEvidence,
      ),
      bookingLinkDetected: booleanPatternSignal(
        bookingEvidence,
        "Booking link",
      ),
      estimateLinkDetected: booleanPatternSignal(
        estimateEvidence,
        "Quote or estimate link",
      ),
    },
    hvac: {
      emergencyService: booleanPatternSignal(
        emergencyEvidence,
        "Emergency service",
      ),
      maintenancePlan: booleanPatternSignal(
        maintenanceEvidence,
        "Maintenance plan",
      ),
      financing: booleanPatternSignal(financingEvidence, "Financing"),
      serviceArea: booleanPatternSignal(serviceAreaEvidence, "Service area"),
      hvacServicePages: signal(
        {
          detected: hvacServiceEvidence.length > 0,
          services: [
            ...new Set(hvacServiceEvidence.map((item) => item.detail)),
          ],
        },
        "HVAC service pages",
        hvacServiceEvidence.length > 0
          ? hvacServiceEvidence
          : [
              evidence(
                "link",
                "No HVAC service-page links detected on the fetched page.",
              ),
            ],
        hvacServiceEvidence.length > 0 ? "high" : "medium",
      ),
      onlineBooking: booleanPatternSignal(bookingEvidence, "Online booking"),
      requestEstimate: booleanPatternSignal(
        estimateEvidence,
        "Request estimate",
      ),
    },
  };
}

function signal<T>(
  value: T,
  label: string,
  signalEvidence: SignalEvidence[],
  confidence: SignalConfidence = "high",
): AuditSignal<T> {
  return {
    value,
    confidence,
    evidence:
      signalEvidence.length > 0
        ? signalEvidence
        : [evidence("analysis", label)],
  };
}

function booleanPatternSignal(signalEvidence: SignalEvidence[], label: string) {
  return signal(
    signalEvidence.length > 0,
    label,
    signalEvidence.length > 0
      ? signalEvidence
      : [
          evidence(
            "analysis",
            `No ${label.toLowerCase()} evidence detected on the fetched page.`,
          ),
        ],
    signalEvidence.length > 0 ? "high" : "medium",
  );
}

function countSignal(value: number, label: string) {
  return signal(value, label, [
    evidence(
      "html",
      `${value} ${label.toLowerCase()} detected.`,
      undefined,
      undefined,
      value,
    ),
  ]);
}

function textEvidence(source: string, value: string | null) {
  return value
    ? [evidence(source, "Value detected.", value)]
    : [evidence(source, "No value detected.")];
}

function evidence(
  source: string,
  detail: string,
  snippet?: string,
  url?: string | null,
  count?: number,
): SignalEvidence {
  return {
    source,
    detail,
    ...(snippet ? { snippet: truncateSnippet(snippet) } : {}),
    ...(url ? { url } : {}),
    ...(typeof count === "number" ? { count } : {}),
  };
}

function findPatternEvidence(text: string, pattern: RegExp, label: string) {
  const match = pattern.exec(text);

  if (!match) {
    return [];
  }

  return [
    evidence(
      "text",
      `${label} detected.`,
      surroundingSnippet(text, match.index, match[0].length),
    ),
  ];
}

function findLinkEvidence(links: HtmlLink[], pattern: RegExp, detail: string) {
  return links
    .filter((link) => pattern.test(`${link.text} ${link.href ?? ""}`))
    .slice(0, 5)
    .map((link) =>
      evidence("link", detail, link.text || (link.href ?? ""), link.href),
    );
}

function findFormEvidence(forms: HtmlElement[]) {
  return forms
    .filter((form) => {
      const formText = [
        form.text,
        form.attrs.action,
        form.attrs.id,
        form.attrs.class,
        form.raw,
      ]
        .filter(Boolean)
        .join(" ");

      return /(contact|quote|estimate|schedule|appointment|email|tel)/i.test(
        formText,
      );
    })
    .slice(0, 3)
    .map((form) =>
      evidence(
        "form",
        "Contact or conversion form detected.",
        form.text || form.attrs.action,
      ),
    );
}

function findCtaEvidence(
  links: HtmlLink[],
  buttons: HtmlElement[],
  inputs: HtmlElement[],
) {
  const ctaPattern =
    /(call|book|schedule|appointment|contact|get started|request|quote|estimate|free estimate|learn more)/i;
  const linkEvidence = links
    .filter(
      (link) =>
        ctaPattern.test(`${link.text} ${link.href ?? ""}`) ||
        /^tel:/i.test(link.href ?? ""),
    )
    .slice(0, 8)
    .map((link) =>
      evidence(
        "link",
        "CTA-like link detected.",
        link.text || (link.href ?? ""),
        link.href,
      ),
    );
  const buttonEvidence = buttons
    .filter((button) =>
      ctaPattern.test(
        `${button.text} ${button.attrs["aria-label"] ?? ""} ${button.attrs.title ?? ""}`,
      ),
    )
    .slice(0, 5)
    .map((button) =>
      evidence("button", "CTA-like button detected.", button.text),
    );
  const inputEvidence = inputs
    .filter((input) =>
      ctaPattern.test(`${input.attrs.value ?? ""} ${input.attrs.type ?? ""}`),
    )
    .slice(0, 5)
    .map((input) =>
      evidence("input", "CTA-like form control detected.", input.attrs.value),
    );

  return [...linkEvidence, ...buttonEvidence, ...inputEvidence];
}

function findHvacServiceLinkEvidence(links: HtmlLink[]) {
  const servicePatterns = [
    {
      label: "Air conditioning",
      pattern: /(air conditioning|ac repair|a\/c repair|cooling)/i,
    },
    { label: "Heating", pattern: /(heating|heater repair|heat pump)/i },
    { label: "Furnace", pattern: /(furnace)/i },
    { label: "Ductless", pattern: /(ductless|mini[-\s]?split)/i },
    {
      label: "Indoor air quality",
      pattern: /(indoor air quality|air purifier|humidifier)/i,
    },
  ];

  const matches: SignalEvidence[] = [];

  for (const link of links) {
    const searchable = `${link.text} ${link.href ?? ""}`;
    const matchedService = servicePatterns.find((service) =>
      service.pattern.test(searchable),
    );

    if (matchedService) {
      matches.push(
        evidence(
          "link",
          matchedService.label,
          link.text || (link.href ?? ""),
          link.href,
        ),
      );
    }
  }

  return matches.slice(0, 8);
}

function isMissingAlt(image: HtmlElement) {
  return !("alt" in image.attrs) || image.attrs.alt.trim().length === 0;
}

function surroundingSnippet(text: string, index: number, matchLength: number) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + matchLength + 80);

  return text.slice(start, end);
}

function truncateSnippet(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 240
    ? `${normalized.slice(0, 237)}...`
    : normalized;
}
