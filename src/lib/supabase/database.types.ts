import type { CurrencyCode } from "@/config/currencies";
import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableDefinition<
        {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          email?: string;
          full_name?: string | null;
          updated_at?: string;
        }
      >;
      agencies: TableDefinition<
        {
          id: string;
          owner_user_id: string;
          name: string;
          website: string | null;
          default_currency: CurrencyCode;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          owner_user_id: string;
          name: string;
          website?: string | null;
          default_currency?: CurrencyCode;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          website?: string | null;
          default_currency?: CurrencyCode;
          updated_at?: string;
        }
      >;
      agency_services: TableDefinition<
        {
          id: string;
          agency_id: string;
          name: string;
          description: string | null;
          price: number;
          currency: CurrencyCode;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          agency_id: string;
          name: string;
          description?: string | null;
          price: number;
          currency: CurrencyCode;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          description?: string | null;
          price?: number;
          currency?: CurrencyCode;
          is_active?: boolean;
          updated_at?: string;
        }
      >;
      prospects: TableDefinition<
        {
          id: string;
          agency_id: string;
          business_name: string;
          website_url: string;
          contact_name: string | null;
          contact_email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          agency_id: string;
          business_name: string;
          website_url: string;
          contact_name?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          business_name?: string;
          website_url?: string;
          contact_name?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          updated_at?: string;
        }
      >;
      audits: TableDefinition<
        {
          id: string;
          agency_id: string;
          prospect_id: string;
          status: "pending" | "running" | "completed" | "failed";
          website_url: string;
          final_url: string | null;
          started_at: string | null;
          completed_at: string | null;
          error_code: string | null;
          error_message: string | null;
          normalized_signals: Json;
          signal_schema_version: string;
          vertical_key: VerticalPlaybookKey;
          playbook_version: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          agency_id: string;
          prospect_id: string;
          status?: "pending" | "running" | "completed" | "failed";
          website_url: string;
          final_url?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          normalized_signals?: Json;
          signal_schema_version?: string;
          vertical_key?: VerticalPlaybookKey;
          playbook_version?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: "pending" | "running" | "completed" | "failed";
          final_url?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          normalized_signals?: Json;
          signal_schema_version?: string;
          vertical_key?: VerticalPlaybookKey;
          playbook_version?: string;
          updated_at?: string;
        }
      >;
      opportunities: TableDefinition<
        {
          id: string;
          agency_id: string;
          audit_id: string;
          prospect_id: string;
          agency_service_id: string | null;
          vertical_key: VerticalPlaybookKey;
          playbook_version: string;
          rule_key: string;
          title: string;
          short_description: string;
          business_impact: string;
          evidence: Json;
          priority: "low" | "medium" | "high";
          confidence: "low" | "medium" | "high";
          recommended_service_category: string;
          score: number;
          ranking_rationale: string | null;
          status: "open" | "dismissed" | "selected";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          agency_id: string;
          audit_id: string;
          prospect_id: string;
          agency_service_id?: string | null;
          vertical_key: VerticalPlaybookKey;
          playbook_version: string;
          rule_key: string;
          title: string;
          short_description: string;
          business_impact: string;
          evidence?: Json;
          priority: "low" | "medium" | "high";
          confidence: "low" | "medium" | "high";
          recommended_service_category: string;
          score?: number;
          ranking_rationale?: string | null;
          status?: "open" | "dismissed" | "selected";
          created_at?: string;
          updated_at?: string;
        },
        {
          agency_service_id?: string | null;
          vertical_key?: VerticalPlaybookKey;
          playbook_version?: string;
          rule_key?: string;
          title?: string;
          short_description?: string;
          business_impact?: string;
          evidence?: Json;
          priority?: "low" | "medium" | "high";
          confidence?: "low" | "medium" | "high";
          recommended_service_category?: string;
          score?: number;
          ranking_rationale?: string | null;
          status?: "open" | "dismissed" | "selected";
          updated_at?: string;
        }
      >;
      opportunity_ai_insights: TableDefinition<
        {
          id: string;
          agency_id: string;
          opportunity_id: string;
          status: "not_generated" | "generating" | "completed" | "failed";
          model_provider: string;
          model_name: string;
          prompt_version: string;
          schema_version: string;
          sales_summary: string | null;
          why_it_matters: string | null;
          client_facing_explanation: string | null;
          agency_talking_points: Json;
          recommended_next_step: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          agency_id: string;
          opportunity_id: string;
          status?: "not_generated" | "generating" | "completed" | "failed";
          model_provider: string;
          model_name: string;
          prompt_version: string;
          schema_version: string;
          sales_summary?: string | null;
          why_it_matters?: string | null;
          client_facing_explanation?: string | null;
          agency_talking_points?: Json;
          recommended_next_step?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: "not_generated" | "generating" | "completed" | "failed";
          model_provider?: string;
          model_name?: string;
          prompt_version?: string;
          schema_version?: string;
          sales_summary?: string | null;
          why_it_matters?: string | null;
          client_facing_explanation?: string | null;
          agency_talking_points?: Json;
          recommended_next_step?: string | null;
          error_message?: string | null;
          updated_at?: string;
        }
      >;
      proposals: TableDefinition<
        {
          id: string;
          agency_id: string;
          prospect_id: string;
          audit_id: string;
          title: string;
          status: "draft" | "ready";
          summary: string;
          scope: string;
          next_step: string;
          currency: CurrencyCode;
          subtotal_amount: number;
          discount_type: "none" | "fixed" | "percentage";
          discount_value: number;
          discount_amount: number;
          total_amount: number;
          content: Json | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          agency_id: string;
          prospect_id: string;
          audit_id: string;
          title: string;
          status?: "draft" | "ready";
          summary?: string;
          scope?: string;
          next_step?: string;
          currency?: CurrencyCode;
          subtotal_amount?: number;
          discount_type?: "none" | "fixed" | "percentage";
          discount_value?: number;
          discount_amount?: number;
          total_amount?: number;
          content?: Json | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          title?: string;
          status?: "draft" | "ready";
          summary?: string;
          scope?: string;
          next_step?: string;
          currency?: CurrencyCode;
          subtotal_amount?: number;
          discount_type?: "none" | "fixed" | "percentage";
          discount_value?: number;
          discount_amount?: number;
          total_amount?: number;
          content?: Json | null;
          updated_at?: string;
        }
      >;
      proposal_opportunities: TableDefinition<
        {
          proposal_id: string;
          opportunity_id: string;
          agency_id: string;
          agency_service_id: string | null;
          position: number;
          opportunity_title: string;
          opportunity_short_description: string;
          service_name: string | null;
          service_description: string | null;
          ai_sales_summary: string | null;
          ai_client_facing_explanation: string | null;
          created_at: string;
        },
        {
          proposal_id: string;
          opportunity_id: string;
          agency_id: string;
          agency_service_id?: string | null;
          position?: number;
          opportunity_title?: string;
          opportunity_short_description?: string;
          service_name?: string | null;
          service_description?: string | null;
          ai_sales_summary?: string | null;
          ai_client_facing_explanation?: string | null;
          created_at?: string;
        },
        {
          agency_service_id?: string | null;
          position?: number;
          opportunity_title?: string;
          opportunity_short_description?: string;
          service_name?: string | null;
          service_description?: string | null;
          ai_sales_summary?: string | null;
          ai_client_facing_explanation?: string | null;
        }
      >;
      proposal_line_items: TableDefinition<
        {
          id: string;
          proposal_id: string;
          opportunity_id: string;
          agency_id: string;
          agency_service_id: string;
          position: number;
          service_name: string;
          service_description: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          proposal_id: string;
          opportunity_id: string;
          agency_id: string;
          agency_service_id: string;
          position?: number;
          service_name: string;
          service_description?: string | null;
          description?: string;
          quantity?: number;
          unit_price: number;
          line_total: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          agency_service_id?: string;
          position?: number;
          service_name?: string;
          service_description?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          updated_at?: string;
        }
      >;
      proposal_delivery_snapshots: TableDefinition<
        {
          id: string;
          agency_id: string;
          proposal_id: string;
          status: "active" | "superseded";
          title: string;
          summary: string;
          scope: string;
          next_step: string;
          currency: CurrencyCode;
          subtotal_amount: number;
          discount_type: "none" | "fixed" | "percentage";
          discount_value: number;
          discount_amount: number;
          total_amount: number;
          agency_display_name: string;
          prospect_display_name: string;
          prospect_website_url: string | null;
          line_items: Json;
          created_by: string;
          source_proposal_updated_at: string;
          created_at: string;
          superseded_at: string | null;
        },
        {
          id?: string;
          agency_id: string;
          proposal_id: string;
          status?: "active" | "superseded";
          title: string;
          summary?: string;
          scope?: string;
          next_step?: string;
          currency: CurrencyCode;
          subtotal_amount: number;
          discount_type: "none" | "fixed" | "percentage";
          discount_value: number;
          discount_amount: number;
          total_amount: number;
          agency_display_name: string;
          prospect_display_name: string;
          prospect_website_url?: string | null;
          line_items: Json;
          created_by: string;
          source_proposal_updated_at: string;
          created_at?: string;
          superseded_at?: string | null;
        },
        {
          status?: "active" | "superseded";
          superseded_at?: string | null;
        }
      >;
      proposal_share_links: TableDefinition<
        {
          id: string;
          agency_id: string;
          delivery_snapshot_id: string;
          token_hash: string;
          status: "active" | "revoked";
          expires_at: string | null;
          created_by: string;
          created_at: string;
          revoked_at: string | null;
        },
        {
          id?: string;
          agency_id: string;
          delivery_snapshot_id: string;
          token_hash: string;
          status?: "active" | "revoked";
          expires_at?: string | null;
          created_by: string;
          created_at?: string;
          revoked_at?: string | null;
        },
        {
          status?: "active" | "revoked";
          expires_at?: string | null;
          revoked_at?: string | null;
        }
      >;
      usage_rate_limits: TableDefinition<
        {
          agency_id: string;
          action_key: "website_analyzer" | "opportunity_ai" | "proposal_ai";
          window_start: string;
          window_seconds: number;
          request_count: number;
          created_at: string;
          updated_at: string;
        },
        {
          agency_id: string;
          action_key: "website_analyzer" | "opportunity_ai" | "proposal_ai";
          window_start: string;
          window_seconds: number;
          request_count?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          window_seconds?: number;
          request_count?: number;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      consume_agency_rate_limit: {
        Args: {
          p_agency_id: string;
          p_action_key: "website_analyzer" | "opportunity_ai" | "proposal_ai";
          p_window_start: string;
          p_window_seconds: number;
          p_max_requests: number;
          p_requested_by: string;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_at: string;
        }[];
      };
      create_proposal_delivery_snapshot: {
        Args: {
          p_agency_id: string;
          p_proposal_id: string;
          p_created_by: string;
          p_agency_display_name: string;
          p_prospect_display_name: string;
          p_prospect_website_url: string | null;
          p_title: string;
          p_summary: string;
          p_scope: string;
          p_next_step: string;
          p_currency: CurrencyCode;
          p_subtotal_amount: number;
          p_discount_type: "none" | "fixed" | "percentage";
          p_discount_value: number;
          p_discount_amount: number;
          p_total_amount: number;
          p_line_items: Json;
          p_source_proposal_updated_at: string;
        };
        Returns: string;
      };
      create_proposal_share_link: {
        Args: {
          p_agency_id: string;
          p_delivery_snapshot_id: string;
          p_created_by: string;
          p_token_hash: string;
          p_expires_at: string | null;
        };
        Returns: string;
      };
      revoke_proposal_share_link: {
        Args: {
          p_agency_id: string;
          p_delivery_snapshot_id: string;
          p_revoked_by: string;
        };
        Returns: number;
      };
      save_proposal_draft: {
        Args: {
          p_agency_id: string;
          p_proposal_id: string;
          p_requested_by: string;
          p_title: string;
          p_status: "draft" | "ready";
          p_summary: string;
          p_scope: string;
          p_next_step: string;
          p_currency: CurrencyCode;
          p_subtotal_amount: number;
          p_discount_type: "none" | "fixed" | "percentage";
          p_discount_value: number;
          p_discount_amount: number;
          p_total_amount: number;
          p_line_items: Json;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
