import { makeControlledProposalBuilder } from "../sales-test-fixtures";

// Fictional local offer; never a live catalog default or customer commitment.
export function makeCompleteProposalBuilder() {
  const data = makeControlledProposalBuilder();
  data.agency.name = "Synthetic Agency";
  data.prospect.businessName = "Synthetic Climate Care";
  data.services[0].approvedScope = {
    deliverables:
      "Revise the agreed contact action and phone link on the inspected page.",
    exclusions:
      "Booking software integration and additional pages are excluded.",
    clientInputs:
      "Client-confirmed contact details, page access and copy approval.",
    completionChecks:
      "Agency and client review the agreed link destinations and mobile presentation.",
  };
  return data;
}
