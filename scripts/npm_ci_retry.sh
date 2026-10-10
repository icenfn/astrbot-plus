#!/usr/bin/env bash
# Resilient `npm ci` for CI.
#
# Runners occasionally hit transient `ECONNRESET` / read timeouts while talking
# to the npm registry, which previously failed the whole release. This wrapper
# raises npm's own retry/timeout budget and retries the install a few times so a
# single flaky connection no longer aborts the build.
set -uo pipefail

export npm_config_fetch_retries="${npm_config_fetch_retries:-5}"
export npm_config_fetch_retry_mintimeout="${npm_config_fetch_retry_mintimeout:-20000}"
export npm_config_fetch_retry_maxtimeout="${npm_config_fetch_retry_maxtimeout:-120000}"
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-300000}"
export npm_config_maxsockets="${npm_config_maxsockets:-10}"

attempts="${NPM_CI_ATTEMPTS:-5}"

for attempt in $(seq 1 "$attempts"); do
  echo "==> npm ci attempt ${attempt}/${attempts}"
  # `--prefer-offline` uses the restored ~/.npm cache first (setup-node caches it)
  # and only reaches the network for what is missing.
  if npm ci --no-audit --no-fund --prefer-offline; then
    echo "==> npm ci succeeded on attempt ${attempt}"
    exit 0
  fi
  echo "==> npm ci failed on attempt ${attempt}; retrying in 15s..." >&2
  sleep 15
done

echo "==> npm ci failed after ${attempts} attempts" >&2
exit 1
