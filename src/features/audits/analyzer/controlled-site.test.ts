import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import manifest from "../../../../test-sites/hvac-audit-control/manifest.json";
import { parseHtmlDocument } from "./html";
import { extractNormalizedAuditSignals } from "./signals";
import { safeFetchHtml, type SafeFetchTransport } from "./safe-fetch";
import { hasVerifiedPageContent } from "./content-quality";
import type { ResolveHostname } from "./url-safety";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { makeAudit, makeService } from "@/features/opportunities/test-fixtures";
import { evaluateHvacOpportunityRules } from "@/features/opportunities/rules/hvac";

const siteRoot = new URL(
  "../../../../test-sites/hvac-audit-control/site/",
  import.meta.url,
);
const readPage = (file: string) =>
  readFileSync(new URL(file, siteRoot), "utf8");
const positive = readPage("index.html");
const absence = readPage("absence.html");
const baseUrl = `${manifest.testOrigin}/qa/`;
const resolveHostname: ResolveHostname = async () => [
  { address: "93.184.216.34", family: 4 },
];

// Only the response transport and DNS are supplied as fixtures. No socket, AI,
// Supabase or alternative extractor is used by these pipeline checks.
async function inspect(
  html: string,
  options: { status?: number; contentType?: string; file?: string } = {},
) {
  const fetchResult = await safeFetchHtml(
    `${baseUrl}${options.file ?? "index.html"}`,
    {
      resolveHostname,
      transport: async () =>
        new Response(html, {
          status: options.status ?? 200,
          headers: {
            "content-type": options.contentType ?? "text/html; charset=utf-8",
          },
        }),
    },
  );
  return extractNormalizedAuditSignals({
    fetchResult,
    verticalKey: "hvac",
    playbookVersion: manifest.playbookVersion,
    fetchedAt: "2026-10-15T00:00:00.000Z",
  });
}

const services = [
  makeService({ id: "test-booking", name: "Online Booking Integration" }),
  makeService({ id: "test-emergency", name: "Emergency HVAC Landing Page" }),
  makeService({
    id: "test-conversion",
    name: "Website Conversion Optimization",
  }),
];
type Signals = Awaited<ReturnType<typeof inspect>>;
function evaluate(signals: Signals, agencyServices = services) {
  return evaluateOpportunitiesForAudit({
    audit: makeAudit(signals),
    agencyServices,
  });
}
function inject(html: string, markup: string) {
  return html.replace("</main>", `${markup}</main>`);
}

describe("controlled public-test-site manifest: real audit pipeline", () => {
  for (const page of manifest.pages) {
    it(`${page.key}: extractor matches the independently specified document ground truth`, () => {
      const html = readPage(page.file);
      const url = `${baseUrl}${page.file}`;
      const document = parseHtmlDocument(html, url);
      expect(document.title).toBe(page.extractor.title);
      expect(document.h1).toHaveLength(page.extractor.h1Count);
      expect(document.mainText).toContain(page.extractor.mainTextContains);
      expect(document.mainText.length).toBeGreaterThan(180);
      expect(document.mainText.split(/\s+/).length).toBeGreaterThan(24);
      for (const href of page.extractor.linkHrefs) {
        expect(document.anchors.map((link) => link.href)).toContain(
          new URL(href, url).href,
        );
      }
      for (const id of page.extractor.targetIds) {
        expect(html).toContain(`id="${id}"`);
      }
    });

    it(`${page.key}: actual detectors and quality match every manifest expectation`, async () => {
      const signals = await inspect(readPage(page.file), { file: page.file });
      expect(signals.schemaVersion).toBe(manifest.signalSchemaVersion);
      expect(signals.quality?.status).toBe(page.quality);
      expect(signals.quality?.reasons).toEqual([]);
      for (const [path, expected] of Object.entries(page.signals)) {
        expect(signals, path).toHaveProperty(`${path}.value`, expected);
      }
      for (const path of page.deliberatelyAbsentSignals) {
        expect(signals, path).toHaveProperty(`${path}.value`, false);
        expect(signals, path).toHaveProperty(`${path}.confidence`, "medium");
      }
      expect(signals.contactConversion.ctaCount.value).toBe(page.ctaCount);
      expect([...signals.hvac.hvacServicePages.value.services].sort()).toEqual(
        [...page.serviceNames].sort(),
      );
      expect(signals.analyzedUrl).toBe(`${baseUrl}${page.file}`);
      expect(signals.finalUrl).toBe(signals.analyzedUrl);
    });

    it(`${page.key}: real HVAC rules, mapping and top-five ranking match expected opportunities`, async () => {
      const signals = await inspect(readPage(page.file), { file: page.file });
      const result = evaluate(signals);
      expect(result.map((item) => item.ruleKey)).toEqual(page.opportunityRules);
      expect(result.length).toBeLessThanOrEqual(5);
      expect(evaluate(signals)).toEqual(result);
      for (const opportunity of result) {
        expect(opportunity.evidence.length).toBeGreaterThan(0);
        expect(opportunity.shortDescription).toContain("analyzed page");
        for (const evidence of opportunity.evidence) {
          expect(evidence.scope).toBe(manifest.scope);
          expect(evidence.source).toBe("deterministic_analyzer");
          expect(signals).toHaveProperty(
            `${evidence.signal}.value`,
            evidence.observed_value,
          );
          expect(evidence.analyzer_evidence?.length).toBeGreaterThan(0);
        }
      }
    });

    it(`${page.key}: publishable HTML has no scripts, external resources or submission forms`, () => {
      const html = readPage(page.file);
      expect(html).not.toMatch(/<script\b|<iframe\b|<form\b|\bon\w+\s*=/i);
      const document = parseHtmlDocument(html, `${baseUrl}${page.file}`);
      for (const element of document.images) {
        expect(element.attrs.src).toBe("system-diagram.svg");
      }
      for (const link of document.anchors) {
        expect(link.href).toBeTruthy();
        const href = new URL(link.href!);
        expect(
          href.protocol === "tel:" || href.origin === manifest.testOrigin,
        ).toBe(true);
        if (href.protocol === "tel:")
          expect(href.href).toBe("tel:+12025550147");
      }
      expect(html).toContain('href="styles.css"');
      expect(html).toContain('content="noindex, nofollow"');
    });
  }

  it("A: preserves observed phone/booking/emergency snippets and does not invent absence", async () => {
    const signals = await inspect(positive);
    expect(signals.contactConversion.phoneDetected.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "link", url: "tel:+12025550147" }),
      ]),
    );
    expect(signals.hvac.onlineBooking.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "link",
          url: `${baseUrl}index.html#appointment`,
          snippet: expect.stringContaining("Schedule"),
        }),
      ]),
    );
    expect(signals.hvac.emergencyService.evidence[0]?.snippet).toContain(
      "Emergency HVAC",
    );
    expect(evaluateHvacOpportunityRules({ audit: makeAudit(signals) })).toEqual(
      [],
    );
  });

  it("B: maps only explicit relevant catalog capabilities", async () => {
    const signals = await inspect(absence, { file: "absence.html" });
    expect(
      evaluate(signals).map((item) => [item.ruleKey, item.agencyServiceId]),
    ).toEqual([
      ["weak_lead_capture", "test-conversion"],
      ["weak_emergency_conversion", "test-emergency"],
      ["missing_online_booking", "test-booking"],
    ]);
    const unrelated = [
      makeService({ id: "test-social", name: "Social Media Management" }),
    ];
    const result = evaluate(signals, unrelated);
    expect(result).toHaveLength(3);
    expect(result.every((item) => item.agencyServiceId === null)).toBe(true);
  });

  it("B: does not invent services when the catalog is empty or relevant services are inactive", async () => {
    const signals = await inspect(absence);
    for (const catalog of [
      [],
      services.map((service) => ({ ...service, isActive: false })),
    ]) {
      const result = evaluate(signals, catalog);
      expect(result).toHaveLength(3);
      expect(result.every((item) => item.agencyServiceId === null)).toBe(true);
    }
  });

  it("does not alter input evidence, agency services or audit lifecycle", async () => {
    const signals = await inspect(absence);
    const audit = makeAudit(signals);
    const before = JSON.stringify({ audit, services });
    evaluateOpportunitiesForAudit({ audit, agencyServices: services });
    expect(JSON.stringify({ audit, services })).toBe(before);
    expect(audit.status).toBe("completed");
  });

  it("stylesheet and local visual contain no external resource references", () => {
    expect(readPage("styles.css")).not.toMatch(/@import|url\s*\(/i);
    expect(readPage("system-diagram.svg")).not.toMatch(
      /<script|<image|(?:href|src)\s*=/i,
    );
  });
});

describe("fixture-grounded content reliability", () => {
  const shell =
    '<html><head><title>Test shell</title></head><body><header><a href="tel:+12025550147">Call</a></header><div id="root"></div><script>document.body.dataset.ready="true"</script></body></html>';
  const cases = [
    { name: "JavaScript-only shell", html: shell, reason: "thin" },
    {
      name: "thin complete document",
      html: "<html><body><h1>Test climate care</h1><p>Fictional sample.</p></body></html>",
      reason: "thin",
    },
    {
      name: "recognized challenge with otherwise substantial copy",
      html: absence.replace(
        /<title>.*?<\/title>/,
        "<title>Access denied</title>",
      ),
      reason: "challenge",
    },
    {
      name: "truncated outer document despite substantial content",
      html: absence.replace(/<\/body>\s*<\/html>\s*$/, ""),
      reason: "incomplete",
    },
  ];
  it.each(cases)(
    "rejects $name without converting false values into opportunities",
    async ({ html, reason }) => {
      const signals = await inspect(html);
      expect(signals.quality?.status).toBe("insufficient");
      expect(signals.quality?.reasons).toContain(reason);
      expect(
        hasVerifiedPageContent(signals as unknown as Record<string, unknown>),
      ).toBe(false);
      expect(evaluate(signals)).toEqual([]);
    },
  );

  it("retains detected positives on a rejected shell without making absence recommendations", async () => {
    const signals = await inspect(shell);
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(evaluate(signals)).toEqual([]);
  });

  it("a removed appointment link yields only the supported booking rule on A", async () => {
    const html = positive.replace(
      /<a\b[^>]*href="#appointment"[^>]*>[\s\S]*?<\/a>/i,
      "",
    );
    const signals = await inspect(html);
    expect(signals.quality?.status).toBe("sufficient");
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(evaluate(signals).map((item) => item.ruleKey)).toEqual([
      "missing_online_booking",
    ]);
  });

  it.each([
    { status: 403, contentType: "text/html", code: "CONTENT_NOT_VERIFIABLE" },
    { status: 206, contentType: "text/html", code: "CONTENT_NOT_VERIFIABLE" },
    {
      status: 200,
      contentType: "application/json",
      code: "UNSUPPORTED_CONTENT_TYPE",
    },
  ])(
    "transport rejects HTTP $status / $contentType before extraction",
    async ({ status, contentType, code }) => {
      await expect(
        inspect(positive, { status, contentType }),
      ).rejects.toMatchObject({ code });
    },
  );

  it("rejects interrupted streams rather than treating their partial text as a page", async () => {
    const transport: SafeFetchTransport = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(positive));
            controller.error(new Error("Synthetic interrupted stream"));
          },
        }),
        { headers: { "content-type": "text/html" } },
      );
    await expect(
      safeFetchHtml(`${baseUrl}index.html`, { resolveHostname, transport }),
    ).rejects.toMatchObject({ code: "FETCH_FAILED" });
  });

  it("keeps analyzed/final URL, redirect count and revalidated address distinct", async () => {
    const resolver = vi.fn(resolveHostname);
    const transport = vi.fn<SafeFetchTransport>(
      async ({ url, resolvedAddress }) => {
        expect(resolvedAddress.address).toBe("93.184.216.34");
        return url.hostname === "fixture.example"
          ? new Response(null, {
              status: 302,
              headers: {
                location: "https://final.fixture.example/qa/index.html",
              },
            })
          : new Response(positive, {
              headers: { "content-type": "text/html" },
            });
      },
    );
    const fetchResult = await safeFetchHtml(`${baseUrl}index.html`, {
      resolveHostname: resolver,
      transport,
    });
    const signals = extractNormalizedAuditSignals({
      fetchResult,
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
    });
    expect(resolver.mock.calls.map(([host]) => host)).toEqual([
      "fixture.example",
      "final.fixture.example",
    ]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(signals.analyzedUrl).toBe(`${baseUrl}index.html`);
    expect(signals.finalUrl).toBe(
      "https://final.fixture.example/qa/index.html",
    );
    expect(signals.fetch.redirectCount.value).toBe(1);
    expect(signals.hvac.onlineBooking.evidence[0]?.url).toBe(
      `${signals.finalUrl}#appointment`,
    );
    expect(evaluate(signals)).toEqual([]);
  });

  it("recognizes static icon controls, entity attributes, uppercase tags and footer phone", async () => {
    const html = inject(
      absence,
      '<A HREF=tel:+12025550147 ARIA-LABEL="Call fictional test number"><span aria-hidden="true">&#9742;</span></A><BUTTON ARIA-LABEL="Schedule&#32;appointment"><span aria-hidden="true">+</span></BUTTON><A HREF="/emergency-hvac">Urgent support</A>',
    );
    const signals = await inspect(html);
    expect(signals.quality?.status).toBe("sufficient");
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(signals.hvac.onlineBooking.value).toBe(true);
    expect(signals.hvac.emergencyService.value).toBe(true);
    expect(evaluate(signals)).toEqual([]);
    const footer = await inspect(
      absence.replace(
        "</footer>",
        '<a href="tel:+12025550147" aria-label="Call fictional test number">Phone</a></footer>',
      ),
    );
    expect(footer.contactConversion.phoneDetected.value).toBe(true);
  });
});

describe("corrected reliability defects and explicit remaining limitations", () => {
  it("preserves legal closing whitespace and associates each control with its own text", async () => {
    const formatted = positive.replaceAll("</a>", "</a\n>");
    const document = parseHtmlDocument(formatted, `${baseUrl}index.html`);
    expect(document.anchors.map((link) => link.href)).toContain(
      `${baseUrl}index.html#appointment`,
    );
    const signals = await inspect(formatted);
    expect(signals.quality?.status).toBe("sufficient");
    expect(signals.hvac.onlineBooking.value).toBe(true);
    expect(evaluate(signals)).toEqual([]);
    const partiallyFormatted = positive.replace(
      ">(202) 555-0147</a>",
      ">(202) 555-0147</a\n>",
    );
    const mixed = await inspect(partiallyFormatted);
    expect(mixed.hvac.onlineBooking.evidence[0]?.url).toBe(
      `${baseUrl}index.html#appointment`,
    );
    expect(mixed.contactConversion.phoneDetected.evidence).toContainEqual(
      expect.objectContaining({
        url: "tel:+12025550147",
        snippet: expect.not.stringContaining("Schedule"),
      }),
    );
  });

  it("hybrid hydration: sufficient static copy cannot establish absence in later-rendered content", async () => {
    const html = inject(
      absence,
      '<div id="appointment-widget"></div><script>const html = \'<a href="tel:+12025550147">Call</a><a href="/book">Schedule</a><p>Emergency HVAC service</p>\';document.getElementById("appointment-widget").innerHTML = html;</script>',
    );
    const signals = await inspect(html);
    expect(signals.quality?.status).toBe("sufficient");
    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(signals.hvac.emergencyService.value).toBe(false);
    expect(evaluate(signals)).toHaveLength(3);
  });

  it("does not promote explicitly hidden controls into static contact/booking evidence", async () => {
    const signals = await inspect(
      inject(
        absence,
        '<div hidden><a href="tel:+12025550147">Call</a><a href="/book">Schedule</a><p>Emergency HVAC service</p></div>',
      ),
    );
    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(signals.contactConversion.phoneDetected.value).toBe(false);
    expect(signals.hvac.emergencyService.value).toBe(false);
    expect(evaluate(signals)).toHaveLength(3);
  });

  it("does not mistake a Facebook profile URL for booking evidence", async () => {
    const signals = await inspect(
      inject(
        absence,
        '<a href="https://www.facebook.com/fictional-qa-only">Social updates</a>',
      ),
    );
    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(signals.contactConversion.ctaCount.value).toBe(0);
    expect(
      evaluate(signals).some(
        (item) => item.ruleKey === "missing_online_booking",
      ),
    ).toBe(true);
  });

  it("treats a broken appointment fragment as unknown, never a verified or missing booking path", async () => {
    const broken = positive
      .replace('href="#appointment"', 'href="#missing-target"')
      .replace('id="appointment"', 'id="other-section"');
    expect(broken).not.toContain('id="missing-target"');
    const signals = await inspect(broken);
    expect(signals.hvac.onlineBooking.value).toBeNull();
    expect(signals.hvac.onlineBooking.confidence).toBe("low");
    expect(evaluate(signals)).toEqual([]);
  });

  it("valid static fragment may pass despite unknown response completeness", async () => {
    const fragment = absence.slice(
      absence.indexOf("<main>"),
      absence.indexOf("</main>") + "</main>".length,
    );
    const signals = await inspect(fragment);
    expect(signals.quality?.status).toBe("sufficient");
    expect(evaluate(signals)).toHaveLength(3);
  });

  it("rejects the reproduced substantial access notice before generating opportunities", async () => {
    const html = readFileSync(
      new URL("./fixtures/access-notice.html", import.meta.url),
      "utf8",
    );
    const signals = await inspect(html);
    expect(signals.quality?.status).toBe("insufficient");
    expect(signals.quality?.reasons).toContain("challenge");
    expect(evaluate(signals)).toEqual([]);
  });
});
