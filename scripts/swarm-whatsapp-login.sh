#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${SWARM_CONFIG_PATH:-$ROOT_DIR/swarm/agents.json}"
AGENT_ID="${1:-}"
ACCOUNT="${2:-}"
cd "$ROOT_DIR"

if [ -z "$AGENT_ID" ]; then
  echo "usage: $0 <agent_id> [account]"
  exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
  echo "missing config: $CONFIG_PATH"
  exit 1
fi

if [ -z "$ACCOUNT" ]; then
  ACCOUNT="$(node - "$CONFIG_PATH" "$AGENT_ID" <<'NODE'
const { loadSwarmConfig } = require('./scripts/swarm-utils.cjs');
const cfg = loadSwarmConfig(process.argv[2]);
const id = process.argv[3];
const a = cfg.agents.find((x) => x.id === id);
if (!a) {
  process.exit(2);
}
process.stdout.write(a.whatsapp.account || id);
NODE
)"
fi

CONTAINER_NAME="openclaw-${AGENT_ID}-gateway"
if ! docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "container not running: $CONTAINER_NAME"
  echo "run ./scripts/swarm-up.sh first"
  exit 1
fi

echo "starting whatsapp login for agent=$AGENT_ID account=$ACCOUNT"
docker exec -it "$CONTAINER_NAME" node dist/index.js channels login --channel whatsapp --account "$ACCOUNT"
