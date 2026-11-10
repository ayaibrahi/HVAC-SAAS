export function getProductConfig(name?: string) {
  const configuredName = name?.trim();
  // Retired product names can remain in older deployment environment settings.
  const isLegacyName = /^(?:HVAC|Agency)\s+Sales\s+Copilot$/i.test(
    configuredName ?? "",
  );
  return {
    name: !configuredName || isLegacyName ? "Scanvoro" : configuredName,
    category: "Website Opportunity & Sales Proposal Workspace",
    tagline: "From website scan to sales proposal.",
    description:
      "Find website improvement opportunities and turn them into evidence-backed sales proposals.",
  };
}

export const productConfig = getProductConfig(
  process.env.NEXT_PUBLIC_PRODUCT_NAME,
);
