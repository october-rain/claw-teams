# Agent Team Template

这个目录是一个可复用的 OpenClaw Agent Team 模板。

## 目录结构

- `team.agents.csv`: 团队成员定义
- `templates/main-agent-playbook.md`: 主 Agent 编排规则
- `templates/team-charter.md`: 团队目标和协作协议
- `templates/roles/*.md`: 各角色的 `USER.md` 模板

## 一键初始化

在仓库根目录执行：

```bash
./scripts/bootstrap-team.sh
```

如果你修改了模板并希望覆盖已生成文件：

```bash
FORCE_TEMPLATES=1 ./scripts/bootstrap-team.sh
```

## CSV 字段说明

`team.agents.csv` 每行格式：

```csv
agent_id,name,role_template,model
```

- `agent_id`: 子 Agent 的唯一 ID（建议使用 `kebab-case`）
- `name`: 展示名（用于 identity）
- `role_template`: 对应 `templates/roles/` 下的模板文件名
- `model`: 该 Agent 使用的模型 ID（例如 `moonshot/kimi-k2.5`）

## 自定义角色

1. 在 `templates/roles/` 新增你的角色模板（例如 `designer.md`）。
2. 在 `team.agents.csv` 添加一行：

```csv
designer,Designer,designer.md,moonshot/kimi-k2.5
```

3. 重新执行 `./scripts/bootstrap-team.sh`。

## Workspace 位置

- 主 Agent workspace: `/home/node/.openclaw/workspace`
- 子 Agent workspace: `/home/node/.openclaw/workspace/team/<agent_id>`

在宿主机上对应你 `.env` 的 `OPENCLAW_WORKSPACE_DIR`。
