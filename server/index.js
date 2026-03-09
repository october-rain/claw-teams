import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import {
  addRunLog,
  createConversation,
  getConversation,
  getSetting,
  listConversations,
  listMessages,
  listRunLogs,
  listSettings,
  setSetting
} from './db.js';
import {
  getAgents,
  getAgentById,
  getDashboardStatus,
  listMarkdownFiles,
  readMarkdownFile,
  runAgentTurn,
  runSwarmAction,
  writeMarkdownFile
} from './swarm.js';
import { handleUserMessage } from './chat.js';

const app = express();
const port = Number(process.env.STUDIO_PORT || 3099);
const rootDir = process.cwd();
const webDistDir = path.join(rootDir, 'web', 'dist');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function toTokenLinks() {
  const token = (process.env.OPENCLAW_GATEWAY_TOKEN || '').trim();
  return getAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    gatewayUrl: `http://127.0.0.1:${agent.ports.gateway}${token ? `/#token=${token}` : ''}`
  }));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'swarm-studio', ts: new Date().toISOString() });
});

app.get('/api/agents', asyncHandler(async (_req, res) => {
  const statuses = await getDashboardStatus();
  const agentById = Object.fromEntries(getAgents().map((a) => [a.id, a]));
  const data = statuses.map((s) => ({ ...agentById[s.id], ...s }));
  res.json({ agents: data, links: toTokenLinks() });
}));

app.get('/api/dashboard', asyncHandler(async (_req, res) => {
  const data = await getDashboardStatus();
  res.json({ items: data, updatedAt: new Date().toISOString() });
}));

app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: listConversations() });
});

app.post('/api/conversations', asyncHandler(async (req, res) => {
  const title = String(req.body?.title || getSetting('chat.defaultConversationTitle', 'Swarm Chat')).trim();
  const id = nanoid();
  createConversation(id, title || 'Swarm Chat');
  res.json({ id, title: title || 'Swarm Chat' });
}));

app.get('/api/conversations/:id/messages', asyncHandler(async (req, res) => {
  const conversationId = String(req.params.id || '');
  if (!getConversation(conversationId)) {
    res.status(404).json({ error: 'conversation not found' });
    return;
  }
  res.json({ messages: listMessages(conversationId) });
}));

app.post('/api/chat/send', asyncHandler(async (req, res) => {
  const conversationId = String(req.body?.conversationId || '');
  const content = String(req.body?.content || '');
  await handleUserMessage({ conversationId, content });
  res.json({ ok: true });
}));

app.post('/api/agents/:id/message', asyncHandler(async (req, res) => {
  const agentId = String(req.params.id || '');
  const agent = getAgentById(agentId);
  if (!agent) {
    res.status(404).json({ error: 'agent not found' });
    return;
  }
  const content = String(req.body?.content || '').trim();
  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  const result = await runAgentTurn(agentId, content);
  res.json({ ok: result.ok, output: result.output || '' });
}));

app.get('/api/config/:agentId/files', asyncHandler(async (req, res) => {
  const agentId = String(req.params.agentId || '');
  const agent = getAgentById(agentId);
  if (!agent) {
    res.status(404).json({ error: 'agent not found' });
    return;
  }
  res.json({ files: listMarkdownFiles(agentId) });
}));

app.get('/api/config/:agentId/file', asyncHandler(async (req, res) => {
  const agentId = String(req.params.agentId || '');
  const relPath = String(req.query.path || '');
  const agent = getAgentById(agentId);
  if (!agent) {
    res.status(404).json({ error: 'agent not found' });
    return;
  }
  if (!relPath) {
    res.status(400).json({ error: 'path is required' });
    return;
  }
  const content = readMarkdownFile(agentId, relPath);
  if (content === null) {
    res.status(404).json({ error: 'file not found' });
    return;
  }
  res.json({ path: relPath, content });
}));

app.put('/api/config/:agentId/file', asyncHandler(async (req, res) => {
  const agentId = String(req.params.agentId || '');
  const relPath = String(req.body?.path || '');
  const content = String(req.body?.content || '');
  const agent = getAgentById(agentId);
  if (!agent) {
    res.status(404).json({ error: 'agent not found' });
    return;
  }
  if (!relPath) {
    res.status(400).json({ error: 'path is required' });
    return;
  }
  writeMarkdownFile(agentId, relPath, content);
  addRunLog('config.write', 'ok', `agent=${agentId} path=${relPath}`);
  res.json({ ok: true });
}));

app.get('/api/settings', (_req, res) => {
  res.json({
    settings: listSettings(),
    tokenLinks: toTokenLinks(),
    swarmConfigPath: '/swarm/agents.json'
  });
});

app.put('/api/settings', asyncHandler(async (req, res) => {
  const key = String(req.body?.key || '').trim();
  const value = String(req.body?.value ?? '').trim();
  if (!key) {
    res.status(400).json({ error: 'key is required' });
    return;
  }
  setSetting(key, value);
  res.json({ ok: true });
}));

app.post('/api/swarm/action', asyncHandler(async (req, res) => {
  const action = String(req.body?.action || '');
  const allowed = new Set(['up', 'down', 'approvePairing', 'cleanLegacy']);
  if (!allowed.has(action)) {
    res.status(400).json({ error: 'invalid action' });
    return;
  }
  const result = await runSwarmAction(action);
  res.status(result.ok ? 200 : 500).json(result);
}));

app.post('/api/whatsapp/login-command', asyncHandler(async (req, res) => {
  const agentId = String(req.body?.agentId || '');
  const agent = getAgentById(agentId);
  if (!agent) {
    res.status(404).json({ error: 'agent not found' });
    return;
  }
  res.json({
    command: `./scripts/swarm-whatsapp-login.sh ${agentId}`,
    note: 'Run in terminal for interactive QR login.'
  });
}));

app.get('/api/runs', (_req, res) => {
  res.json({ runs: listRunLogs() });
});

if (fs.existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(webDistDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const message = error?.message || 'internal server error';
  addRunLog('api.error', 'error', message);
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Swarm Studio API listening on http://127.0.0.1:${port}`);
});
