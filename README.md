# OpenClaw Swarm Studio

多容器 OpenClaw 蜂群 + 可视化控制台（React）。

你现在有两层能力：
- `swarm/*.json` + `scripts/swarm-*.sh`：管理 5 个独立 OpenClaw 实例
- `Swarm Studio` Web：聊天室、@协作、配置编辑、状态看板、运维设置

## 功能

- 多页面控制台（React）
- Chatroom：@某个 agent 触发回复；agent 回复里 @其他 agent 会继续接力
- Dashboard：查看每个龙虾实例状态（容器/健康/端口/WhatsApp）
- Config：按 agent 编辑任意 `.md`（如 `USER.md`、`SOUL.md`）
- Settings：一键启动/停止蜂群、批准 pairing、清理旧实例、调 relay 参数
- Runs：查看后台执行日志
- SQLite 持久化：会话消息、设置、运行日志

## 数据存储

- 应用数据库：`data/app/studio.db`
- 每个 agent 配置：`data/swarm/<agent_id>/config/openclaw.json`
- 每个 agent 工作区：`data/swarm/<agent_id>/workspace/*.md`
- 共享代码仓库（所有 agent 共用）：容器内默认路径 `/home/node/shared-repo`（宿主机默认映射当前项目根目录）

## 共享宿主仓库协作

- 默认已启用：所有 agent 容器都挂载同一份宿主机仓库，可共同修改代码。
- 若要改成其他宿主机目录，在 `.env` 设置：

```bash
SWARM_SHARED_REPO_PATH=/absolute/path/to/your/repo
```

- 修改后执行 `./scripts/swarm-up.sh` 使挂载生效。

## 启动蜂群（容器层）

```bash
./scripts/swarm-up.sh
```

停止：

```bash
./scripts/swarm-down.sh
```

## 启动 Web 控制台

先安装依赖：

```bash
npm install
```

开发模式（推荐两个终端）：

```bash
# 终端 1
npm run dev:server

# 终端 2
npm run dev:web
```

访问：
- 前端：`http://127.0.0.1:5174`
- 后端 API：`http://127.0.0.1:3099`

生产模式：

```bash
npm run build:web
npm start
```

## 关键页面说明

- Chatroom：
  - 直接输入并 `@main`、`@frontend-developer` 等
  - 不带 @ 时默认派发给 `@main`
  - relay 规则由 settings 的 `relay.maxDepth`、`relay.maxDispatch` 控制

- Config：
  - 先选 agent，再选文件
  - 可新建 `.md`，例如 `SOUL.md`

- Settings：
  - `One-Click Start Swarm`
  - `Approve Pairing`（遇到 `pairing required` 时使用）
  - 每个 agent 的 WhatsApp 登录命令

## WhatsApp

每个 agent 可单独登录：

```bash
./scripts/swarm-whatsapp-login.sh main
./scripts/swarm-whatsapp-login.sh product-manager
./scripts/swarm-whatsapp-login.sh frontend-developer
./scripts/swarm-whatsapp-login.sh backend-developer
./scripts/swarm-whatsapp-login.sh qa-tester
```

若 UI 出现 `pairing required`：

```bash
./scripts/swarm-approve-pairing.sh
```
