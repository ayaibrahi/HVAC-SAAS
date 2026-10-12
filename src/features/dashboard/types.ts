import type { AuditStatus } from "@/domain/audits/types";
import type { ProposalStatus } from "@/domain/proposals/types";

export type DashboardOverviewData = {
  counts: {
    prospects: number;
    completedAudits: number;
    opportunities: number;
    proposals: number;
  };
  recentProspects: {
    id: string;
    business_name: string;
    website_url: string;
    created_at: string;
  }[];
  recentAudits: {
    id: string;
    prospect_id: string;
    status: AuditStatus;
    website_url: string;
    created_at: string;
  }[];
  recentProposals: {
    id: string;
    title: string;
    status: ProposalStatus;
    updated_at: string;
  }[];
};
