# OpenClaw Docker + Agent Team

这个仓库提供两部分能力：
- 单实例 OpenClaw（Docker）
- Agent Team（主 Agent + 多子 Agent）模板，可开源复用和自定义

## 1) 准备环境变量

```bash
cp .env.example .env
```

编辑 `.env`：
- `OPENCLAW_GATEWAY_TOKEN`：随机字符串（可用 `openssl rand -hex 32` 生成）
- `MOONSHOT_API_KEY`：你的 Kimi/Moonshot token

## 2) 启动网关

```bash
docker compose up -d openclaw-gateway
```

## 3) 初始化配置（只需一次）

```bash
docker compose run --rm openclaw-cli config set gateway.mode local
docker compose run --rm openclaw-cli config set models.mode merge
docker compose run --rm openclaw-cli config set agents.defaults.model.primary moonshot/kimi-k2.5
docker compose up -d openclaw-gateway
```

## 4) 验证

```bash
docker compose run --rm openclaw-cli models list
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY curl -fsS http://127.0.0.1:18789/healthz
docker compose run --rm openclaw-cli dashboard --no-open
```

预期：
- `models list` 中有 `moonshot/kimi-k2.5`
- `healthz` 返回 `{"ok":true,"status":"live"}`

## 5) 访问

- Gateway API: `http://localhost:18789`
- Dashboard（推荐）：执行 `docker compose run --rm openclaw-cli dashboard --no-open`，打开输出的完整 URL（包含 `#token=...`）
- Bridge（内部通道）：`http://localhost:18790`（不是控制台页面）

说明：
- 如果你把宿主机端口改成非默认值（例如 `28789`），`dashboard --no-open` 可能仍显示容器内默认端口 `18789`。此时请把 URL 里的端口替换成你 `.env` 里的 `OPENCLAW_GATEWAY_PORT`。

## 6) 停止

```bash
docker compose down
```

## 7) 初始化 Agent Team（蜂群）

默认团队角色定义在 `teams/team.agents.csv`，包含：
- 产品经理（product-manager）
- 前端开发（frontend-developer）
- 后端开发（backend-developer）
- 测试（qa-tester）

执行一键初始化：

```bash
chmod +x scripts/bootstrap-team.sh
./scripts/bootstrap-team.sh
```

查看 Agent 列表：

```bash
docker compose run --rm openclaw-cli agents list --json
```

脚本会做这些事：
- 给主 Agent workspace 生成 `MAIN_AGENT_PLAYBOOK.md`、`TEAM_CHARTER.md`
- 为每个子 Agent 创建独立 workspace
- 为每个子 Agent 写入角色 `USER.md`
- 幂等创建 Agent（已存在则跳过）

## 8) 自定义你的蜂群

编辑 `teams/team.agents.csv` 即可：

```csv
# agent_id,name,role_template,model
product-manager,Product Manager,product-manager.md,moonshot/kimi-k2.5
frontend-developer,Frontend Developer,frontend-developer.md,moonshot/kimi-k2.5
backend-developer,Backend Developer,backend-developer.md,moonshot/kimi-k2.5
qa-tester,QA Tester,qa-tester.md,moonshot/kimi-k2.5
```

模板位置：
- 主 Agent 编排模板：`teams/templates/main-agent-playbook.md`
- 团队章程模板：`teams/templates/team-charter.md`
- 角色模板：`teams/templates/roles/*.md`

更多自定义方式见 `teams/README.md`。

## 开源说明

本仓库推荐直接 fork 后按你的业务改模板和 CSV，即可快速创建自己的 Agent Team。
