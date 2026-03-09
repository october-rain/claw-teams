#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_PATH="$ROOT_DIR/docker-compose.swarm.yml"
cd "$ROOT_DIR"

if [ ! -f "$COMPOSE_PATH" ]; then
  echo "missing compose file: $COMPOSE_PATH"
  echo "run ./scripts/swarm-up.sh first"
  exit 1
fi

docker compose -f "$COMPOSE_PATH" down --remove-orphans
