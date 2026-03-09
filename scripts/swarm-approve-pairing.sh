#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

containers=(
  openclaw-main-gateway
  openclaw-product-manager-gateway
  openclaw-frontend-developer-gateway
  openclaw-backend-developer-gateway
  openclaw-qa-tester-gateway
)

for c in "${containers[@]}"; do
  echo "=== $c ==="
  if ! docker ps --format '{{.Names}}' | grep -Fxq "$c"; then
    echo "skip: not running"
    continue
  fi

  json="$(docker exec "$c" node dist/index.js devices list --json 2>/dev/null || echo '{}')"
  ids="$(node -e "const j=JSON.parse(process.argv[1]||'{}'); console.log((j.pending||[]).map(x=>x.requestId).filter(Boolean).join(' '));" "$json")"

  if [ -z "$ids" ]; then
    echo "no pending"
    continue
  fi

  for id in $ids; do
    echo "approve $id"
    docker exec "$c" node dist/index.js devices approve "$id" --json >/dev/null
  done

  after="$(docker exec "$c" node dist/index.js devices list --json 2>/dev/null || echo '{}')"
  node -e "const j=JSON.parse(process.argv[1]||'{}'); console.log('pending='+(j.pending||[]).length+', paired='+(j.paired||[]).length);" "$after"
done
