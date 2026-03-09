import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { addRunLog } from './db.js';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const swarmConfigPath = path.join(rootDir, 'swarm', 'agents.json');

function loadSwarmConfig() {
  const raw = fs.readFileSync(swarmConfigPath, 'utf8');
  return JSON.parse(raw);
}

function getAgents() {
  const config = loadSwarmConfig();
  return config.agents || [];
}

function getAgentById(agentId) {
  return getAgents().find((a) => a.id === agentId) || null;
}

function getContainerName(agentId) {
  return `openclaw-${agentId}-gateway`;
}

async function runCommand(action, cmd, args = []) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: rootDir,
      maxBuffer: 10 * 1024 * 1024
    });
    const output = `${stdout || ''}${stderr || ''}`.trim();
    addRunLog(action, 'ok', output || '(no output)');
    return { ok: true, output };
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`.trim();
    addRunLog(action, 'error', output || 'unknown error');
    return { ok: false, output };
  }
}

function extractMentions(text, knownAgentIds) {
  const matches = [...text.matchAll(/@([a-z0-9-]+)/g)].map((m) => m[1]);
  const dedup = [...new Set(matches)];
  return dedup.filter((id) => knownAgentIds.includes(id));
}

async function runAgentTurn(agentId, message) {
  const containerName = getContainerName(agentId);
  const args = [
    'exec',
    '-e',
    'NODE_NO_WARNINGS=1',
    containerName,
    'node',
    'dist/index.js',
    'agent',
    '--agent',
    'main',
    '--message',
    message
  ];

  return runCommand(`agent.turn.${agentId}`, 'docker', args);
}

async function checkAgentStatus(agent) {
  const containerName = getContainerName(agent.id);
  let status = 'missing';
  let health = 'unknown';

  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['inspect', '-f', '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', containerName],
      { cwd: rootDir }
    );
    const [s, h] = String(stdout).trim().split('|');
    status = s || 'unknown';
    health = h || 'unknown';
  } catch {
    status = 'missing';
    health = 'missing';
  }

  let endpoint = 'down';
  try {
    const res = await fetch(`http://127.0.0.1:${agent.ports.gateway}/healthz`);
    endpoint = res.ok ? 'live' : `http_${res.status}`;
  } catch {
    endpoint = 'down';
  }

  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    containerName,
    gatewayPort: agent.ports.gateway,
    bridgePort: agent.ports.bridge,
    whatsapp: agent.whatsapp,
    status,
    health,
    endpoint
  };
}

async function getDashboardStatus() {
  const agents = getAgents();
  const list = [];
  for (const agent of agents) {
    list.push(await checkAgentStatus(agent));
  }
  return list;
}

function getWorkspaceDir(agentId) {
  return path.join(rootDir, 'data', 'swarm', agentId, 'workspace');
}

function listMarkdownFiles(agentId) {
  const root = getWorkspaceDir(agentId);
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    const abs = path.join(root, rel);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    for (const entry of entries) {
      const nextRel = path.join(rel, entry.name);
      const nextAbs = path.join(root, nextRel);
      if (entry.isDirectory()) {
        stack.push(nextRel);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(nextRel.replaceAll('\\', '/'));
      }
    }
  }
  files.sort();
  return files;
}

function safeResolveWorkspaceFile(agentId, relPath) {
  const workspace = getWorkspaceDir(agentId);
  const normalized = path.normalize(relPath).replace(/^([/\\])+/, '');
  const abs = path.resolve(workspace, normalized);
  if (!abs.startsWith(path.resolve(workspace))) {
    throw new Error('invalid file path');
  }
  if (!abs.toLowerCase().endsWith('.md')) {
    throw new Error('only markdown files are supported');
  }
  return abs;
}

function readMarkdownFile(agentId, relPath) {
  const abs = safeResolveWorkspaceFile(agentId, relPath);
  if (!fs.existsSync(abs)) {
    return null;
  }
  return fs.readFileSync(abs, 'utf8');
}

function writeMarkdownFile(agentId, relPath, content) {
  const abs = safeResolveWorkspaceFile(agentId, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

async function runSwarmAction(action) {
  if (action === 'up') {
    return runCommand('swarm.up', 'bash', ['./scripts/swarm-up.sh']);
  }
  if (action === 'down') {
    return runCommand('swarm.down', 'bash', ['./scripts/swarm-down.sh']);
  }
  if (action === 'approvePairing') {
    return runCommand('swarm.approvePairing', 'bash', ['./scripts/swarm-approve-pairing.sh']);
  }
  if (action === 'cleanLegacy') {
    return runCommand('swarm.cleanLegacy', 'bash', ['./scripts/swarm-clean-legacy.sh']);
  }
  throw new Error(`unsupported action: ${action}`);
}

export {
  loadSwarmConfig,
  getAgents,
  getAgentById,
  getContainerName,
  extractMentions,
  runAgentTurn,
  getDashboardStatus,
  listMarkdownFiles,
  readMarkdownFile,
  writeMarkdownFile,
  runSwarmAction
};
