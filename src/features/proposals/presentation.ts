// Presentation only: never rename catalog records or change matching identifiers.
export function serviceDisplayName(name: string) {
  const trimmed = name.trim();
  if (trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed.replace(/\b[a-z]+\b/g, (word) =>
    /^(seo|sem|ppc|cro|crm|cta|hvac|sms)$/.test(word)
      ? word.toUpperCase()
      : word[0].toUpperCase() + word.slice(1),
  );
}

export function defaultProposalTitle(businessName: string) {
  return `Proposal for ${businessName.trim().replace(/^(?:for\s+)+/i, "")}`;
}

export const scopeTermsNote =
  "The investment covers the deliverables listed in Scope, subject to the stated exclusions. Service names and overviews describe the offering; they do not add unlisted work. Confirm any required access, completion checks and schedule before work begins. Additional work requires separate agreement; no performance outcome is promised.";

export const pageReviewMethodology =
  "This page-level review uses the returned HTML at the URL above to identify opportunities for clearer service information and customer contact paths. Other pages and interactive contact or booking functionality were not tested. Items not detected are points for review, not proof that a business service is unavailable.";
