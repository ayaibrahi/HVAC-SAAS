// Disposable in-memory PostgreSQL only. Never reads .env or opens a DB connection.
// Install PGlite in a separate local directory; pass that directory, not a URL.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const runtimeDirectory = process.argv[2];
if (!runtimeDirectory || runtimeDirectory.includes("://"))
  throw Error("Pass a local PGlite package directory, never a database URL.");
const require = createRequire(join(resolve(runtimeDirectory), "package.json"));
const { PGlite } = await import(
  pathToFileURL(require.resolve("@electric-sql/pglite"))
);
const { pgcrypto } = await import(
  pathToFileURL(require.resolve("@electric-sql/pglite/contrib/pgcrypto"))
);
const db = new PGlite({ extensions: { pgcrypto } });
let assertions = 0;
const a = "22222222-2222-4222-8222-222222222222",
  b = "33333333-3333-4333-8333-333333333333";
const u = "11111111-1111-4111-8111-111111111111",
  v = "99999999-9999-4999-8999-999999999999";
const assetA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  assetB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const proposal = "44444444-4444-4444-8444-444444444444";

async function test(name, run) {
  await run();
  assertions++;
  console.log(`PASS ${name}`);
}
async function asRole(role, user, run) {
  assert(["authenticated", "anon", "service_role"].includes(role));
  await db.exec(`begin; set local role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
    user ?? "",
  ]);
  try {
    const result = await run();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}
async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
async function expectDenied(run) {
  await assert.rejects(run, (e) =>
    ["42501", "23503", "P0001"].includes(e.code),
  );
}
async function makeSnapshot() {
  const updated = await scalar(
    "select updated_at from public.proposals where id=$1",
    [proposal],
  );
  return asRole("service_role", null, () =>
    scalar(
      `select public.create_proposal_delivery_snapshot(
    $1::uuid,$2::uuid,$3::uuid,'Caller name must not override stored identity','TEST ONLY Client',null,
    'TEST ONLY Proposal','Saved summary','Saved scope','Review before approval','USD',500,'none',0,0,500,
    '[{"position":0,"serviceName":"TEST ONLY Service","serviceDescription":null,"description":"Manual scope","quantity":1,"unitPrice":500,"lineTotal":500}]'::jsonb,$4::timestamptz)`,
      [a, proposal, u, updated],
    ),
  );
}

try {
  // Minimal Auth/Storage service-schema scaffolding, NOT the Supabase HTTP service.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to authenticated, service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create policy "Broad fixture policy" on storage.objects for all to anon,authenticated using(true) with check(true);
  `);
  const dir = resolve("supabase/migrations");
  const migration = "202610170001_agency_branding.sql";
  for (const file of (await readdir(dir))
    .filter((f) => f.endsWith(".sql") && f !== migration)
    .sort())
    await db.exec(await readFile(join(dir, file), "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'test-a@example.invalid'),($2,'test-b@example.invalid')",
    [u, v],
  );
  await db.query(
    "insert into public.agencies(id,owner_user_id,name) values($1,$2,'TEST ONLY Original A'),($3,$4,'TEST ONLY Agency B')",
    [a, u, b, v],
  );
  const prospect = "55555555-5555-4555-8555-555555555555",
    audit = "66666666-6666-4666-8666-666666666666";
  await db.query(
    "insert into public.prospects(id,agency_id,business_name,website_url) values($1,$2,'TEST ONLY Client','https://example.invalid')",
    [prospect, a],
  );
  await db.query(
    "insert into public.audits(id,agency_id,prospect_id,status,website_url) values($1,$2,$3,'completed','https://example.invalid')",
    [audit, a, prospect],
  );
  await db.query(
    "insert into public.proposals(id,agency_id,prospect_id,audit_id,title,status) values($1,$2,$3,$4,'TEST ONLY','ready')",
    [proposal, a, prospect, audit],
  );
  const legacy = await makeSnapshot();
  const legacyName = await scalar(
    "select agency_display_name from public.proposal_delivery_snapshots where id=$1",
    [legacy],
  );
  await test("prepared migration executes over every existing migration", async () =>
    db.exec(await readFile(join(dir, migration), "utf8")));
  await test("legacy rows are not backfilled or renamed", async () => {
    assert.equal(
      await scalar(
        "select branding_asset_id from public.proposal_delivery_snapshots where id=$1",
        [legacy],
      ),
      null,
    );
    assert.equal(
      await scalar(
        "select agency_display_name from public.proposal_delivery_snapshots where id=$1",
        [legacy],
      ),
      legacyName,
    );
  });
  await test("private bucket has PNG and byte restrictions", async () => {
    const row = (
      await db.query("select * from storage.buckets where id='agency-branding'")
    ).rows[0];
    assert.equal(row.public, false);
    assert.equal(row.file_size_limit, 1048576);
    assert.deepEqual(row.allowed_mime_types, ["image/png"]);
  });
  for (const [id, agency, hash] of [
    [assetA, a, "a".repeat(64)],
    [assetB, b, "b".repeat(64)],
  ]) {
    await asRole("service_role", null, () =>
      db.query(
        "insert into public.agency_branding_assets(id,agency_id,sha256,object_key,mime_type,byte_length,width,height) values($1,$2,$3,$4,'image/png',100,100,100) on conflict(agency_id,sha256) do nothing",
        [id, agency, hash, `${agency}/${hash}.png`],
      ),
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('agency-branding',$1)",
      [`${agency}/${hash}.png`],
    );
  }
  await test("own metadata readable under RLS", async () =>
    assert.equal(
      await asRole("authenticated", u, () =>
        scalar("select count(*)::int from public.agency_branding_assets"),
      ),
      1,
    ));
  await test("foreign metadata invisible under RLS", async () =>
    assert.equal(
      await asRole("authenticated", u, () =>
        scalar(
          "select count(*)::int from public.agency_branding_assets where agency_id=$1",
          [b],
        ),
      ),
      0,
    ));
  await test("anonymous metadata denied", async () =>
    expectDenied(() =>
      asRole("anon", null, () =>
        db.query("select * from public.agency_branding_assets"),
      ),
    ));
  await test("authenticated metadata inserts denied", async () =>
    expectDenied(() =>
      asRole("authenticated", u, () =>
        db.query(
          "insert into public.agency_branding_assets(id,agency_id,sha256,object_key,mime_type,byte_length,width,height) values(gen_random_uuid(),$1,$2,$3,'image/png',100,100,100)",
          [a, "c".repeat(64), `${a}/${"c".repeat(64)}.png`],
        ),
      ),
    ));
  await test("active branding cannot be client-written", async () =>
    expectDenied(() =>
      asRole("authenticated", u, () =>
        db.query("insert into public.agency_branding(agency_id) values($1)", [
          a,
        ]),
      ),
    ));
  await test("branding RPC cannot be called by authenticated or anon roles", async () => {
    for (const role of ["authenticated", "anon"])
      await expectDenied(() =>
        asRole(role, u, () =>
          db.query("select public.set_agency_branding_asset($1,$2,$3)", [
            a,
            u,
            assetA,
          ]),
        ),
      );
  });
  await test("RPC rejects wrong owner even with service-role invocation", async () =>
    expectDenied(() =>
      asRole("service_role", null, () =>
        db.query("select public.set_agency_branding_asset($1,$2,$3)", [
          a,
          v,
          assetA,
        ]),
      ),
    ));
  await test("RPC rejects cross-agency assets", async () =>
    expectDenied(() =>
      asRole("service_role", null, () =>
        db.query("select public.set_agency_branding_asset($1,$2,$3)", [
          a,
          u,
          assetB,
        ]),
      ),
    ));
  await test("owner can activate a verified stored asset", async () =>
    asRole("service_role", null, () =>
      db.query("select public.set_agency_branding_asset($1,$2,$3)", [
        a,
        u,
        assetA,
      ]),
    ));
  await test("active-selection RLS allows only the agency owner", async () => {
    assert.equal(
      await asRole("authenticated", u, () =>
        scalar("select count(*)::int from public.agency_branding"),
      ),
      1,
    );
    assert.equal(
      await asRole("authenticated", v, () =>
        scalar("select count(*)::int from public.agency_branding"),
      ),
      0,
    );
  });
  await test("Storage objects cannot be read even with a broad permissive policy", async () => {
    for (const role of ["authenticated", "anon"])
      assert.equal(
        await asRole(role, u, () =>
          scalar(
            "select count(*)::int from storage.objects where bucket_id='agency-branding'",
          ),
        ),
        0,
      );
  });
  await test("Storage objects cannot be directly inserted, updated or deleted", async () => {
    await expectDenied(() =>
      asRole("authenticated", u, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('agency-branding','arbitrary')",
        ),
      ),
    );
    const result = await asRole("authenticated", u, () =>
      db.query(
        "delete from storage.objects where bucket_id='agency-branding' returning id",
      ),
    );
    assert.equal(result.rows.length, 0);
    const updates = await asRole("authenticated", u, () =>
      db.query(
        "update storage.objects set name='changed' where bucket_id='agency-branding' returning id",
      ),
    );
    assert.equal(updates.rows.length, 0);
  });
  await test("existing snapshot idempotency does not retrofit today's logo", async () => {
    assert.equal(await makeSnapshot(), legacy);
    assert.equal(
      await scalar(
        "select branding_asset_id from public.proposal_delivery_snapshots where id=$1",
        [legacy],
      ),
      null,
    );
  });
  await db.query(
    "update public.proposals set summary='TEST ONLY next revision' where id=$1",
    [proposal],
  );
  const issued = await makeSnapshot();
  await test("new snapshot freezes the exact active logo and database agency name", async () => {
    assert.notEqual(issued, legacy);
    const row = (
      await db.query(
        "select * from public.proposal_delivery_snapshots where id=$1",
        [issued],
      )
    ).rows[0];
    assert.equal(row.branding_asset_id, assetA);
    assert.equal(row.agency_display_name, "TEST ONLY Original A");
    assert.equal(row.total_amount, "500.00");
    assert.equal(row.summary, "Saved summary");
  });
  await test("removal changes only future selection; issued snapshot retains logo", async () => {
    await asRole("service_role", null, () =>
      db.query("select public.set_agency_branding_asset($1,$2,null)", [a, u]),
    );
    assert.equal(
      await scalar(
        "select active_asset_id from public.agency_branding where agency_id=$1",
        [a],
      ),
      null,
    );
    assert.equal(
      await scalar(
        "select branding_asset_id from public.proposal_delivery_snapshots where id=$1",
        [issued],
      ),
      assetA,
    );
  });
  await test("new revisions after removal use name-only branding", async () => {
    await db.query(
      "update public.proposals set summary='TEST ONLY removal revision' where id=$1",
      [proposal],
    );
    const afterRemoval = await makeSnapshot();
    assert.equal(
      await scalar(
        "select branding_asset_id from public.proposal_delivery_snapshots where id=$1",
        [afterRemoval],
      ),
      null,
    );
    assert.equal(
      await scalar(
        "select branding_asset_id from public.proposal_delivery_snapshots where id=$1",
        [issued],
      ),
      assetA,
    );
  });
  await test("historical branding is immutable even to direct SQL updates", async () => {
    await expectDenied(() =>
      db.query(
        "update public.proposal_delivery_snapshots set branding_asset_id=null where id=$1",
        [issued],
      ),
    );
    await expectDenied(() =>
      db.query(
        "update public.proposal_delivery_snapshots set agency_display_name='changed' where id=$1",
        [issued],
      ),
    );
    await expectDenied(() =>
      db.query(
        "update public.agency_branding_assets set width=10 where id=$1",
        [assetA],
      ),
    );
  });
  await test("asset references cannot cross tenants, including direct SQL", async () => {
    await assert.rejects(
      db.query(
        "insert into public.agency_branding(agency_id,active_asset_id) values($1,$2)",
        [b, assetA],
      ),
      (e) => e.code === "23503",
    );
  });
  await test("referenced assets cannot be deleted", async () =>
    expectDenied(() =>
      db.query("delete from public.agency_branding_assets where id=$1", [
        assetA,
      ]),
    ));
  await test("service role cannot update or delete asset metadata directly", async () => {
    await expectDenied(() =>
      asRole("service_role", null, () =>
        db.query("delete from public.agency_branding_assets where id=$1", [
          assetA,
        ]),
      ),
    );
    await expectDenied(() =>
      asRole("service_role", null, () =>
        db.query(
          "update public.agency_branding_assets set width=10 where id=$1",
          [assetA],
        ),
      ),
    );
  });
  await test("proposal deletion leaves asset retention intact", async () => {
    await db.query("delete from public.proposals where id=$1", [proposal]);
    assert.equal(
      await scalar(
        "select count(*)::int from public.agency_branding_assets where id=$1",
        [assetA],
      ),
      1,
    );
  });
  await test("agency deletion cascades metadata without conflicting snapshot references", async () => {
    await db.query(
      "insert into public.proposals(id,agency_id,prospect_id,audit_id,title,status) values($1,$2,$3,$4,'TEST ONLY cascade test','ready')",
      [proposal, a, prospect, audit],
    );
    await asRole("service_role", null, () =>
      db.query("select public.set_agency_branding_asset($1,$2,$3)", [
        a,
        u,
        assetA,
      ]),
    );
    const referenced = await makeSnapshot();
    assert.equal(
      await scalar(
        "select branding_asset_id from public.proposal_delivery_snapshots where id=$1",
        [referenced],
      ),
      assetA,
    );
    await db.query("delete from public.agencies where id=$1", [a]);
    assert.equal(
      await scalar(
        "select count(*)::int from public.agency_branding_assets where agency_id=$1",
        [a],
      ),
      0,
    );
  });
  console.log(
    `${assertions} isolated PostgreSQL scenarios passed. No network or remote database used.`,
  );
} finally {
  await db.close();
}
