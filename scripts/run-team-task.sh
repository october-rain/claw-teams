#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK="${1:-}"
REPORT_PATH="${2:-}"
TEAM_BOOTSTRAP="${TEAM_BOOTSTRAP:-1}"
TEAM_MAX_CONTEXT_CHARS="${TEAM_MAX_CONTEXT_CHARS:-6000}"

if [ -z "$TASK" ]; then
  echo "usage: $0 \"<task>\" [report_path]"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "missing .env, run: cp .env.example .env"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$ROOT_DIR/.env"
set +a

CONTAINER_NAME="${OPENCLAW_GATEWAY_CONTAINER_NAME:-openclaw-1-gateway}"

timestamp="$(date +%Y%m%d-%H%M%S)"
if [ -z "$REPORT_PATH" ]; then
  REPORT_PATH="$ROOT_DIR/team-runs/$timestamp.md"
fi
mkdir -p "$(dirname "$REPORT_PATH")"

trim_text() {
  printf "%s" "$1" | head -c "$TEAM_MAX_CONTEXT_CHARS"
}

run_agent() {
  local agent="$1"
  local prompt="$2"
  docker exec -e NODE_NO_WARNINGS=1 "$CONTAINER_NAME" node dist/index.js agent --agent "$agent" --message "$prompt"
}

echo "==> ensure gateway is running"
docker compose up -d openclaw-gateway >/dev/null

if [ "$TEAM_BOOTSTRAP" = "1" ]; then
  echo "==> ensure team agents/workspaces are ready"
  "$ROOT_DIR/scripts/bootstrap-team.sh" >/dev/null
fi

if ! docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "gateway container is not running: $CONTAINER_NAME"
  exit 1
fi

echo "==> product-manager"
pm_prompt=$'你是产品经理。\n请基于下面任务输出：\n1) 目标与用户价值\n2) 范围/非范围\n3) 验收标准（编号）\n4) 里程碑与风险\n\n任务：\n'"$TASK"
pm_reply="$(run_agent "product-manager" "$pm_prompt")"

echo "==> frontend-developer"
fe_prompt=$'你是前端开发。\n请基于任务与产品输出，给出：\n1) 页面/组件方案\n2) 状态管理与接口对接\n3) 实施步骤\n4) 风险与回退\n\n任务：\n'"$TASK"$'\n\n产品经理输出（可能已截断）：\n'"$(trim_text "$pm_reply")"
fe_reply="$(run_agent "frontend-developer" "$fe_prompt")"

echo "==> backend-developer"
be_prompt=$'你是后端开发。\n请基于任务与产品输出，给出：\n1) API设计\n2) 数据模型/迁移\n3) 实施步骤\n4) 风险与回退\n\n任务：\n'"$TASK"$'\n\n产品经理输出（可能已截断）：\n'"$(trim_text "$pm_reply")"
be_reply="$(run_agent "backend-developer" "$be_prompt")"

echo "==> qa-tester"
qa_prompt=$'你是测试工程师。\n请基于以下材料输出：\n1) 测试计划\n2) 用例清单（正向/边界/异常）\n3) 回归范围\n4) 发布建议（Go/No-go）\n\n任务：\n'"$TASK"$'\n\n产品经理输出（可能已截断）：\n'"$(trim_text "$pm_reply")"$'\n\n前端输出（可能已截断）：\n'"$(trim_text "$fe_reply")"$'\n\n后端输出（可能已截断）：\n'"$(trim_text "$be_reply")"
qa_reply="$(run_agent "qa-tester" "$qa_prompt")"

echo "==> main (final synthesis)"
main_prompt=$'你是主Agent，负责最终整合。\n请整合以下角色输出，给出：\n1) 最终执行计划（按先后顺序）\n2) 职责分工矩阵\n3) 关键风险与缓解\n4) 本次迭代完成定义（DoD）\n\n原始任务：\n'"$TASK"$'\n\n[产品经理]\n'"$(trim_text "$pm_reply")"$'\n\n[前端]\n'"$(trim_text "$fe_reply")"$'\n\n[后端]\n'"$(trim_text "$be_reply")"$'\n\n[测试]\n'"$(trim_text "$qa_reply")"
main_reply="$(run_agent "main" "$main_prompt")"

cat > "$REPORT_PATH" <<EOF
# Agent Team Run

- Time: $(date '+%Y-%m-%d %H:%M:%S %z')
- Task: $TASK
- Max Context Chars Per Role: $TEAM_MAX_CONTEXT_CHARS

## Product Manager
$pm_reply

## Frontend Developer
$fe_reply

## Backend Developer
$be_reply

## QA Tester
$qa_reply

## Main Agent (Final)
$main_reply
EOF

echo "==> done"
echo "report: $REPORT_PATH"
echo
echo "===== Main Agent Final ====="
echo "$main_reply"
