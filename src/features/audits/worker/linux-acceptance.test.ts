import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createServer, request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { Readable } from "node:stream";
import { join } from "node:path";
import { linuxWorkerFactory } from "./linux-worker";
import { createPinnedEgressBroker } from "./pinned-egress";
import { openWorkerBroker } from "./socket-broker";
import { createPinnedRequestOptions, type SafeFetchTransport } from "../analyzer/safe-fetch";
import { executeRenderedAuditJob } from "../jobs/execute";
import { submitRenderedAuditJob } from "../jobs/submit";
import type { AuditJobStore } from "../jobs/repository";
import { readRenderedAudit, describeRenderedCoverage } from "../rendered/pipeline";
import { makeAudit, makeDetectedSignals, makeService } from "@/features/opportunities/test-fixtures";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RenderedCoverage } from "@/features/prospects/components/rendered-coverage";

vi.mock("server-only", () => ({}));
const enabled = process.env.SCANVORO_WORKER_ACCEPTANCE === "1" && process.env.GITHUB_ACTIONS === "true" && process.platform === "linux";
const origin = "https://fixture.scanvoro.test/";
const agency = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user = "11111111-1111-4111-8111-111111111111", prospectId = "33333333-3333-4333-8333-333333333333";
const dns = async () => [{ address: "93.184.216.34", family: 4 as const }];
const esc = (value: unknown) => "'" + String(value).replace(/'/g, "''") + "'";
function sql(query: string) {
  const container = process.env.SCANVORO_TEST_CONTAINER;
  if (!enabled || container !== `scanvoro-pg-fixture-${process.env.GITHUB_RUN_ID}`) throw new Error("Disposable database required");
  return execFileSync("/usr/bin/docker", ["exec", "-i", container, "psql", "-U", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { input: query, timeout: 10000, maxBuffer: 2_000_000 }).toString().trim();
}
// Uses real RPCs and persisted JSON in the disposable PostgreSQL; no mock repository.
const store: AuditJobStore = {
  async enqueue(i) { return JSON.parse(sql(`set role service_role; select row_to_json(j) from public.enqueue_rendered_audit(${esc(i.agencyId)},${esc(i.userId)},${esc(i.prospectId)},${esc(i.requestKey)}) j;`)); },
  async claim(i) { const row = sql(`set role service_role; select row_to_json(j) from public.claim_rendered_audit(${esc(i.agencyId)},${esc(i.jobId)}) j;`); return row ? JSON.parse(row) : null; },
  async finish(i) { return sql(`set role service_role; select public.finish_rendered_audit(${esc(i.agencyId)},${esc(i.jobId)},${esc(i.leaseToken)},${i.result === null ? "null" : esc(JSON.stringify(i.result)) + "::jsonb"},${i.retry});`) === "t"; },
};

describe.skipIf(!enabled)("Linux real Chromium / broker / PostgreSQL application acceptance", () => {
  let directory: string, certificate: Buffer, server: ReturnType<typeof createServer>, port: number;
  const received: string[] = [];
  let transport: SafeFetchTransport;
  const factory = () => linuxWorkerFactory({ imageId: process.env.SCANVORO_WORKER_IMAGE!, seccompPath: process.env.SCANVORO_WORKER_SECCOMP! });
  const broker = () => createPinnedEgressBroker({ origin, resolveHostname: dns, transport });
  const worker = () => factory()({ entryUrl: origin, egress: broker(), deadlineAt: Date.now() + 110000 });
  beforeAll(async () => {
    directory = mkdtempSync("/tmp/scanvoro-fixture-");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=fixture.scanvoro.test",
      "-addext", "subjectAltName=DNS:fixture.scanvoro.test", "-keyout", join(directory, "key"), "-out", join(directory, "cert")], { stdio: "ignore" });
    certificate = readFileSync(join(directory, "cert"));
    server = createServer({ key: readFileSync(join(directory, "key")), cert: certificate }, (req, res) => {
      expect(req.headers.authorization).toBeUndefined(); expect(req.headers.cookie).toBeUndefined();
      received.push(req.url!);
      if (req.url === "/hang") return;
      if (req.url === "/escape") { res.writeHead(302, { location: "http://169.254.169.254/" }).end(); return; }
      if (req.url === "/redirect") { res.writeHead(302, { location: "/contact" }).end(); return; }
      res.setHeader("content-type", "text/html");
      const text = "Our heating and cooling technicians provide careful repair and installation for homeowners. We explain available equipment options and help customers understand maintenance needs. Read our service details and contact the team to discuss an appropriate next step for your home. ";
      const nav = req.url === '/services' ? '' : ['services','contact','quote','booking','heating'].map(p => `<a href="/${p}">${p === 'services' ? 'Services' : p === 'contact' ? 'Contact' : p === 'quote' ? 'Quote' : p === 'booking' ? 'Booking' : 'Heating'}</a>`).join('');
      const dynamic = req.url === '/' ? `<a href="tel:+15555550100">Call our team</a><button>Request an estimate</button>` : req.url === '/contact' ? '<form>Contact our team<input type="email"><textarea></textarea><button>Send message</button></form>' : req.url === '/booking' ? '<a href="/booking">Schedule appointment</a>' : '';
      const hostile = req.url === '/policy' ? `fetch('https://escape.invalid/'); fetch('/mutate',{method:'POST',body:'denied'}); new WebSocket('wss://fixture.scanvoro.test/'); window.open('/popup'); navigator.serviceWorker.register('/sw.js').catch(()=>{});` : '';
      res.end(`<html><head><title>Fixture HVAC services</title></head><body><main><h1>Heating and cooling services</h1><p>${text.repeat(3)}</p>${nav}<section id="dynamic"></section></main><script>document.getElementById('dynamic').innerHTML=${JSON.stringify(dynamic)};${hostile}</script></body></html>`);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
    // ONLY this test maps the validated synthetic public IP to its local TLS fixture.
    // Real hostname verification remains enabled; no fixture exception exists in the product.
    transport = req => new Promise((resolve, reject) => {
      if (req.resolvedAddress.address !== "93.184.216.34" || !["fixture.scanvoro.test", "wrong.scanvoro.test"].includes(req.url.hostname)) throw new Error("Fixture mapping denied");
      const connection = httpsRequest({ ...createPinnedRequestOptions(req), hostname: "127.0.0.1", port, ca: certificate, rejectUnauthorized: true, signal: req.signal }, res => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(res.headers)) if (typeof value === "string") headers.set(name, value);
        resolve(new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, { status: res.statusCode, headers }));
      });
      connection.on("error", reject); connection.end();
    });
    sql(readFileSync("supabase/migrations/202610180001_approved_service_scope.sql", "utf8"));
    sql(`update public.prospects set website_url=${esc(origin)} where id=${esc(prospectId)};`);
  }, 15000);
  afterAll(async () => {
    server?.closeAllConnections();
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (directory?.startsWith("/tmp/scanvoro-fixture-")) rmSync(directory, { recursive: true });
    expect(execFileSync("/usr/bin/docker", ["ps", "-aq", "--filter", "name=scanvoro-render-"]).toString().trim()).toBe("");
  });

  it("authenticates fixture tenant, persists a real five-page rendered job, and matches approved service scope", async () => {
    const auth = sql(`set role authenticated; select set_config('request.jwt.claim.sub',${esc(user)},false); select id from public.prospects where id=${esc(prospectId)};`);
    expect(auth.split("\n").at(-1)).toBe(prospectId);
    const prospect = { id: prospectId, agencyId: agency, businessName: "Controlled fixture", websiteUrl: origin, contactName: null, contactEmail: null, notes: null, createdAt: "", updatedAt: "" };
    const job = await submitRenderedAuditJob({ agencyId: agency, userId: user, prospect, requestKey: "55555555-5555-4555-8555-555555555555", store });
    const fallback = vi.fn(async () => { throw new Error("Static fallback must not mask rendering failure"); });
    let startupFailure = "";
    const outcome = await executeRenderedAuditJob({ agencyId: agency, jobId: job.job_id, store,
      createWorker: async input => {
        try { return await factory()({ ...input, egress: broker() }); }
        catch (error) { startupFailure = error instanceof Error && /^Worker [a-z_ ]+failed$/.test(error.message) ? error.message : "worker_start_failed"; throw error; }
      }, staticFallback: fallback });
    expect(outcome, startupFailure).toBe("completed");
    expect(fallback).not.toHaveBeenCalled();
    const row = JSON.parse(sql(`select row_to_json(a) from public.audits a where id=${esc(job.audit_id)};`));
    expect(row.status).toBe("completed");
    const rendered = readRenderedAudit(row.normalized_signals)!;
    expect(describeRenderedCoverage(rendered)).toMatchObject({ scanned: 5, observedViewports: 10, fullSiteCoverage: false });
    const ui = renderToStaticMarkup(createElement(RenderedCoverage, { coverage: describeRenderedCoverage(rendered), locale: "en" }));
    expect(ui).toContain("inspected: 5"); expect(ui).toContain("not a complete website scan");
    expect(rendered.pages[0].signals?.contactConversion).toMatchObject({ phoneDetected: { value: true } });
    const service = makeService({ agencyId: agency, id: "66666666-6666-4666-8666-666666666666", name: "Website Conversion Optimization", price: 500,
      approvedScope: { deliverables: "Review contact CTA wording.", exclusions: "Booking integration.", clientInputs: "Approved page.", completionChecks: "Client review." } });
    sql(`insert into public.agency_services(id,agency_id,name,price,approved_scope) values(${esc(service.id)},${esc(agency)},${esc(service.name)},500,${esc(JSON.stringify(service.approvedScope))}::jsonb);`);
    const savedService = JSON.parse(sql(`select row_to_json(s) from public.agency_services s where id=${esc(service.id)};`));
    const findings = evaluateOpportunitiesForAudit({ audit: makeAudit(makeDetectedSignals(), { id: row.id, agencyId: agency, websiteUrl: origin, normalizedSignals: row.normalized_signals }),
      agencyServices: [{ ...service, approvedScope: savedService.approved_scope }] });
    expect(findings.find(f => f.ruleKey === "weak_lead_capture")?.agencyServiceId).toBe(service.id);
    expect(findings.every(f => f.evidence.every(e => e.details.includes("https://fixture.scanvoro.test/")))).toBe(true);
    expect(findings.find(f => f.ruleKey === "missing_online_booking")?.agencyServiceId).not.toBe(service.id);
    expect(await store.claim({ agencyId: agency, jobId: job.job_id })).toBeNull();
  }, 90000);

  it("denies cross-origin, POST, WebSocket, popup and service-worker escape in real Chromium", async () => {
    const live = await worker();
    try {
      const result = JSON.parse(await live.capture({ url: origin + "policy", viewport: "desktop", signal: new AbortController().signal }) as string);
      expect(result.status).toBe("incomplete"); expect(result.reasons).toContain("blocked_request");
      expect(received).not.toContain("/mutate"); expect(received).not.toContain("/popup"); expect(received).not.toContain("/sw.js");
    } finally { await live.close(); }
  }, 25000);

  it("rejects unsafe redirects, DNS rebinding, wrong TLS hostname and untrusted certificates", async () => {
    await expect(broker().get("/escape", "GET")).rejects.toThrow();
    const resolveHostname = vi.fn().mockResolvedValueOnce(await dns()).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(createPinnedEgressBroker({ origin, resolveHostname, transport }).get("/redirect", "GET")).rejects.toThrow();
    await expect(createPinnedEgressBroker({ origin: "https://wrong.scanvoro.test/", resolveHostname: dns, transport }).get("/", "GET")).rejects.toThrow();
    await expect(new Promise((resolve, reject) => { const req = httpsRequest({ hostname: "127.0.0.1", port, servername: "fixture.scanvoro.test", rejectUnauthorized: true }, resolve); req.on("error", reject); req.end(); })).rejects.toThrow();
  });

  it("rejects unauthenticated broker requests and CONNECT tunneling", async () => {
    const endpoint = join(directory, "broker.sock"), channel = await openWorkerBroker(endpoint, broker());
    const send = (method: string, token: string) => new Promise<number>((resolve, reject) => {
      const req = httpRequest({ socketPath: endpoint, path: method === "CONNECT" ? "fixture.scanvoro.test:443" : "/fetch", method, headers: { authorization: token } }, res => { res.resume(); resolve(res.statusCode!); });
      req.on("connect", (res, socket) => { socket.destroy(); resolve(res.statusCode!); });
      req.setTimeout(1000, () => req.destroy()); req.on("error", reject); req.end(JSON.stringify({ url: origin, method: "GET" }));
    });
    try {
      expect(await send("POST", "bad")).toBe(403);
      expect(await send("POST", channel.token)).toBe(200);
      await expect(send("CONNECT", channel.token)).rejects.toThrow();
    } finally { await channel.close(); }
  });

  it("terminates on capture cancellation and rejects subsequent writes", async () => {
    const live = await worker(), abort = new AbortController();
    const pending = live.capture({ url: origin + "hang", viewport: "desktop", signal: abort.signal });
    const check = expect(pending).rejects.toThrow();
    setTimeout(() => abort.abort(), 200);
    await check; await live.close();
    await expect(live.capture({ url: origin, viewport: "desktop", signal: new AbortController().signal })).rejects.toThrow();
  }, 25000);

  it("handles an actual worker crash without committing a completed audit", async () => {
    const job = await store.enqueue({ agencyId: agency, userId: user, prospectId, requestKey: "77777777-7777-4777-8777-777777777777" });
    await executeRenderedAuditJob({ agencyId: agency, jobId: job.job_id, store, staticFallback: async () => { throw new Error("No fallback fixture"); },
      createWorker: async input => {
        const live = await factory()({ ...input, egress: broker() });
        const id = execFileSync("/usr/bin/docker", ["ps", "-q", "--filter", "name=scanvoro-render-"]).toString().trim();
        execFileSync("/usr/bin/docker", ["kill", id]);
        return live;
      } });
    expect(sql(`select status from public.audits where id=${esc(job.audit_id)};`)).not.toBe("completed");
    expect(sql(`select normalized_signals::text from public.audits where id=${esc(job.audit_id)};`)).toBe("{}");
  }, 25000);

  it("enforces automatic capture timeout and cleans up without a caller abort", async () => {
    const live = await worker();
    try { await expect(live.capture({ url: origin + "hang", viewport: "desktop", signal: new AbortController().signal })).rejects.toThrow(); }
    finally { await live.close(); }
  }, 25000);

  it("rejects a real rendered result when its database lease expires before persistence", async () => {
    const otherProspect = "88888888-8888-4888-8888-888888888888";
    sql(`insert into public.prospects(id,agency_id,business_name,website_url) values(${esc(otherProspect)},${esc(agency)},'Lease fixture',${esc(origin)});`);
    const job = await store.enqueue({ agencyId: agency, userId: user, prospectId: otherProspect, requestKey: "99999999-9999-4999-8999-999999999999" });
    const fenced: AuditJobStore = { ...store, async finish(input) {
      expect(input.result).not.toBeNull();
      sql(`update public.rendered_audit_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=${esc(job.job_id)};`);
      return store.finish(input);
    } };
    expect(await executeRenderedAuditJob({ agencyId: agency, jobId: job.job_id, store: fenced,
      createWorker: input => factory()({ ...input, egress: broker() }), staticFallback: async () => { throw new Error("No fallback fixture"); } })).toBe("lease_lost");
    expect(sql(`select normalized_signals::text from public.audits where id=${esc(job.audit_id)};`)).toBe("{}");
  }, 90000);
});
