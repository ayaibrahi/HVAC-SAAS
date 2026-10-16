import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  illustrativeContactSprintScope,
  makeControlledProposalBuilder,
  makeIllustrativeContactOffer,
  makeLocalContentSnapshot,
} from "./sales-test-fixtures";
import { getProposalContentSuggestion } from "./content-suggestion";
import { createProposalAiInput } from "./ai/input";
import {
  buildProposalDraftUserPrompt,
  PROPOSAL_DRAFT_PROMPT_VERSION,
} from "./ai/prompt";
import { generateValidatedProposalAiDraft } from "./ai/generate";
import { ProposalContentFields } from "./components/content-fields";
import { getProposalCopy } from "@/lib/i18n/proposals";
import { mapDeliverySnapshotToPublicView } from "./delivery/public-view";
import { buildProposalPdfView } from "./pdf/view-model";
import { renderProposalPdf } from "./pdf/renderer";
import { encodePdfText, wrapPdfText } from "./pdf/text";
import { renderPublicProposalHtml } from "./share-links/public-page";

describe("commercial refinement without invented scope", () => {
  it.each(["unspecified", "illustrative"])(
    "keeps the documented %s example identical to actual populated fields",
    (kind) => {
      const data =
        kind === "illustrative"
          ? makeIllustrativeContactOffer()
          : makeControlledProposalBuilder();
      const draft = getProposalContentSuggestion(data)!;
      const document = readFileSync(
        new URL(
          "../../../docs/samples/phase-2-page-b-proposal.md",
          import.meta.url,
        ),
        "utf8",
      ).replaceAll("\r\n", "\n");
      for (const field of ["summary", "scope", "nextStep"] as const)
        expect(document).toContain(
          `<!-- ${kind}-${field} -->\n\x60\x60\x60text\n${draft[field]}\n\x60\x60\x60`,
        );
    },
  );
  it("consolidates the four verified contact observations in one plain-language sentence", () => {
    const data = makeControlledProposalBuilder();
    const before = structuredClone(data);
    const draft = getProposalContentSuggestion(data)!;
    expect(draft.summary).toContain(
      "contact or request-service action, phone number, contact link or inquiry form on the analyzed page.",
    );
    expect(draft.summary.match(/did not detect/g)).toHaveLength(1);
    expect(draft.summary).not.toMatch(
      /CTA|the selected agency service|No phone number was detected/,
    );
    expect(draft.summary).toContain("this inspected page only");
    expect(draft.summary).toContain("may be ready to call or request service");
    expect(draft.summary).toContain(
      "Website Conversion Optimization is relevant to reviewing and clarifying the page's contact path.",
    );
    expect(data).toEqual(before);
  });

  it("does not expand partial absence into unobserved missing contact features", () => {
    const data = makeControlledProposalBuilder();
    const contact = data.audit.normalizedSignals.contactConversion as Record<
      string,
      unknown
    >;
    contact.phoneDetected = { value: null, confidence: "low", evidence: [] };
    const lead = data.opportunities.find(
      (item) => item.ruleKey === "weak_lead_capture",
    )!;
    lead.evidence = lead.evidence.filter(
      (item) => item.signal === "contactConversion.ctaCount",
    );
    const draft = getProposalContentSuggestion(data)!;
    expect(draft).not.toBeNull();
    expect(draft.summary).toContain(
      "did not detect a contact or request-service action on the analyzed page",
    );
    expect(draft.summary).not.toMatch(/phone number|contact link|inquiry form/);
  });

  it.each(["empty", "catalog-default"])(
    "treats %s scope as unspecified, not approved catalog commitments",
    (kind) => {
      const data = makeControlledProposalBuilder();
      if (kind === "catalog-default")
        [...data.lineItemsByOpportunityId.values()][0].description =
          data.services[0].description!;
      const draft = getProposalContentSuggestion(data)!;
      expect(draft.scope).toContain(
        "SCOPE DRAFT - AGENCY CONFIRMATION REQUIRED",
      );
      expect(draft.scope).toContain(
        "[Agency to specify included work, deliverables and completion checks.]",
      );
      expect(draft.scope).not.toContain(data.services[0].description);
      expect(draft.scope).not.toMatch(
        /tap-to-call|Sprint|Add or improve|booking-platform integration/,
      );
      expect(draft.nextStep).toContain("before authorizing work");
    },
  );

  it("keeps illustrative implementation work in manually supplied test scope only", () => {
    const data = makeIllustrativeContactOffer();
    const before = structuredClone(data);
    const draft = getProposalContentSuggestion(data)!;
    expect(illustrativeContactSprintScope.length).toBeLessThanOrEqual(1000);
    expect(draft.scope).toContain(illustrativeContactSprintScope);
    expect(draft.scope).toContain("not an approved commercial commitment");
    expect(draft.scope).toContain(
      "Excluded: dedicated booking-platform integration, emergency landing-page implementation and financing integration.",
    );
    expect(draft.scope).not.toContain(data.services[0].description);
    expect(
      getProposalContentSuggestion(makeControlledProposalBuilder())!.scope,
    ).not.toContain("Sprint");
    expect(JSON.stringify(draft)).not.toMatch(
      /USD|500|guarantee|ROI|within .*days/i,
    );
    expect(data).toEqual(before);
    expect(data.proposal.total).toBe(500);
    expect(
      data.opportunities.filter((item) => item.agencyServiceId === null),
    ).toHaveLength(2);
  });

  it.each(["en", "ar"] as const)(
    "explains capability versus commitment in the %s editor",
    (locale) => {
      const copy = getProposalCopy(locale);
      const html = renderToStaticMarkup(
        <ProposalContentFields
          initial={{ summary: "", scope: "", nextStep: "" }}
          suggestion={getProposalContentSuggestion(
            makeControlledProposalBuilder(),
          )}
          copy={copy}
        />,
      );
      expect(html).toContain(copy.contentReview);
      expect(html).toContain('name="scope"');
      expect(html).not.toContain("readonly");
    },
  );

  it.each(["unspecified", "illustrative"])(
    "preserves all %s content in snapshot, PDF drawing text and public HTML",
    (kind) => {
      const data =
        kind === "illustrative"
          ? makeIllustrativeContactOffer()
          : makeControlledProposalBuilder();
      const draft = getProposalContentSuggestion(data)!;
      const snapshot = makeLocalContentSnapshot(data, draft);
      const frozen = JSON.stringify(snapshot);
      const publicView = mapDeliverySnapshotToPublicView(snapshot);
      const pdfView = buildProposalPdfView(snapshot);
      const pdf = renderProposalPdf(pdfView).toString("latin1");
      const html = renderPublicProposalHtml(publicView);
      for (const field of ["summary", "scope", "nextStep"] as const) {
        expect(snapshot[field]).toBe(draft[field]);
        expect(publicView[field]).toBe(draft[field]);
        expect(pdfView[field]).toBe(draft[field]);
        for (const paragraph of draft[field].split(/\n+/u)) {
          for (const line of wrapPdfText(paragraph, 504, 10))
            expect(pdf).toContain(`(${encodePdfText(line)}) Tj`);
          expect(html).toContain(paragraph.replaceAll("'", "&#39;"));
        }
      }
      expect(pdf).toContain("Quantity 1 | Unit USD 500.00");
      expect(html).toContain("USD 500.00");
      expect(publicView.lineItems).toHaveLength(1);
      expect(publicView.pricing.total).toBe(500);
      data.proposal.scope = "A later edit";
      data.services[0].description = "A later catalog change";
      expect(JSON.stringify(snapshot)).toBe(frozen);
    },
  );

  it("versions the approved wording while preserving mocked validation and provider metadata", async () => {
    const data = makeControlledProposalBuilder();
    const input = createProposalAiInput({
      agency: data.agency,
      builderData: data,
    });
    const draft = getProposalContentSuggestion(data)!;
    const prompt = JSON.parse(buildProposalDraftUserPrompt(input));
    expect(PROPOSAL_DRAFT_PROMPT_VERSION).toBe("v4");
    expect(prompt.approvedCopyOptions.scope).toEqual([draft.scope]);
    expect(prompt.approvedCopyOptions.scope[0]).not.toContain("Sprint");
    const generate = vi.fn(async () => draft);
    await expect(
      generateValidatedProposalAiDraft(input, {
        metadata: {
          provider: "test",
          model: "mock",
          promptVersion: "v4",
          schemaVersion: "1.0.0",
        },
        generateProposalDraft: generate,
      }),
    ).resolves.toEqual(draft);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("rejects the manual sample package if a model invents it for an unspecified real scope", async () => {
    const data = makeControlledProposalBuilder();
    const input = createProposalAiInput({
      agency: data.agency,
      builderData: data,
    });
    const draft = getProposalContentSuggestion(data)!;
    const generate = vi.fn(async () => ({
      ...draft,
      scope: illustrativeContactSprintScope,
    }));
    await expect(
      generateValidatedProposalAiDraft(
        input,
        {
          metadata: {
            provider: "test",
            model: "mock",
            promptVersion: "v4",
            schemaVersion: "1.0.0",
          },
          generateProposalDraft: generate,
        },
        { maxAttempts: 1 },
      ),
    ).rejects.toThrow("safety validation");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
