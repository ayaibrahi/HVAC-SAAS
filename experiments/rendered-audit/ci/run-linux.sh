#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_OS:-}" == Linux ]]
[[ "${GITHUB_RUN_ATTEMPT:-}" == 1 ]]
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
image="scanvoro-fixtures:${GITHUB_RUN_ID}"
container="scanvoro-fixtures-${GITHUB_RUN_ID}"
created=false
cleanup() {
  if [[ "$created" == true ]]; then
    docker rm -f "$container" >/dev/null
    if docker container inspect "$container" >/dev/null 2>&1; then
      echo 'CONTAINER_CLEANUP_FAIL'; return 1
    fi
    echo 'CONTAINER_CLEANUP_PASS'
  fi
}
trap cleanup EXIT
printf '%s  %s\n' 'cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849' "$root/ci/seccomp_profile.json" | sha256sum --check --strict
# Prep only: pinned official image and npm packages, bounded by job/build deadlines.
timeout --signal=TERM --kill-after=10s 360s docker build --platform=linux/amd64 --tag "$image" --file "$root/ci/Dockerfile" "$root"
docker create --name "$container" --network none --ipc private --init \
  --user 1000:1000 --read-only --cap-drop ALL \
  --security-opt no-new-privileges=true --security-opt "seccomp=$root/ci/seccomp_profile.json" \
  --memory 2g --memory-swap 2g --cpus 1 --pids-limit 256 --shm-size 256m \
  --ulimit nofile=1024:1024 --ulimit core=0 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=512m,mode=1777 \
  --log-driver local --log-opt max-size=5m --log-opt max-file=1 \
  "$image" >/dev/null
created=true
# Inspect before execution; never fall back to weaker settings.
docker inspect "$container" | python3 -c '
import json,sys
c=json.load(sys.stdin)[0]; h=c["HostConfig"]
assert c["Config"]["User"] == "1000:1000"
assert h["NetworkMode"] == "none" and h["IpcMode"] == "private"
assert h["ReadonlyRootfs"] and not h["Privileged"] and not h.get("Binds")
assert not h.get("PortBindings") and not h.get("Devices")
assert h["CapDrop"] == ["ALL"] and not h.get("CapAdd")
assert h["Memory"] == 2147483648 and h["MemorySwap"] == 2147483648
assert h["NanoCpus"] == 1000000000 and h["PidsLimit"] == 256
assert any(s.startswith("no-new-privileges") for s in h["SecurityOpt"])
assert any(s.startswith("seccomp=") for s in h["SecurityOpt"])
print("CONTAINER_CONFIG_PASS")
'
docker start "$container" >/dev/null
set +e
result=$(timeout --signal=TERM --kill-after=5s 90s docker wait "$container")
wait_status=$?
set -e
docker logs "$container"
docker inspect --format 'OOMKilled={{.State.OOMKilled}} ExitCode={{.State.ExitCode}}' "$container"
[[ "$wait_status" == 0 && "$result" == 0 ]]
