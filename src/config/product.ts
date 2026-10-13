export function getProductConfig(name?: string) {
  return {
    name: name?.trim() || "Scanvoro",
    category: "Website Opportunity & Sales Proposal Workspace",
    tagline: "From website scan to sales proposal.",
    description:
      "Find website improvement opportunities and turn them into evidence-backed sales proposals.",
  };
}

export const productConfig = getProductConfig(
  process.env.NEXT_PUBLIC_PRODUCT_NAME,
);
