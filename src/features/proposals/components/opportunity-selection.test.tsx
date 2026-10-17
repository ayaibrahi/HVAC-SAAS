import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeBuilderData } from "../builder-test-fixtures";
import { OpportunitySelection } from "./opportunity-selection";
import { getProposalCopy } from "@/lib/i18n/proposals";

describe("service selection and evidence presentation", () => {
  it.each(["en", "ar"] as const)(
    "distinguishes automatic, manual and unmatched catalog choices (%s)",
    (locale) => {
      const data = makeBuilderData();
      const opportunity = data.opportunities[0];
      const copy = getProposalCopy(locale);
      function render(service: string, checked = false) {
        return renderToStaticMarkup(
          <OpportunitySelection
            opportunity={opportunity}
            services={data.services}
            selectedServiceId={service}
            selected={checked}
            unitPrice={500}
            quantity={2}
            description="Agency-confirmed scope"
            aiSummary={null}
            copy={copy}
          />,
        );
      }
      expect(render(data.services[0].id)).toContain(copy.recommended);
      expect(render(data.services[0].id)).toContain(
        copy.selectedRecommendation,
      );
      opportunity.agencyServiceId = null;
      expect(render("")).toContain(copy.unmatched);
      expect(render("")).not.toContain(copy.manualService);
      expect(render(data.services[0].id, true)).toContain(copy.manualService);
      expect(render(data.services[0].id, true)).not.toContain(
        copy.selectedRecommendation,
      );
      expect(render(data.services[0].id, true)).toContain('required=""');
    },
  );
  it("keeps raw signal/value/scope diagnostics in a closed disclosure without changing evidence or manual values", () => {
    const data = makeBuilderData();
    const before = structuredClone(data.opportunities[0]);
    const html = renderToStaticMarkup(
      <OpportunitySelection
        opportunity={data.opportunities[0]}
        services={data.services}
        selectedServiceId={data.services[0].id}
        selected={true}
        unitPrice={500}
        quantity={2}
        description="Agency-confirmed scope"
        aiSummary={null}
        copy={getProposalCopy("en")}
      />,
    );
    const details = html.indexOf("<details");
    expect(html.slice(0, details)).toContain(
      "No booking-related link or CTA was detected on the analyzed page.",
    );
    expect(html.slice(0, details)).not.toContain("hvac.onlineBooking");
    expect(html.slice(details)).toContain("Technical evidence (diagnostics)");
    expect(html).not.toContain("<details open");
    expect(html).toContain('value="500.00"');
    expect(html).toContain('value="2"');
    expect(html).toContain("Agency-confirmed scope");
    expect(data.opportunities[0]).toEqual(before);
  });
});
