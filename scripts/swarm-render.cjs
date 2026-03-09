#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadSwarmConfig, agentDataPaths, toPosixPath } = require('./swarm-utils.cjs');

function q(value) {
  return JSON.stringify(String(value));
}

function relFromRoot(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel === '') {
    return '.';
  }
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function sharedRepoHostPath(root, hostPathSetting) {
  const value = String(hostPathSetting || '.').trim() || '.';
  if (path.isAbsolute(value)) {
    return toPosixPath(value);
  }
  return toPosixPath(relFromRoot(root, path.resolve(root, value.replace(/^\.\//, ''))));
}

function renderService(agent, swarm, root) {
  const paths = agentDataPaths(root, swarm.defaults.dataRoot, agent.id);
  const configRel = toPosixPath(relFromRoot(root, paths.configDir));
  const workspaceRel = toPosixPath(relFromRoot(root, paths.workspaceDir));
  const sharedRepo = swarm.defaults.sharedRepo || {};
  const svc = `${agent.id}-gateway`;
  const container = `openclaw-${agent.id}-gateway`;

  const lines = [];
  lines.push(`  ${svc}:`);
  lines.push(`    image: ${swarm.defaults.image}`);
  lines.push(`    container_name: ${container}`);
  lines.push('    environment:');
  lines.push('      HOME: /home/node');
  lines.push('      TERM: xterm-256color');
  lines.push('      OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN:-}');
  lines.push('      OPENCLAW_ALLOW_INSECURE_PRIVATE_WS: ${OPENCLAW_ALLOW_INSECURE_PRIVATE_WS:-}');
  lines.push('      MOONSHOT_API_KEY: ${MOONSHOT_API_KEY:-}');
  lines.push('      OPENAI_API_KEY: ${OPENAI_API_KEY:-}');
  lines.push('      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}');
  lines.push('      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}');
  lines.push('      GEMINI_API_KEY: ${GEMINI_API_KEY:-}');
  lines.push('      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}');
  lines.push('      CHROME_CDP_URL: ${CHROME_CDP_URL:-}');
  lines.push('      NODE_OPTIONS: ${OPENCLAW_NODE_OPTIONS:---max-old-space-size=384}');
  lines.push('    volumes:');
  lines.push(`      - ${configRel}:/home/node/.openclaw`);
  lines.push(`      - ${workspaceRel}:/home/node/.openclaw/workspace`);
  if (sharedRepo.enabled) {
    const hostPath = sharedRepoHostPath(root, sharedRepo.hostPath);
    lines.push(`      - \${SWARM_SHARED_REPO_PATH:-${hostPath}}:${sharedRepo.mountPath}`);
  }
  lines.push('    ports:');
  lines.push(`      - ${q(`${agent.ports.gateway}:18789`)}`);
  lines.push(`      - ${q(`${agent.ports.bridge}:18790`)}`);
  lines.push('    extra_hosts:');
  lines.push('      - "host.docker.internal:host-gateway"');
  lines.push('    init: true');
  lines.push('    restart: unless-stopped');
  lines.push(
    `    command: ["node", "dist/index.js", "gateway", "--bind", ${q(swarm.defaults.gatewayBind)}, "--port", "18789"]`
  );
  lines.push('    healthcheck:');
  lines.push(
    '      test: ["CMD", "node", "-e", "fetch(\'http://127.0.0.1:18789/healthz\').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]'
  );
  lines.push('      interval: 30s');
  lines.push('      timeout: 5s');
  lines.push('      retries: 5');
  lines.push('      start_period: 20s');
  return lines.join('\n');
}

function main() {
  const configPath = process.argv[2] || path.resolve(process.cwd(), 'swarm/agents.json');
  const outputPath = process.argv[3] || path.resolve(process.cwd(), 'docker-compose.swarm.yml');

  const swarm = loadSwarmConfig(configPath);
  const root = path.resolve(path.dirname(configPath), '..');

  const chunks = [];
  chunks.push('# Generated file. Do not edit manually.');
  chunks.push(`# Source config: ${path.relative(root, swarm.configPath)}`);
  chunks.push('services:');

  for (const agent of swarm.agents) {
    chunks.push(renderService(agent, swarm, root));
  }

  fs.writeFileSync(outputPath, `${chunks.join('\n')}\n`, 'utf8');
  console.log(`generated ${outputPath} for ${swarm.agents.length} agents`);
}

main();
