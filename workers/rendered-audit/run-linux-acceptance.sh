#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_OS:-}" == Linux && "${GITHUB_RUN_ATTEMPT:-}" == 1 ]]
[[ $(id -u) -ge 1000 ]]
umask 077
stage=$(mktemp -d /tmp/scanvoro-worker-build-XXXXXX)
database="scanvoro-pg-fixture-${GITHUB_RUN_ID:?}"
image="scanvoro-broker-worker:${GITHUB_RUN_ID}"
created=false
cleanup() {
  if [[ "$created" == true ]]; then docker rm -f -v "$database" >/dev/null; fi
  # This is a fresh disposable hosted runner; only this test creates these names.
  mapfile -t workers < <(docker ps -aq --filter name=scanvoro-render-)
  if [[ ${#workers[@]} -gt 0 ]]; then docker rm -f -v "${workers[@]}" >/dev/null; fi
  [[ -z $(docker ps -aq --filter name=scanvoro-render-) ]]
  case "$stage" in /tmp/scanvoro-worker-build-*) rm -rf -- "$stage" ;; *) return 1 ;; esac
  echo WORKER_SUITE_CLEANUP_PASS
}
trap cleanup EXIT
# Explicit context excludes the project, .env files, credentials and backups.
cp experiments/rendered-audit/package.json experiments/rendered-audit/package-lock.json "$stage/"
cp workers/rendered-audit/Dockerfile workers/rendered-audit/runtime.mjs "$stage/"
cp src/features/audits/rendered/dom.ts "$stage/"
timeout --signal=TERM --kill-after=5s 240s docker build --platform linux/amd64 --tag "$image" "$stage"
export SCANVORO_WORKER_IMAGE
SCANVORO_WORKER_IMAGE=$(docker image inspect --format '{{.Id}}' "$image")
export SCANVORO_WORKER_SECCOMP="$PWD/workers/rendered-audit/seccomp.json"
timeout 120s docker pull postgres:17.11-bookworm@sha256:2cd2c0f809604aaeff6f0ec8f40aecbd025613107561015c69369a1a7f1d3416 >/dev/null
docker create --name "$database" --network none --memory 512m --cpus 1 --pids-limit 128 \
  -e POSTGRES_PASSWORD=synthetic-fixture-only postgres:17.11-bookworm@sha256:2cd2c0f809604aaeff6f0ec8f40aecbd025613107561015c69369a1a7f1d3416 >/dev/null
created=true
docker start "$database" >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$database" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$database" pg_isready -U postgres >/dev/null
export SCANVORO_TEST_CONTAINER="$database"
# Reuse setup only, not the already-passed PostgreSQL regression suite.
PYTHONDONTWRITEBYTECODE=1 python3 -c 'import sys; sys.path.insert(0,"experiments/rendered-audit-db"); import test_postgres as t; t.RealPostgresTests.setUpClass(); t.RealPostgresTests("test_tenant_rls_and_direct_job_access").setUp()'
export SCANVORO_WORKER_ACCEPTANCE=1
timeout --signal=TERM --kill-after=5s 180s node node_modules/vitest/vitest.mjs run src/features/audits/worker/linux-acceptance.test.ts --maxWorkers=1
