# OpenClaw Docker（单实例）

本目录用于先启动 1 个 OpenClaw 实例，后续可复制目录扩成多实例。

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

## 多实例扩展方式（后续）

复制本目录为新目录（如 `open-claw-2`），并修改新的 `.env`：
- `OPENCLAW_GATEWAY_CONTAINER_NAME`
- `OPENCLAW_CONFIG_DIR`
- `OPENCLAW_WORKSPACE_DIR`
- `OPENCLAW_GATEWAY_PORT`
- `OPENCLAW_BRIDGE_PORT`
