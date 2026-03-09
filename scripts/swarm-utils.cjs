const fs = require('fs');
const path = require('path');

const DEFAULT_IMAGE = 'ghcr.io/openclaw/openclaw:latest';
const DEFAULT_MODEL = 'moonshot/kimi-k2.5';

const DEFAULT_PROVIDER_CONFIG = {
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    api: 'openai-completions',
    models: [
      {
        id: 'kimi-k2.5',
        name: 'Kimi K2.5',
        reasoning: false,
        input: ['text', 'image'],
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0
        },
        contextWindow: 250000,
        maxTokens: 8192
      }
    ]
  }
};

const DEFAULT_CONTROL_UI = {
  dangerouslyAllowHostHeaderOriginFallback: true,
  allowInsecureAuth: true
};

const DEFAULT_WHATSAPP = {
  enabled: false,
  account: 'default',
  dmPolicy: 'open',
  groupPolicy: 'open',
  selfChatMode: true,
  allowFrom: ['*'],
  debounceMs: 0,
  mediaMaxMb: 50
};

const DEFAULT_SHARED_REPO = {
  enabled: true,
  hostPath: '.',
  mountPath: '/home/node/shared-repo'
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function merge(base, extra) {
  return Object.assign({}, base, extra || {});
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPort(value) {
  return Number.isInteger(value) && value >= 1024 && value <= 65535;
}

function loadSwarmConfig(configPath) {
  const absPath = path.resolve(configPath);
  assert(fs.existsSync(absPath), `config not found: ${absPath}`);

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    throw new Error(`invalid JSON config: ${absPath} (${err.message})`);
  }

  const defaultsIn = raw.defaults || {};
  const defaults = {
    image: defaultsIn.image || DEFAULT_IMAGE,
    gatewayBind: defaultsIn.gatewayBind || 'lan',
    dataRoot: defaultsIn.dataRoot || './data/swarm',
    defaultModel: defaultsIn.defaultModel || DEFAULT_MODEL,
    providerConfig: defaultsIn.providerConfig || deepClone(DEFAULT_PROVIDER_CONFIG),
    gatewayControlUi: merge(DEFAULT_CONTROL_UI, defaultsIn.gatewayControlUi),
    whatsapp: merge(DEFAULT_WHATSAPP, defaultsIn.whatsapp),
    sharedRepo: merge(DEFAULT_SHARED_REPO, defaultsIn.sharedRepo)
  };
  defaults.sharedRepo.hostPath = String(defaults.sharedRepo.hostPath || '.').trim() || '.';
  defaults.sharedRepo.mountPath = String(defaults.sharedRepo.mountPath || DEFAULT_SHARED_REPO.mountPath).trim() || DEFAULT_SHARED_REPO.mountPath;
  assert(defaults.sharedRepo.mountPath.startsWith('/'), 'defaults.sharedRepo.mountPath must be an absolute container path');

  assert(Array.isArray(raw.agents) && raw.agents.length > 0, 'agents must be a non-empty array');

  const usedIds = new Set();
  const usedPorts = new Map();
  const agents = raw.agents.map((agentIn, index) => {
    const id = String(agentIn.id || '').trim();
    assert(id, `agents[${index}].id is required`);
    assert(/^[a-z0-9][a-z0-9-]*$/.test(id), `agents[${index}].id must match ^[a-z0-9][a-z0-9-]*$`);
    assert(!usedIds.has(id), `duplicate agent id: ${id}`);
    usedIds.add(id);

    const name = String(agentIn.name || '').trim();
    assert(name, `agents[${index}].name is required`);

    const role = String(agentIn.role || '').trim();
    assert(role, `agents[${index}].role is required`);

    const personality = String(agentIn.personality || '').trim();
    assert(personality, `agents[${index}].personality is required`);

    const responsibilities = Array.isArray(agentIn.responsibilities)
      ? agentIn.responsibilities.map((x) => String(x).trim()).filter(Boolean)
      : [];
    assert(responsibilities.length > 0, `agents[${index}].responsibilities must be a non-empty array`);

    const ports = agentIn.ports || {};
    const gatewayPort = Number(ports.gateway);
    const bridgePort = Number(ports.bridge);
    assert(isPort(gatewayPort), `agents[${index}].ports.gateway must be 1024-65535`);
    assert(isPort(bridgePort), `agents[${index}].ports.bridge must be 1024-65535`);

    for (const port of [gatewayPort, bridgePort]) {
      if (usedPorts.has(port)) {
        throw new Error(`port conflict: ${port} used by ${usedPorts.get(port)} and ${id}`);
      }
      usedPorts.set(port, id);
    }

    const model = String(agentIn.model || defaults.defaultModel).trim();
    assert(model, `agents[${index}].model cannot be empty`);

    const wa = merge(defaults.whatsapp, agentIn.whatsapp);
    wa.allowFrom = Array.isArray(wa.allowFrom) ? wa.allowFrom : ['*'];
    wa.account = String(wa.account || id).trim() || id;

    return {
      id,
      name,
      role,
      personality,
      responsibilities,
      model,
      ports: { gateway: gatewayPort, bridge: bridgePort },
      whatsapp: wa
    };
  });

  return {
    configPath: absPath,
    projectRoot: path.resolve(path.dirname(absPath), '..'),
    version: raw.version || 1,
    defaults,
    agents
  };
}

function resolveDataRoot(projectRoot, dataRootSetting) {
  return path.isAbsolute(dataRootSetting)
    ? dataRootSetting
    : path.resolve(projectRoot, dataRootSetting.replace(/^\.\//, ''));
}

function agentDataPaths(projectRoot, dataRootSetting, agentId) {
  const dataRootAbs = resolveDataRoot(projectRoot, dataRootSetting);
  const base = path.join(dataRootAbs, agentId);
  return {
    base,
    configDir: path.join(base, 'config'),
    workspaceDir: path.join(base, 'workspace')
  };
}

function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

module.exports = {
  loadSwarmConfig,
  agentDataPaths,
  resolveDataRoot,
  toPosixPath
};
