"""Actual PostgreSQL tests; execution is restricted to the disposable CI container."""
import concurrent.futures
import os
import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTAINER = os.environ.get("SCANVORO_TEST_CONTAINER", "")
if (os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("RUNNER_OS") != "Linux"
        or not re.fullmatch(r"scanvoro-pg-fixture-[0-9]+", CONTAINER)
        or CONTAINER != "scanvoro-pg-fixture-" + os.environ.get("GITHUB_RUN_ID", "")):
    raise SystemExit("Refusing to run outside the disposable CI database")


def sql(query, success=True):
    cmd = ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
    result = subprocess.run(cmd, input=query, text=True, capture_output=True, timeout=20, check=False)
    if success and result.returncode != 0:
        raise AssertionError("Fixture SQL failed: " + result.stderr[-1500:])
    if not success and result.returncode == 0:
        raise AssertionError("Expected fixture SQL rejection")
    return result.stdout.strip()


AGENCY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
AGENCY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"
PROSPECT_A = "33333333-3333-4333-8333-333333333333"
PROSPECT_B = "44444444-4444-4444-8444-444444444444"
REQUEST = "55555555-5555-4555-8555-555555555555"


def enqueue(agency=AGENCY_A, user=USER_A, prospect=PROSPECT_A, request=REQUEST):
    return sql(f"set role service_role; select job_id || '|' || audit_id || '|' || status from public.enqueue_rendered_audit('{agency}','{user}','{prospect}','{request}');")


def claim(job, agency=AGENCY_A):
    return sql(f"set role service_role; select job_id || '|' || lease_token || '|' || attempts from public.claim_rendered_audit('{agency}','{job}');")


class RealPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        version = sql("show server_version_num;")
        if not version.startswith("17"):
            raise AssertionError("PostgreSQL 17 required")
        sql("""
          create role anon nologin; create role authenticated nologin;
          create role service_role nologin bypassrls;
          create schema auth; grant usage on schema auth to authenticated, service_role;
          create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
          create function auth.uid() returns uuid language sql stable as
            $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
          grant execute on function auth.uid() to authenticated;
        """)
        for name in ["202609190001_foundation.sql", "20261008084137_enforce_single_active_audit_per_prospect.sql", "202610270001_rendered_audit_jobs.sql"]:
            sql((ROOT / "supabase" / "migrations" / name).read_text(encoding="utf-8"))
        sql("grant usage on schema public to authenticated, service_role; grant select on public.audits to authenticated;")

    def setUp(self):
        sql(f"""
          truncate auth.users cascade;
          insert into auth.users(id,email,raw_user_meta_data) values ('{USER_A}','a@example.test','{{}}'),('{USER_B}','b@example.test','{{}}');
          insert into public.agencies(id,owner_user_id,name) values ('{AGENCY_A}','{USER_A}','A'),('{AGENCY_B}','{USER_B}','B');
          insert into public.prospects(id,agency_id,business_name,website_url) values
            ('{PROSPECT_A}','{AGENCY_A}','A','https://example.com/'),('{PROSPECT_B}','{AGENCY_B}','B','https://example.org/');
        """)

    def test_tenant_rls_and_direct_job_access(self):
        job, audit, _ = enqueue().split("|")
        visible = sql(f"set role authenticated; select set_config('request.jwt.claim.sub','{USER_A}',false); select count(*) from public.audits where id='{audit}';")
        self.assertEqual(visible.splitlines()[-1], "1")
        hidden = sql(f"set role authenticated; select set_config('request.jwt.claim.sub','{USER_B}',false); select count(*) from public.audits where id='{audit}';")
        self.assertEqual(hidden.splitlines()[-1], "0")
        sql("set role authenticated; select * from public.rendered_audit_jobs;", success=False)
        sql(f"set role authenticated; select * from public.claim_rendered_audit('{AGENCY_A}','{job}');", success=False)
        sql(f"set role service_role; select * from public.enqueue_rendered_audit('{AGENCY_A}','{USER_B}','{PROSPECT_A}','{REQUEST}');", success=False)
        self.assertEqual(claim(job, AGENCY_B), "")

    def test_concurrent_idempotent_enqueue_and_claim(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: enqueue(), range(4)))
        self.assertEqual(len(set(results)), 1)
        job = results[0].split("|")[0]
        self.assertEqual(sql("select count(*) from public.rendered_audit_jobs;"), "1")
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            claims = list(pool.map(lambda _: claim(job), range(4)))
        self.assertEqual(sum(bool(value) for value in claims), 1)

    def test_expired_lease_fences_old_worker_and_completes_atomically(self):
        job, audit, _ = enqueue().split("|")
        first = claim(job).split("|")[1]
        sql(f"update public.rendered_audit_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id='{job}';")
        second = claim(job).split("|")[1]
        self.assertNotEqual(first, second)
        self.assertEqual(sql(f"set role service_role; select public.finish_rendered_audit('{AGENCY_A}','{job}','{first}','{{}}'::jsonb,false);"), "f")
        self.assertEqual(sql(f"set role service_role; select public.finish_rendered_audit('{AGENCY_A}','{job}','{second}','{{}}'::jsonb,false);"), "t")
        self.assertEqual(sql(f"select status from public.audits where id='{audit}';"), "completed")
        self.assertEqual(claim(job), "")

    def test_crash_timeout_and_attempt_exhaustion(self):
        job, audit, _ = enqueue().split("|")
        self.assertTrue(claim(job))
        sql(f"update public.rendered_audit_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id='{job}';")
        self.assertTrue(claim(job))
        sql(f"update public.rendered_audit_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id='{job}';")
        self.assertEqual(claim(job), "")
        self.assertEqual(sql(f"select status || '|' || error_code from public.audits where id='{audit}';"), "failed|WORKER_TIMEOUT")

    def test_retry_then_terminal_failure(self):
        job, audit, _ = enqueue().split("|")
        first = claim(job).split("|")[1]
        self.assertEqual(sql(f"set role service_role; select public.finish_rendered_audit('{AGENCY_A}','{job}','{first}',null,true);"), "t")
        self.assertEqual(sql(f"select status from public.audits where id='{audit}';"), "pending")
        second = claim(job).split("|")[1]
        self.assertEqual(sql(f"set role service_role; select public.finish_rendered_audit('{AGENCY_A}','{job}','{second}',null,true);"), "t")
        self.assertEqual(sql(f"select status || '|' || error_code from public.audits where id='{audit}';"), "failed|WORKER_FAILED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
