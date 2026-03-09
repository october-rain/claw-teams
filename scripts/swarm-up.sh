#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${1:-$ROOT_DIR/swarm/agents.json}"
COMPOSE_PATH="$ROOT_DIR/docker-compose.swarm.yml"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "missing .env, run: cp .env.example .env"
  exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
  echo "missing config: $CONFIG_PATH"
  exit 1
fi

node "$ROOT_DIR/scripts/swarm-prepare.cjs" "$CONFIG_PATH"
node "$ROOT_DIR/scripts/swarm-render.cjs" "$CONFIG_PATH" "$COMPOSE_PATH"

docker compose -f "$COMPOSE_PATH" up -d --remove-orphans

node - "$CONFIG_PATH" <<'NODE'
const { loadSwarmConfig } = require('./scripts/swarm-utils.cjs');
const cfg = loadSwarmConfig(process.argv[2]);
console.log('\nSwarm is up:');
for (const agent of cfg.agents) {
  console.log(`- ${agent.id.padEnd(20)} gateway=http://127.0.0.1:${agent.ports.gateway} bridge=http://127.0.0.1:${agent.ports.bridge} whatsapp=${agent.whatsapp.enabled ? 'on' : 'off'}`);
}
NODE
