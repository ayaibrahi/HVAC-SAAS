#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_OS:-}" == Linux && "${GITHUB_RUN_ATTEMPT:-}" == 1 ]]
name="scanvoro-pg-fixture-${GITHUB_RUN_ID:?}"
image='postgres:17.11-bookworm@sha256:2cd2c0f809604aaeff6f0ec8f40aecbd025613107561015c69369a1a7f1d3416'
created=false
cleanup() {
  if [[ "$created" == true ]]; then
    docker rm -f -v "$name" >/dev/null
    if docker inspect "$name" >/dev/null 2>&1; then echo 'POSTGRES_CLEANUP_FAIL'; return 1; fi
    echo 'POSTGRES_CLEANUP_PASS'
  fi
}
trap cleanup EXIT
# Retrieve only the digest-pinned official image; the database itself has no network.
timeout 180s docker pull "$image" >/dev/null
# The database has no published port, external network, bind mount or real data.
docker create --name "$name" --network none --memory 512m --cpus 1 --pids-limit 128 \
  -e POSTGRES_PASSWORD=synthetic-fixture-only "$image" >/dev/null
created=true
docker inspect "$name" | python3 -c 'import json,sys; c=json.load(sys.stdin)[0]; h=c["HostConfig"]; assert h["NetworkMode"]=="none" and not h["Privileged"] and not h.get("Binds") and not h.get("PortBindings"); assert h["Memory"]==536870912 and h["NanoCpus"]==1000000000 and h["PidsLimit"]==128; print("POSTGRES_BOUNDARY_PASS")'
docker start "$name" >/dev/null
ready=false
for _ in $(seq 1 30); do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
SCANVORO_TEST_CONTAINER="$name" PYTHONDONTWRITEBYTECODE=1 timeout 120s python3 experiments/rendered-audit-db/test_postgres.py
