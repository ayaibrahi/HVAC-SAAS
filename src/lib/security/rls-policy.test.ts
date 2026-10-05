import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");
const migrationSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
  .join("\n")
  .toLowerCase();

const engineTables = [
  "audits",
  "opportunities",
  "opportunity_ai_insights",
  "proposals",
  "proposal_opportunities",
  "proposal_line_items",
  "proposal_delivery_snapshots",
  "proposal_share_links",
];

const serverOwnedTables = ["usage_rate_limits"];

const serviceRoleOnlyMutatingRpcs = [
  {
    name: "consume_agency_rate_limit",
    signature:
      "uuid, text, timestamptz, integer, integer, uuid",
  },
  {
    name: "save_proposal_draft",
    signature:
      "uuid, uuid, uuid, text, text, text, text, text, text, numeric, text, numeric, numeric, numeric, jsonb",
  },
  {
    name: "create_proposal_delivery_snapshot",
    signature:
      "uuid, uuid, uuid, text, text, text, text, text, text, text, text, numeric, text, numeric, numeric, numeric, jsonb, timestamptz",
  },
  {
    name: "create_proposal_share_link",
    signature: "uuid, uuid, uuid, text, timestamptz",
  },
  {
    name: "revoke_proposal_share_link",
    signature: "uuid, uuid, uuid",
  },
];

function sqlStatementPattern(statement: string) {
  const escaped = statement
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");

  return new RegExp(
    escaped.replace(/\\\(/g, "\\(\\s*").replace(/\\\)/g, "\\s*\\)"),
  );
}

describe("engine-owned table RLS policies", () => {
  it("enables tenant-scoped reads for each engine-owned table", () => {
    for (const table of engineTables) {
      expect(migrationSql).toMatch(
        new RegExp(
          `create policy "[^"]+"\\s+on public\\.${table}\\s+for select\\s+to authenticated\\s+using \\(public\\.current_user_owns_agency\\(agency_id\\)\\)`,
        ),
      );
    }
  });

  it("does not grant authenticated users broad write policies on engine-owned tables", () => {
    for (const table of engineTables) {
      expect(migrationSql).not.toMatch(
        new RegExp(`on public\\.${table}\\s+for\\s+(all|insert|update|delete)`),
      );
    }
  });

  it("keeps agency ownership on engine-owned tables", () => {
    for (const table of engineTables) {
      const tableDefinition = migrationSql.match(
        new RegExp(`create table if not exists public\\.${table}[\\s\\S]*?\\);`),
      )?.[0];

      expect(tableDefinition).toContain("agency_id uuid not null");
    }
  });

  it("stores analyzer output without broadening audit write access", () => {
    const auditDefinition = migrationSql.match(
      /create table if not exists public\.audits[\s\S]*?\);/,
    )?.[0];

    expect(auditDefinition).toContain("final_url text");
    expect(auditDefinition).toContain(
      "check (status in ('pending', 'running', 'completed', 'failed'))",
    );
    expect(auditDefinition).toContain("normalized_signals jsonb not null");
    expect(auditDefinition).toContain("vertical_key text not null default 'hvac'");
    expect(auditDefinition).toContain("playbook_version text not null default '1.0.0'");
  });

  it("keeps server-owned usage counters private to service-role operations", () => {
    for (const table of serverOwnedTables) {
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migrationSql).toContain(
        `revoke all on table public.${table} from authenticated`,
      );
      expect(migrationSql).not.toMatch(
        new RegExp(`create policy "[^"]+"\\s+on public\\.${table}`),
      );
    }

    expect(migrationSql).toContain(
      "create or replace function public.consume_agency_rate_limit",
    );
    expect(migrationSql).toContain("agency_user_not_authorized");
    expect(migrationSql).toContain(
      "grant execute on function public.consume_agency_rate_limit",
    );
    expect(migrationSql).toContain("to service_role");
  });

  it("limits mutating security-definer RPC execution to service-role callers", () => {
    for (const rpc of serviceRoleOnlyMutatingRpcs) {
      const functionTarget = `function public.${rpc.name}(${rpc.signature})`;

      expect(migrationSql).toMatch(
        sqlStatementPattern(`revoke execute on ${functionTarget} from public`),
      );
      expect(migrationSql).toMatch(
        sqlStatementPattern(`revoke execute on ${functionTarget} from anon`),
      );
      expect(migrationSql).toMatch(
        sqlStatementPattern(
          `revoke execute on ${functionTarget} from authenticated`,
        ),
      );
      expect(migrationSql).toMatch(
        sqlStatementPattern(`grant execute on ${functionTarget} to service_role`),
      );
    }
  });

  it("stores one current AI insight per opportunity with a tenant-safe relationship", () => {
    const insightDefinition = migrationSql.match(
      /create table if not exists public\.opportunity_ai_insights[\s\S]*?\);/,
    )?.[0];

    expect(insightDefinition).toContain("unique (opportunity_id)");
    expect(insightDefinition).toContain(
      "foreign key (opportunity_id, agency_id)",
    );
    expect(insightDefinition).toContain(
      "references public.opportunities(id, agency_id)",
    );
    expect(insightDefinition).toContain(
      "check (status in ('not_generated', 'generating', 'completed', 'failed'))",
    );
  });

  it("stores delivery snapshots with server-owned lifecycle constraints", () => {
    const snapshotDefinition = migrationSql.match(
      /create table if not exists public\.proposal_delivery_snapshots[\s\S]*?\);/,
    )?.[0];

    expect(snapshotDefinition).toContain("status text not null default 'active'");
    expect(snapshotDefinition).toContain("check (status in ('active', 'superseded'))");
    expect(snapshotDefinition).toContain("line_items jsonb not null");
    expect(snapshotDefinition).toContain("foreign key (proposal_id, agency_id)");
    expect(snapshotDefinition).toContain("references public.proposals(id, agency_id)");
    expect(migrationSql).toContain(
      "create unique index if not exists proposal_delivery_snapshots_active_proposal_idx",
    );
    expect(migrationSql).toContain(
      "create or replace function public.create_proposal_delivery_snapshot",
    );
    expect(migrationSql).toContain("for update;");
    expect(migrationSql).toContain("v_proposal_status <> 'ready'");
    expect(migrationSql).toContain("p_source_proposal_updated_at");
    expect(migrationSql).toContain("agency_user_not_authorized");
    expect(migrationSql).toContain(
      "grant execute on function public.create_proposal_delivery_snapshot",
    );
    expect(migrationSql).toContain("to service_role");
  });

  it("stores proposal share links as hashed server-owned bearer credentials", () => {
    const shareLinkDefinition = migrationSql.match(
      /create table if not exists public\.proposal_share_links[\s\S]*?\);/,
    )?.[0];

    expect(shareLinkDefinition).toContain("delivery_snapshot_id uuid not null");
    expect(shareLinkDefinition).toContain("token_hash text not null");
    expect(shareLinkDefinition).toContain(
      "check (length(token_hash) = 64 and token_hash ~ '^[a-f0-9]{64}$')",
    );
    expect(shareLinkDefinition).not.toContain(" token text");
    expect(shareLinkDefinition).toContain(
      "check (status in ('active', 'revoked'))",
    );
    expect(shareLinkDefinition).toContain(
      "foreign key (delivery_snapshot_id, agency_id)",
    );
    expect(shareLinkDefinition).toContain(
      "references public.proposal_delivery_snapshots(id, agency_id)",
    );
    expect(shareLinkDefinition).toContain("on delete cascade");
    expect(migrationSql).toContain(
      "create unique index if not exists proposal_share_links_active_snapshot_idx",
    );
    expect(migrationSql).toContain(
      "create or replace function public.create_proposal_share_link",
    );
    expect(migrationSql).toContain(
      "create or replace function public.revoke_proposal_share_link",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.create_proposal_share_link",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.revoke_proposal_share_link",
    );
    expect(migrationSql).toContain("to service_role");
    expect(migrationSql).not.toMatch(
      /create policy "[^"]+"\s+on public\.proposal_share_links\s+for select\s+to public/,
    );
    expect(migrationSql).toContain(
      "revoke all on table public.proposal_share_links from authenticated",
    );
    expect(migrationSql).toContain(
      "grant select (\n  id,\n  agency_id,\n  delivery_snapshot_id,\n  status,\n  expires_at,\n  created_at,\n  revoked_at\n) on public.proposal_share_links to authenticated",
    );
    expect(migrationSql).not.toContain(
      "token_hash\n) on public.proposal_share_links to authenticated",
    );
  });
});
