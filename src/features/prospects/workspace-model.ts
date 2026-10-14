import { z } from "zod";
import type { Audit } from "@/domain/audits/types";
import type { Prospect } from "@/domain/prospects/types";
import type {
  Opportunity,
  OpportunityAiInsight,
} from "@/domain/opportunities/types";

export const prospectPageSize = 12;
export const prospectIdSchema = z.uuid();
export type ScanSummary = Pick<
  Audit,
  "id" | "status" | "createdAt" | "completedAt"
>;
export type ProspectListItem = Pick<
  Prospect,
  "id" | "businessName" | "websiteUrl" | "createdAt"
> & { scan: ScanSummary | null };
export type ProspectListData = {
  items: ProspectListItem[];
  page: number;
  query: string;
  hasNext: boolean;
};
export type ProspectWorkspaceData = {
  prospect: Prospect;
  scan: ScanSummary | null;
  opportunities: Opportunity[];
  insights: OpportunityAiInsight[];
  services: { id: string; name: string }[];
  proposals: { id: string; title: string; status: "draft" | "ready" }[];
};

export function parseProspectSearch(input: { page?: unknown; q?: unknown }) {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(
      typeof input.page === "string" || typeof input.page === "number"
        ? input.page
        : undefined,
    );
  return {
    page: page.success ? page.data : 1,
    query: typeof input.q === "string" ? input.q.trim().slice(0, 100) : "",
  };
}

export function prospectSearchFilter(query: string) {
  // Quote PostgREST values and neutralize LIKE wildcards, never interpolate operators.
  const pattern = JSON.stringify(`%${query.replace(/[%_*\\]/g, " ")}%`);
  return `business_name.ilike.${pattern},website_url.ilike.${pattern}`;
}

export function prospectsListHref(page: number, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/dashboard/prospects${params.size ? `?${params}` : ""}`;
}

export function prospectHref(id: string) {
  return `/dashboard/prospects?prospect=${encodeURIComponent(id)}`;
}
export function scanIsActive(scan: ScanSummary | null) {
  return scan?.status === "pending" || scan?.status === "running";
}

export type ProspectField =
  "businessName" | "websiteUrl" | "contactName" | "contactEmail" | "notes";
export type ProspectFormState = {
  fields?: ProspectField[];
  error?: "invalid" | "save" | "session" | "agency";
  duplicate?: { id: string; name: string };
};
