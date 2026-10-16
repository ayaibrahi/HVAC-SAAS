import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHtmlDocument } from "./html";
import { extractNormalizedAuditSignals } from "./signals";
import { safeFetchHtml } from "./safe-fetch";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { makeAudit } from "@/features/opportunities/test-fixtures";

const base = readFileSync(
  new URL(
    "../../../../test-sites/hvac-audit-control/site/absence.html",
    import.meta.url,
  ),
  "utf8",
);
const url = "https://fixture.example/qa/absence.html";
async function inspect(html: string) {
  const fetchResult = await safeFetchHtml(url, {
    resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
    transport: async () =>
      new Response(html, { headers: { "content-type": "text/html" } }),
  });
  const signals = extractNormalizedAuditSignals({
    fetchResult,
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
  });
  return {
    signals,
    opportunities: evaluateOpportunitiesForAudit({
      audit: makeAudit(signals),
      agencyServices: [],
    }),
  };
}
const insert = (markup: string) => base.replace("</main>", `${markup}</main>`);

describe("static extraction regressions", () => {
  it.each([" ", "\n", "\r\n", "\t", "\f"])(
    "keeps quoted attributes, nested inline text and adjacent link ownership with closing whitespace %j",
    (space) => {
      const document = parseHtmlDocument(
        `<a href="tel:+12025550147" title="Call > details"><span>Call</span></a${space}><a href="/book" aria-label="Book a visit"><span>Bo</span><strong>ok</strong> now</a${space}>`,
        url,
      );
      expect(document.anchors).toMatchObject([
        { href: "tel:+12025550147", text: "Call Call > details" },
        { href: "https://fixture.example/book", text: "Book now Book a visit" },
      ]);
    },
  );

  it("keeps fake tags in comments/raw text/templates/textarea/iframe out of signals", async () => {
    const fake =
      '<a href="/book">Book now</a><a href="tel:+12025550147">Call</a><p>Emergency HVAC service</p>';
    const html = insert(
      `<!--${fake}--><script>const data = '${fake}';</script ><style>/*${fake}*/</style\n><template>${fake}</template ><textarea>${fake}</textarea><iframe src="https://unvisited.example">${fake}</iframe>`,
    );
    const { signals, opportunities } = await inspect(html);
    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(signals.contactConversion.phoneDetected.value).toBe(false);
    expect(signals.hvac.emergencyService.value).toBe(false);
    expect(opportunities).toHaveLength(3);
  });

  it("does not crash or alter prototypes on malformed entities/attributes", () => {
    const document = parseHtmlDocument(
      '<a href="/book" href="https://unwanted.example" __proto__="unsafe">Book now &#999999999; &#xD800;</a>',
      url,
    );
    expect(document.anchors[0]?.href).toBe("https://fixture.example/book");
    expect(document.anchors[0]?.text).toContain("\ufffd");
    expect(Object.getPrototypeOf(document.anchors[0]?.attrs)).toBeNull();
  });

  it("fails closed on excessive markup nesting with a controlled error", () => {
    expect(() =>
      parseHtmlDocument(
        "<div>".repeat(140) + "text" + "</div>".repeat(140),
        url,
      ),
    ).toThrow("could not be inspected reliably");
  });

  it("bounds excessive flat token input rather than allocating an unbounded tree", () => {
    expect(() => parseHtmlDocument("<br>".repeat(50_001), url)).toThrow(
      "could not be inspected reliably",
    );
  });

  it("processes a wide representative document under the existing response budget", () => {
    const html =
      "<html><body><main>" +
      "<p>Heating and cooling care.</p>".repeat(6_000) +
      "</main></body></html>";
    expect(Buffer.byteLength(html)).toBeLessThan(1_000_000);
    const document = parseHtmlDocument(html, url);
    expect(document.incompleteMarkup).toBe(false);
    expect(document.mainText).toContain("Heating and cooling care.");
  });

  it("does not leak hidden content through an invalid nested-anchor repair", async () => {
    const { signals, opportunities } = await inspect(
      insert(
        '<a href="/info">About<div hidden><a href="/book">Book now</a></div></a>',
      ),
    );
    expect(signals.quality?.status).toBe("insufficient");
    expect(opportunities).toEqual([]);
  });
});

describe("booking precision and explicit uncertainty", () => {
  it.each([
    '<a href="https://www.facebook.com/fictional-qa">Social updates</a>',
    '<a href="https://bookkeeper.example/">Bookkeeping</a>',
    '<a href="/notebook">Notebook</a>',
    '<a href="/recall">Recall notices</a>',
    '<a href="https://example.com/?utm_campaign=booking">News</a>',
  ])(
    "does not infer booking or a CTA from unrelated substrings: %s",
    async (markup) => {
      const { signals, opportunities } = await inspect(insert(markup));
      expect(signals.hvac.onlineBooking.value).toBe(false);
      expect(signals.contactConversion.ctaCount.value).toBe(0);
      expect(
        opportunities.some((item) => item.ruleKey === "missing_online_booking"),
      ).toBe(true);
    },
  );

  it.each([
    '<a href="https://calendly.com/fictional-qa/visit">Schedule service</a>',
    '<a href="https://appointments.vendor.example/new">Arrange an appointment</a>',
    '<a href="/booking">Reserve a visit</a>',
    '<a href="/schedule-service"><span>Schedule</span> service</a>',
    '<button aria-label="Book an appointment"><span aria-hidden="true">+</span></button>',
    '<a href="/visit" title="Schedule appointment">Visit options</a>',
    '<a href="https://unlisted-provider.example/team">Schedule online</a>',
    '<a href="https://unlisted-provider.example/team">Book a free consultation</a>',
  ])(
    "preserves explicit static booking evidence including external providers: %s",
    async (markup) => {
      const { signals, opportunities } = await inspect(insert(markup));
      expect(signals.hvac.onlineBooking.value).toBe(true);
      expect(signals.hvac.onlineBooking.evidence.length).toBeGreaterThan(0);
      expect(
        opportunities.some((item) => item.ruleKey === "missing_online_booking"),
      ).toBe(false);
    },
  );

  it.each([
    "<a>Book now</a>",
    '<a href="#missing">Schedule appointment</a>',
    '<a href="./absence.html#missing">Schedule appointment</a>',
    '<a href="https://fixture.example/qa/absence.html#missing">Schedule appointment</a>',
    '<a href="#">Book now</a>',
    '<a href="javascript:openBooking()">Book now</a>',
    '<a href="javascript&colon;openBooking()">Book now</a>',
    '<a href="/reading">Read our book</a>',
    "<button disabled>Schedule appointment</button>",
    '<a href="https://www.facebook.com/book">Social updates</a>',
  ])(
    "keeps ambiguous or non-actionable booking markup unknown: %s",
    async (markup) => {
      const { signals, opportunities } = await inspect(insert(markup));
      expect(signals.hvac.onlineBooking.value).toBeNull();
      expect(signals.hvac.onlineBooking.confidence).toBe("low");
      expect(signals.contactConversion.bookingLinkDetected.value).toBeNull();
      expect(
        opportunities.some((item) => item.ruleKey === "missing_online_booking"),
      ).toBe(false);
    },
  );
});

describe("explicitly non-user-facing static markup", () => {
  it.each([
    "hidden",
    'hidden="false"',
    "inert",
    'aria-hidden="true"',
    'style="display: none !important"',
    'style="DISPLAY: NONE"',
    'style="visibility: hidden"',
    'style="content-visibility: hidden"',
    'style="opacity: 0.0"',
  ])(
    "excludes nested controls and text under %s but retains visible siblings",
    async (attrs) => {
      const { signals, opportunities } = await inspect(
        insert(
          `<div ${attrs}><div><a href="tel:+12025550147">Call</a><button>Book now</button><p>Emergency HVAC service</p></div></div><p>Visible ordinary service information remains here.</p>`,
        ),
      );
      expect(signals.contactConversion.phoneDetected.value).toBe(false);
      expect(signals.hvac.onlineBooking.value).toBe(false);
      expect(signals.hvac.emergencyService.value).toBe(false);
      expect(signals.contactConversion.ctaCount.value).toBe(0);
      expect(signals.quality?.status).toBe("sufficient");
      expect(opportunities).toHaveLength(3);
    },
  );

  it("does not manufacture a contact form or CTA from hidden-only fields", async () => {
    const { signals } = await inspect(
      insert(
        '<form><input type="hidden" name="email" value="Schedule appointment"></form>',
      ),
    );
    expect(signals.contactConversion.contactFormDetected.value).toBe(false);
    expect(signals.contactConversion.ctaCount.value).toBe(0);
  });

  it.each([
    "display:none;display:block",
    "display:block!important;display:none",
    '--label:";display:none";display:block',
    "display: /* ordinary inline comment */ block",
    "display:non/**/e",
    "opacity:1;visibility:hidden;visibility:visible",
  ])(
    "does not hide valid controls by ignoring simple inline declaration precedence: %s",
    async (style) => {
      const { signals } = await inspect(
        insert(`<div style='${style}'><a href="/book">Book now</a></div>`),
      );
      expect(signals.hvac.onlineBooking.value).toBe(true);
    },
  );

  it("honors an explicit child visibility override without overriding display:none ancestors", async () => {
    const markup =
      '<div style="visibility:hidden"><a style="visibility:visible" href="/book">Book now</a></div>';
    expect(
      (await inspect(insert(markup))).signals.hvac.onlineBooking.value,
    ).toBe(true);
    expect(
      (
        await inspect(
          insert(markup.replace("visibility:hidden", "display:none")),
        )
      ).signals.hvac.onlineBooking.value,
    ).toBe(false);
  });

  it("retains the actionable button's accessible name when its decorative icon is aria-hidden", async () => {
    const { signals } = await inspect(
      insert(
        '<button aria-label="Book an appointment"><span aria-hidden="true">Decorative icon</span></button>',
      ),
    );
    expect(signals.hvac.onlineBooking.value).toBe(true);
    expect(signals.hvac.onlineBooking.evidence[0]?.snippet).toBe(
      "Book an appointment",
    );
  });

  it("retains visible footer phone and does not interpret unknown CSS classes as hiding rules", async () => {
    const { signals } = await inspect(
      insert(
        '<div class="desktop-only"><a href="tel:+12025550147">Call</a><a href="/book">Book now</a></div>',
      ),
    );
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(signals.hvac.onlineBooking.value).toBe(true);
    // Presence in static HTML is verified; computed CSS visibility is not.
    expect(signals.hvac.onlineBooking.evidence[0]?.detail).toContain(
      "static HTML",
    );
  });
});

describe("access notices versus representative business content", () => {
  it.each([
    [
      "Request unavailable",
      "The edge service is unable to provide the requested resource.",
    ],
    [
      "Permission required",
      "This response describes access rules rather than the requested business.",
    ],
    ["Authentication required", "Sign in to view this resource."],
    ["403 Forbidden", "Access is not permitted for this request."],
    [
      "Automated traffic blocked",
      "The page you requested has not been supplied in this response.",
    ],
    [
      "Visitor information",
      "You do not have permission to access this resource.",
    ],
    ["Information", "Your request has been rejected by the edge service."],
  ])(
    "rejects notice identity/body %s even when it has substantial copy",
    async (title, notice) => {
      const padding =
        "This notice concerns access to an online resource rather than heating equipment. No representative business content is available in the response. The supplied text must not be used to describe an organization's services, customer experience, or marketing choices.";
      const { signals, opportunities } = await inspect(
        `<html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>${notice} ${padding}</p></main></body></html>`,
      );
      expect(signals.quality?.status).toBe("insufficient");
      expect(signals.quality?.reasons).toContain("challenge");
      expect(opportunities).toEqual([]);
    },
  );

  it.each([
    "We protect your home and provide secure access to clear service information.",
    "Our team uses protected equipment storage and respects homeowner access instructions.",
    "Our customer portal requires sign in; this public page describes our heating services.",
    "Access denied is a common message in the account-help guide, not the identity of this service page.",
  ])("does not reject ordinary or mixed business wording: %s", async (copy) => {
    const { signals, opportunities } = await inspect(
      insert(`<section><h2>Account guidance</h2><p>${copy}</p></section>`),
    );
    expect(signals.quality?.status).toBe("sufficient");
    expect(opportunities).toHaveLength(3);
  });

  it("does not let an HVAC paragraph override a strong access-notice identity", async () => {
    const html = base.replace(
      /<title>.*?<\/title>/,
      "<title>Request blocked</title>",
    );
    const { signals, opportunities } = await inspect(html);
    expect(signals.quality?.status).toBe("insufficient");
    expect(opportunities).toEqual([]);
  });
});
