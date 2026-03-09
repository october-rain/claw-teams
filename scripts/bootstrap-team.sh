#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSV_PATH="${1:-$ROOT_DIR/teams/team.agents.csv}"
TEMPLATE_DIR="$ROOT_DIR/teams/templates"
WORKSPACE_PREFIX="${TEAM_WORKSPACE_PREFIX:-team}"
FORCE_TEMPLATES="${FORCE_TEMPLATES:-0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "missing .env, run: cp .env.example .env"
  exit 1
fi

if [ ! -f "$CSV_PATH" ]; then
  echo "missing csv: $CSV_PATH"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$ROOT_DIR/.env"
set +a

WORKSPACE_HOST_DIR="${OPENCLAW_WORKSPACE_DIR:-./data/openclaw-1/workspace}"
if [[ "$WORKSPACE_HOST_DIR" != /* ]]; then
  WORKSPACE_HOST_DIR="$ROOT_DIR/${WORKSPACE_HOST_DIR#./}"
fi

MAIN_WORKSPACE_HOST="$WORKSPACE_HOST_DIR"
MAIN_WORKSPACE_CONTAINER="/home/node/.openclaw/workspace"

mkdir -p "$MAIN_WORKSPACE_HOST"

copy_template() {
  local src="$1"
  local dst="$2"
  if [ "$FORCE_TEMPLATES" = "1" ] || [ ! -f "$dst" ]; then
    cp "$src" "$dst"
  fi
}

docker_compose_cli() {
  docker compose run --rm -T openclaw-cli "$@" </dev/null
}

echo "==> writing main agent team playbook"
copy_template "$TEMPLATE_DIR/main-agent-playbook.md" "$MAIN_WORKSPACE_HOST/MAIN_AGENT_PLAYBOOK.md"
copy_template "$TEMPLATE_DIR/team-charter.md" "$MAIN_WORKSPACE_HOST/TEAM_CHARTER.md"

existing_agents_json="$(docker_compose_cli agents list --json)"

echo "==> provisioning sub-agents from: $CSV_PATH"
while IFS=, read -r agent_id display_name role_template model <&3; do
  if [ -z "${agent_id// }" ] || [[ "${agent_id#\#}" != "$agent_id" ]]; then
    continue
  fi

  role_template="${role_template//[$'\r\n']}"
  model="${model//[$'\r\n']}"
  template_src="$TEMPLATE_DIR/roles/$role_template"
  if [ ! -f "$template_src" ]; then
    echo "skip $agent_id: missing template $template_src"
    continue
  fi

  workspace_rel="$WORKSPACE_PREFIX/$agent_id"
  workspace_host="$MAIN_WORKSPACE_HOST/$workspace_rel"
  workspace_container="$MAIN_WORKSPACE_CONTAINER/$workspace_rel"
  mkdir -p "$workspace_host"

  copy_template "$template_src" "$workspace_host/USER.md"
  copy_template "$TEMPLATE_DIR/team-charter.md" "$workspace_host/TEAM_CHARTER.md"

  if echo "$existing_agents_json" | grep -q "\"id\": \"$agent_id\""; then
    echo "agent exists: $agent_id"
  else
    echo "create agent: $agent_id"
    docker_compose_cli agents add "$agent_id" \
      --workspace "$workspace_container" \
      --model "$model" \
      --non-interactive \
      --json >/dev/null
    existing_agents_json="$(docker_compose_cli agents list --json)"
  fi

  docker_compose_cli agents set-identity \
    --agent "$agent_id" \
    --name "$display_name" \
    --json >/dev/null
done 3<"$CSV_PATH"

echo "==> done"
docker_compose_cli agents list
