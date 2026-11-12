import { describe, expect, it } from "vitest";
import { makeCompleteProposalBuilder } from "./ai/complete-test-fixtures";
import { createCompleteProposalInput } from "./ai/complete-input";
import { buildProposalCopyOptions, firstProposalCopy } from "./sales-content";
import { getProposalAiDraftSafetyIssues } from "./ai/safety";
import { makeLocalContentSnapshot } from "./sales-test-fixtures";
import { scopeTermsNote } from "./presentation";
import { buildProposalPdfView } from "./pdf/view-model";
import { renderProposalPdf } from "./pdf/renderer";
import { mapDeliverySnapshotToPublicView } from "./delivery/public-view";
import { renderPublicProposalHtml } from "./share-links/public-page";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";

function coverageBuilder() {
  const data = makeCompleteProposalBuilder();
  const hvac = data.audit.normalizedSignals.hvac as Record<string, unknown>;
  hvac.hvacServicePages = {
    value: { detected: true, services: ["Heating"] },
    confidence: "high",
    evidence: ["Heating link on the inspected page"],
  };
  data.services[0].name = "HVAC Service Coverage & Internal Navigation";
  data.services[0].approvedScope = {
    deliverables:
      "Review and improve core HVAC service links and internal navigation on the inspected page using client-approved service destinations.",
    exclusions: "",
    clientInputs: "",
    completionChecks: "",
  };
  const opportunity = evaluateOpportunitiesForAudit({
    audit: data.audit,
    agencyServices: data.services,
  }).find((item) => item.ruleKey === "hvac_service_visibility")!;
  expect(opportunity).toBeDefined();
  const previous = data.opportunities[0];
  data.opportunities = [{ ...previous, ...opportunity }];
  const line = [...data.lineItemsByOpportunityId.values()][0];
  data.lineItemsByOpportunityId = new Map([
    [
      previous.id,
      {
        ...line,
        opportunityId: previous.id,
        serviceName: data.services[0].name,
      },
    ],
  ]);
  return data;
}

describe("commercial copy with unchanged evidence and scope authority", () => {
  it.each(["contact", "coverage"])(
    "connects %s evidence to HVAC customer decisions in complete and suggested copy",
    (kind) => {
      const data =
        kind === "contact" ? makeCompleteProposalBuilder() : coverageBuilder();
      const input = createCompleteProposalInput(data);
      const before = structuredClone(input);
      for (const mode of ["complete", undefined] as const) {
        const variant = { ...input, mode };
        const options = buildProposalCopyOptions(variant);
        for (const summary of options.summary) {
          expect(summary).toContain("Why this matters to your customers");
          expect(summary).toContain(
            kind === "contact"
              ? "urgent heating, furnace or cooling help"
              : "furnace repair, heating, air conditioning or maintenance",
          );
          expect(summary).toContain("high-intent visitors");
          expect(summary).toContain("analyzed page");
          expect(summary).toContain(input.audit.analyzedUrl);
          expect(summary).toContain("Review methodology");
          expect(summary).not.toMatch(/service title|revenue|\d+%|guarantee/i);
          expect(
            getProposalAiDraftSafetyIssues(
              {
                summary,
                scope: options.scope[0],
                nextStep: options.nextStep[0],
              },
              variant,
            ),
          ).toEqual([]);
        }
        if (mode === "complete") {
          expect(options.scope[0]).toContain(
            data.services[0].approvedScope!.deliverables,
          );
          expect(options.scope[0]).toContain(scopeTermsNote);
        }
      }
      expect(input).toEqual(before);
      const draft = firstProposalCopy(buildProposalCopyOptions(input));
      expect(
        getProposalAiDraftSafetyIssues(
          { ...draft, summary: draft.summary + " We will double revenue." },
          input,
        ),
      ).not.toEqual([]);
      expect(
        getProposalAiDraftSafetyIssues(
          { ...draft, scope: draft.scope.replace(scopeTermsNote, "") },
          input,
        ),
      ).toContain("unsupported scope wording or commitment");
    },
  );

  it("renders a single scope note in PDF and public view without mutating the frozen snapshot", () => {
    const data = makeCompleteProposalBuilder();
    const draft = firstProposalCopy(
      buildProposalCopyOptions(createCompleteProposalInput(data)),
    );
    const snapshot = makeLocalContentSnapshot(data, draft);
    snapshot.lineItems[0].serviceName = "seo";
    const before = structuredClone(snapshot);
    const pdf = renderProposalPdf(buildProposalPdfView(snapshot)).toString(
      "latin1",
    );
    const html = renderPublicProposalHtml(
      mapDeliverySnapshotToPublicView(snapshot),
    );
    expect(pdf.match(/\(Scope & Terms Note\) Tj/g)).toHaveLength(1);
    expect(html.match(/Scope &amp; Terms Note/g)).toHaveLength(1);
    for (const text of [pdf, html]) {
      expect(text).not.toContain("A service title does not add unlisted work");
      expect(text).not.toContain(
        "service title does not imply additional features",
      );
      expect(text).toContain("SEO");
      expect(text).toContain("USD 500.00");
    }
    expect(snapshot).toEqual(before);
    expect(snapshot.lineItems[0].serviceName).toBe("seo");
  });
});
