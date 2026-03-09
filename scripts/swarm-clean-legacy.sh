#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DELETE_DATA="${DELETE_DATA:-1}"
cd "$ROOT_DIR"

# Old single-instance stack
if [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  docker compose down --remove-orphans >/dev/null 2>&1 || true
fi

# Explicit legacy container names
for name in openclaw-1-gateway openclaw-gateway openclaw-cli; do
  docker rm -f "$name" >/dev/null 2>&1 || true
done

if [ "$DELETE_DATA" = "1" ]; then
  rm -rf "$ROOT_DIR/data/openclaw-1" "$ROOT_DIR/data/openclaw-docker-1"
fi

echo "legacy cleanup done (DELETE_DATA=$DELETE_DATA)"
