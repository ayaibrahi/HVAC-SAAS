// LOCAL ACCEPTANCE ONLY. Runs the actual Next.js routes/actions, never a fixture UI.
// Auth/PostgREST/Groq are synthetic, in-memory dependencies; no Aya data is used.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const { makeBuilderData } = await import(
  pathToFileURL(
    resolve(repo, "src/features/proposals/builder-test-fixtures.ts"),
  )
);
const fixture = makeBuilderData();
const userId = "99999999-9999-4999-8999-999999999999";
const email = "local-proposal@example.invalid";
const apiOrigin = "http://127.0.0.1:4200";
const appOrigin = "http://127.0.0.1:4198";
const serviceKey = "local-only-service-role-key";
const anonKey = "local-only-anon-key";
Object.assign(process.env, {
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  SCANVORO_LOCAL_ACCEPTANCE: "1",
  NEXT_PUBLIC_PRODUCT_NAME: "Scanvoro",
  NEXT_PUBLIC_SUPABASE_URL: apiOrigin,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  AI_PROVIDER: "groq",
  GROQ_MODEL: "openai/gpt-oss-20b",
  GROQ_API_KEY: "local-mocked-provider-only",
  OPENAI_API_KEY: "local-disabled-provider",
  OPENAI_MODEL: "local-unused-model",
});

const timestamp = () => new Date().toISOString();
let revision = Date.now();
const nextVersion = () => {
  revision = Math.max(revision + 1, Date.now());
  return new Date(revision).toISOString();
};
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email,
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: timestamp(),
};
const jwt = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ),
  Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url"),
  "synthetic-signature-not-valid-outside-this-mock",
].join(".");
const state = {
  scopeColumn: true,
  providerMode: "success",
  failSave: false,
  metrics: {
    providerMocks: 0,
    saves: 0,
    scopeSaves: 0,
    snapshots: 0,
    deniedExternal: 0,
  },
};
const snake = (value) =>
  value.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
const row = (value) =>
  Object.fromEntries(
    Object.entries(value).map(([key, field]) => [snake(key), field]),
  );
const agency = {
  ...row(fixture.agency),
  owner_user_id: userId,
  name: "TEST ONLY - Local Agency",
};
const prospect = {
  ...row(fixture.prospect),
  business_name: "TEST ONLY - Harbor Climate Care",
  website_url: "https://example.test/",
  contact_email: null,
  contact_name: null,
};
const audit = {
  ...row(fixture.audit),
  website_url: prospect.website_url,
  final_url: prospect.website_url,
};
const service = { ...row(fixture.services[0]), approved_scope: null };
const proposal = {
  ...row(fixture.proposal),
  title: "TEST ONLY - Harbor Climate Care proposal",
  subtotal_amount: 0,
  discount_type: "none",
  discount_value: 0,
  discount_amount: 0,
  total_amount: 0,
};
const opportunities = fixture.opportunities.map((value) => ({
  ...row(value),
  agency_service_id: value.agencyServiceId,
  score: value.score,
}));
const tables = {
  users: [{ id: userId, email, full_name: "Local Acceptance" }],
  agencies: [agency],
  prospects: [prospect],
  audits: [audit],
  agency_services: [service],
  opportunities,
  proposals: [proposal],
  proposal_line_items: [],
  proposal_opportunities: [],
  opportunity_ai_insights: [],
  proposal_delivery_snapshots: [],
  proposal_share_links: [],
};
function reply(res, status, value, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(value === undefined ? undefined : JSON.stringify(value));
}
async function body(req) {
  let text = "";
  for await (const part of req) {
    text += part;
    if (text.length > 128_000) throw new Error("Mock request too large");
  }
  return text ? JSON.parse(text) : {};
}
const error = (res, status, code) =>
  reply(res, status, {
    code,
    message: "Controlled local acceptance response",
    details: null,
    hint: null,
  });
function field(record, key) {
  if (key === "content->proposalAiLease->>token")
    return record.content?.proposalAiLease?.token;
  return record[key];
}
function matches(record, params) {
  for (const [key, test] of params) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (test.startsWith("eq.") && String(field(record, key)) !== test.slice(3))
      return false;
    if (
      test.startsWith("in.(") &&
      !test
        .slice(4, -1)
        .split(",")
        .includes(String(field(record, key)))
    )
      return false;
  }
  return true;
}
function owned(req) {
  return req.headers.authorization === `Bearer ${jwt}`;
}
function admin(req) {
  return req.headers.authorization === `Bearer ${serviceKey}`;
}
function rpc(name, args, res) {
  if (
    args.p_agency_id !== agency.id ||
    (args.p_requested_by ?? args.p_created_by) !== userId
  )
    return error(res, 403, "42501");
  if (name === "consume_agency_rate_limit")
    return reply(res, 200, {
      allowed: true,
      remaining: 5,
      reset_at: new Date(Date.now() + 3600000).toISOString(),
    });
  if (name === "save_proposal_draft") {
    if (state.failSave) return error(res, 500, "XX000");
    if (args.p_proposal_id !== proposal.id) return error(res, 404, "42501");
    const lines = args.p_line_items;
    if (
      !Array.isArray(lines) ||
      lines.some(
        (line) =>
          !opportunities.some((item) => item.id === line.opportunity_id) ||
          line.agency_service_id !== service.id,
      )
    )
      return error(res, 403, "42501");
    for (const key of [
      "title",
      "status",
      "summary",
      "scope",
      "next_step",
      "currency",
      "subtotal_amount",
      "discount_type",
      "discount_value",
      "discount_amount",
      "total_amount",
    ])
      proposal[key] = args["p_" + key];
    proposal.updated_at = nextVersion();
    tables.proposal_line_items = lines.map((line, index) => ({
      ...line,
      id: "77777777-7777-4777-8777-" + String(index + 1).padStart(12, "0"),
      proposal_id: proposal.id,
      agency_id: agency.id,
      created_at: timestamp(),
      updated_at: proposal.updated_at,
    }));
    tables.proposal_opportunities = lines.map((line) => ({
      ...line,
      proposal_id: proposal.id,
      agency_id: agency.id,
      created_at: timestamp(),
    }));
    state.metrics.saves++;
    return reply(res, 200, proposal.id);
  }
  if (name === "create_proposal_delivery_snapshot") {
    if (
      proposal.status !== "ready" ||
      args.p_proposal_id !== proposal.id ||
      args.p_source_proposal_updated_at !== proposal.updated_at
    )
      return error(res, 409, "23514");
    const snapshot = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      branding_asset_id: null,
      status: "active",
      superseded_at: null,
      created_at: timestamp(),
    };
    for (const [key, value] of Object.entries(args))
      snapshot[key.slice(2)] = value;
    tables.proposal_delivery_snapshots = [snapshot];
    state.metrics.snapshots++;
    return reply(res, 200, snapshot.id);
  }
  return error(res, 403, "mock_rpc_not_authorized");
}
const backend = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, apiOrigin);
    if (url.pathname === "/__acceptance" && req.method === "GET")
      return reply(res, 200, {
        ...state,
        proposal: {
          status: proposal.status,
          total: proposal.total_amount,
          hasSummary: Boolean(proposal.summary),
          hasScope: Boolean(proposal.scope),
        },
      });
    if (url.pathname === "/__acceptance" && req.method === "POST") {
      const changes = await body(req);
      if (typeof changes.scopeColumn === "boolean")
        state.scopeColumn = changes.scopeColumn;
      if (typeof changes.failSave === "boolean")
        state.failSave = changes.failSave;
      if (["success", "malformed", "request"].includes(changes.providerMode))
        state.providerMode = changes.providerMode;
      return reply(res, 200, { configured: true });
    }
    if (url.pathname === "/auth/v1/token" && req.method === "POST") {
      const credentials = await body(req);
      if (
        credentials.email !== email ||
        credentials.password !== "Local-test-only-123!"
      )
        return error(res, 400, "invalid_credentials");
      return reply(res, 200, {
        access_token: jwt,
        refresh_token: "local-refresh-only",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return owned(req) ? reply(res, 200, user) : error(res, 401, "bad_jwt");
    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (!owned(req) && !admin(req)) return error(res, 401, "42501");
    if (url.pathname.startsWith("/rest/v1/rpc/") && req.method === "POST") {
      if (!admin(req)) return error(res, 403, "42501");
      return rpc(url.pathname.split("/").at(-1), await body(req), res);
    }
    const name = url.pathname.split("/").at(-1);
    if (!url.pathname.startsWith("/rest/v1/") || !Object.hasOwn(tables, name))
      return error(res, 404, "PGRST205");
    if (
      name === "agency_services" &&
      !state.scopeColumn &&
      url.searchParams.get("select")?.includes("approved_scope")
    )
      return error(res, 400, "42703");
    let records = tables[name].filter((value) =>
      matches(value, url.searchParams),
    );
    if (req.method === "PATCH") {
      const change = await body(req);
      if (
        name === "agency_services" &&
        !state.scopeColumn &&
        Object.hasOwn(change, "approved_scope")
      )
        return error(res, 400, "PGRST204");
      if (name !== "agency_services" && (name !== "proposals" || !admin(req)))
        return error(res, 403, "42501");
      for (const record of records)
        Object.assign(record, change, { updated_at: nextVersion() });
      if (name === "agency_services") state.metrics.scopeSaves++;
    } else if (!["GET", "HEAD"].includes(req.method))
      return error(res, 403, "mock_write_not_authorized");
    const total = records.length;
    if (url.searchParams.has("limit"))
      records = records.slice(
        Number(url.searchParams.get("offset") ?? 0),
        Number(url.searchParams.get("offset") ?? 0) +
          Number(url.searchParams.get("limit")),
      );
    records = records.map((value) =>
      name === "agency_services" && !state.scopeColumn
        ? Object.fromEntries(
            Object.entries(value).filter(([key]) => key !== "approved_scope"),
          )
        : value,
    );
    if (
      url.searchParams
        .get("select")
        ?.includes("quality:normalized_signals->quality")
    )
      records = records.map((value) => ({
        ...value,
        quality: value.normalized_signals.quality,
      }));
    const headers = {
      "Content-Range": `${total ? "0-" + (total - 1) : "*"}/${total}`,
    };
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    if (req.headers.accept?.includes("vnd.pgrst.object"))
      return records.length === 1
        ? reply(res, 200, records[0], headers)
        : error(res, 406, "PGRST116");
    return reply(res, 200, records, headers);
  } catch {
    error(res, 500, "mock_request_invalid");
  }
});
await new Promise((resolve) => backend.listen(4200, "127.0.0.1", resolve));

const originalFetch = globalThis.fetch;
globalThis.fetch = async (resource, options) => {
  const url = new URL(
    typeof resource === "string" || resource instanceof URL
      ? resource
      : resource.url,
  );
  if (
    url.origin === "https://api.groq.com" &&
    url.pathname === "/openai/v1/chat/completions"
  ) {
    state.metrics.providerMocks++;
    if (state.providerMode === "request")
      return new Response(
        JSON.stringify({
          error: { code: "invalid_request_error", param: "response_format" },
        }),
        { status: 400 },
      );
    const request = JSON.parse(options.body);
    const choices = JSON.parse(request.messages[1].content).approvedCopyOptions;
    const draft = Object.fromEntries(
      Object.entries(choices).map(([key, variants]) => [key, variants[0]]),
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return new Response(
      JSON.stringify({
        model: request.model,
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content:
                state.providerMode === "malformed"
                  ? "{broken"
                  : JSON.stringify(draft),
            },
          },
        ],
      }),
    );
  }
  if (![apiOrigin, appOrigin].includes(url.origin)) {
    state.metrics.deniedExternal++;
    throw new Error(
      "External network requests are forbidden in local acceptance",
    );
  }
  return originalFetch(resource, options);
};
const next = require("next");
const acceptanceDir = resolve(repo, "dist/phase-3c-acceptance");
await mkdir(acceptanceDir, { recursive: true });
await writeFile(
  resolve(acceptanceDir, "tsconfig.json"),
  JSON.stringify(
    {
      extends: "../../tsconfig.json",
      include: [
        "../../src/**/*.ts",
        "../../src/**/*.tsx",
        "../../next-env.d.ts",
      ],
      exclude: ["../../node_modules"],
    },
    null,
    2,
  ),
);
const app = next({
  dev: true,
  webpack: true,
  dir: repo,
  hostname: "127.0.0.1",
  port: 4198,
  conf: { reactStrictMode: true, distDir: "dist/phase-3c-acceptance" },
});
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((req, res) => handle(req, res));
await new Promise((resolve) => server.listen(4198, "127.0.0.1", resolve));
console.log(
  "LOCAL ONLY: actual Next.js application http://127.0.0.1:4198/sign-in; synthetic Auth/database/provider; no Aya data.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.close();
    backend.close();
    await app.close();
    process.exit(0);
  });
