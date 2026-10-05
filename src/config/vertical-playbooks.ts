export const verticalPlaybookKeys = [
  "hvac",
  "plumbing",
  "roofing",
  "electrical",
  "dental",
] as const;

export type VerticalPlaybookKey = (typeof verticalPlaybookKeys)[number];

export const defaultVerticalPlaybookKey: VerticalPlaybookKey = "hvac";
export const defaultPlaybookVersion = "1.0.0";
