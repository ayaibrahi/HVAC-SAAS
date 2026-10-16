import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeControlledProposalBuilder } from "./sales-test-fixtures";
import { getProposalContentSuggestion } from "./content-suggestion";
import {
  fillEmptyProposalCopy,
  buildProposalCopyOptions,
} from "./sales-content";
import { createProposalAiInput } from "./ai/input";
import { generateValidatedProposalAiDraft } from "./ai/generate";
import { ProposalContentFields } from "./components/content-fields";
import { getProposalCopy } from "@/lib/i18n/proposals";
import { buildDeliverySnapshotPayload } from "./delivery/snapshot";
import { buildProposalPdfView } from "./pdf/view-model";
import { renderProposalPdf } from "./pdf/renderer";
import { mapDeliverySnapshotToPublicView } from "./delivery/public-view";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";

describe("sales-focused content from controlled Page B", () => {
  it("connects verified evidence to conditional relevance and only the selected actual service", () => {
    const data = makeControlledProposalBuilder();
    const before = structuredClone(data);
    const copy = getProposalContentSuggestion(data)!;
    expect(copy).not.toBeNull();
    expect(copy.summary).toContain(data.prospect.businessName);
    expect(copy.summary).toContain(data.audit.finalUrl);
    expect(copy.summary).toContain(
      "No phone number was detected on the analyzed page",
    );
    expect(copy.summary).toContain("can make it easier");
    expect(copy.summary).toContain("Website Conversion Optimization");
    expect(copy.scope).toContain("Scope to confirm together");
    expect(copy.scope).toContain(
      [...data.lineItemsByOpportunityId.values()][0].description,
    );
    expect(JSON.stringify(copy)).not.toMatch(
      /Online Booking Integration|Emergency HVAC Landing Page|\$500|USD|testimonial|award-winning|guaranteed/i,
    );
    expect(
      data.opportunities.filter((o) => o.agencyServiceId === null),
    ).toHaveLength(2);
    expect(data).toEqual(before);
  });

  it.each(["insufficient", "missing", "running", "unknown", "contradiction"])(
    "declines new automatic copy for %s evidence without altering a historical draft",
    (kind) => {
      const data = makeControlledProposalBuilder();
      if (kind === "insufficient")
        data.audit.normalizedSignals.quality = {
          status: "insufficient",
          reasons: ["thin"],
          version: 1,
          visibleCharacters: 20,
        };
      if (kind === "missing") data.audit.normalizedSignals = {};
      if (kind === "running") data.audit.status = "running";
      if (kind === "unknown" || kind === "contradiction") {
        const contact = data.audit.normalizedSignals
          .contactConversion as Record<string, unknown>;
        contact.phoneDetected = {
          value: kind === "unknown" ? null : true,
          confidence: "low",
          evidence: [],
        };
      }
      data.proposal.summary = "Historical agency wording stays unchanged.";
      expect(getProposalContentSuggestion(data)).toBeNull();
      expect(data.proposal.summary).toBe(
        "Historical agency wording stays unchanged.",
      );
    },
  );

  it.each(["missing", "inactive", "foreign", "line-owner", "unrelated"])(
    "rejects %s selected service or ownership",
    (kind) => {
      const data = makeControlledProposalBuilder();
      if (kind === "missing") data.services = [];
      if (kind === "inactive") data.services[0].isActive = false;
      if (kind === "foreign") data.services[0].agencyId = "other-agency";
      if (kind === "unrelated") {
        data.services[0].name = "Logo Design";
        data.services[0].description = "Design a logo.";
      }
      if (kind === "line-owner")
        [...data.lineItemsByOpportunityId.values()][0].agencyId =
          "other-agency";
      expect(getProposalContentSuggestion(data)).toBeNull();
    },
  );

  it("does not invent a service for an unmatched finding; preserves explicit relevant manual selections", () => {
    const data = makeControlledProposalBuilder();
    const selected = data.opportunities.find((o) =>
      data.lineItemsByOpportunityId.has(o.id),
    )!;
    selected.agencyServiceId = null;
    expect(getProposalContentSuggestion(data)?.scope).toContain(
      "Website Conversion Optimization",
    );
    data.lineItemsByOpportunityId.clear();
    expect(getProposalContentSuggestion(data)).toBeNull();
    expect(selected.agencyServiceId).toBeNull();
  });

  it("requires manual agreement when catalog scope and line details are missing", () => {
    const data = makeControlledProposalBuilder();
    data.services[0].description = null;
    [...data.lineItemsByOpportunityId.values()][0].description = "";
    const copy = getProposalContentSuggestion(data)!;
    expect(copy.scope).toContain("Specific deliverables need to be agreed");
    expect(copy.scope).not.toMatch(
      /install|integrate|within|days|warranty|certified/i,
    );
  });

  it("preserves typed copy and pricing; adding a suggestion fills empty fields only", () => {
    const data = makeControlledProposalBuilder();
    const suggestion = getProposalContentSuggestion(data)!;
    const current = {
      summary: "My client opening",
      scope: "",
      nextStep: "My next step",
    };
    expect(fillEmptyProposalCopy(current, suggestion)).toEqual({
      ...current,
      scope: suggestion.scope,
    });
    expect(current.scope).toBe("");
    expect(data.proposal.total).toBe(500);
    expect([...data.lineItemsByOpportunityId.values()][0]).toMatchObject({
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
    });
  });

  it.each(["en", "ar"] as const)(
    "keeps existing editable form contracts and localized %s controls",
    (locale) => {
      const data = makeControlledProposalBuilder();
      const copy = getProposalCopy(locale);
      const html = renderToStaticMarkup(
        <ProposalContentFields
          initial={{ summary: "My existing opening", scope: "", nextStep: "" }}
          suggestion={getProposalContentSuggestion(data)}
          copy={copy}
        />,
      );
      expect(html).toContain(copy.suggestCopy);
      expect(html).toContain("My existing opening");
      for (const name of ["summary", "scope", "nextStep"])
        expect(html).toContain(`name="${name}"`);
      expect(html).toContain('type="button"');
      expect(html).not.toContain('type="submit"');
    },
  );

  it("keeps reviewed copy compatible with Ready, immutable snapshot, PDF and public projection", () => {
    const data = makeControlledProposalBuilder();
    const copy = getProposalContentSuggestion(data)!;
    Object.assign(data.proposal, copy);
    const line = [...data.lineItemsByOpportunityId.values()][0];
    const opportunity = data.opportunities.find(
      (o) => o.id === line.opportunityId,
    )!;
    const selection = {
      proposalId: data.proposal.id,
      agencyId: data.agency.id,
      opportunityId: opportunity.id,
      agencyServiceId: line.agencyServiceId,
      position: 0,
      opportunityTitle: opportunity.title,
      opportunityShortDescription: opportunity.shortDescription,
      serviceName: line.serviceName,
      serviceDescription: line.serviceDescription,
      aiSalesSummary: null,
      aiClientFacingExplanation: null,
      createdAt: line.createdAt,
    };
    const source = {
      agency: data.agency,
      userId: "test-user",
      proposal: data.proposal,
      prospect: data.prospect,
      proposalOpportunities: [selection],
      lineItems: [line],
    };
    expect(() => buildDeliverySnapshotPayload(source)).toThrow("Only ready");
    data.proposal.status = "ready";
    const payload = buildDeliverySnapshotPayload(source);
    const snapshot: ProposalDeliverySnapshot = {
      ...payload,
      id: "local-only-snapshot",
      status: "active",
      createdAt: data.proposal.updatedAt,
      supersededAt: null,
    };
    const before = JSON.stringify(snapshot);
    expect(mapDeliverySnapshotToPublicView(snapshot).summary).toBe(
      copy.summary,
    );
    expect(buildProposalPdfView(snapshot).pricing.total).toBe(500);
    expect(
      renderProposalPdf(buildProposalPdfView(snapshot)).toString("latin1"),
    ).toContain("%PDF-");
    data.proposal.summary = "A later edit";
    data.services[0].description = "Changed catalog";
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(getProposalContentSuggestion(data)).toBeNull();
  });

  it("accepts another approved mocked wording without provider, price or evidence changes", async () => {
    const data = makeControlledProposalBuilder();
    const input = createProposalAiInput({
      agency: data.agency,
      builderData: data,
    });
    const before = structuredClone(input);
    const options = buildProposalCopyOptions(input);
    const draft = {
      summary: options.summary[1],
      scope: options.scope[0],
      nextStep: options.nextStep[1],
    };
    const generate = vi.fn(async () => draft);
    await expect(
      generateValidatedProposalAiDraft(input, {
        metadata: {
          provider: "test",
          model: "mock",
          promptVersion: "v3",
          schemaVersion: "1.0.0",
        },
        generateProposalDraft: generate,
      }),
    ).resolves.toEqual(draft);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(input).toEqual(before);
    expect(JSON.stringify(input)).not.toMatch(
      /unitPrice|lineTotal|contactEmail/,
    );
  });
});
