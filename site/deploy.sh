#!/usr/bin/env bash
# Build the room page and deploy it as the Worker "life-crm-lite" on life-crm-lite.jerryfane.com.
#   site/deploy.sh
# The Cloudflare API goes through the local keyring relay, which injects the real token;
# no token is ever stored or printed here. See cf_proxy.py for the one direct call.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

python3 "$HERE/build.py"

export CLOUDFLARE_API_TOKEN="relay-placeholder"
export CLOUDFLARE_ACCOUNT_ID="20200813b8bac6c06c00ff0a694b5576"
export WRANGLER_SEND_METRICS=false

portfile=$(mktemp)
python3 "$HERE/cf_proxy.py" "$portfile" &
proxy_pid=$!
trap 'kill "$proxy_pid" 2>/dev/null; rm -f "$portfile"' EXIT
for _ in $(seq 50); do
  [[ -s "$portfile" ]] && break
  sleep 0.1
done
[[ -s "$portfile" ]] || { echo "cf_proxy.py did not start" >&2; exit 1; }
CLOUDFLARE_API_BASE_URL="http://127.0.0.1:$(cat "$portfile")/client/v4" wrangler deploy --config "$HERE/wrangler.json"
