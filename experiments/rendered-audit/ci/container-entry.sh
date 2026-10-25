#!/usr/bin/env bash
set -euo pipefail
umask 077
node /opt/ci/network-check.mjs
# Root filesystem stays read-only. Only disposable tmpfs receives generated files.
mkdir /tmp/run
cp /opt/prototype/dist/*.js /tmp/run/
cp /opt/prototype/package.json /tmp/package.json
ln -s /opt/prototype/node_modules /tmp/node_modules
cd /tmp/run
started=$SECONDS
set +e
timeout --signal=TERM --kill-after=5s 70s node --test --test-concurrency=1 --test-timeout=60000 prototype.test.js
result=$?
set -e
printf 'SUITE_EXIT=%s WALL_SECONDS=%s\n' "$result" "$((SECONDS-started))"
if [[ -f results.json ]]; then cat results.json; fi
for metric in memory.peak memory.events cpu.stat; do
  if [[ -r /sys/fs/cgroup/$metric ]]; then
    printf '\nCGROUP_%s\n' "$metric"
    cat "/sys/fs/cgroup/$metric"
  fi
done
exit "$result"
