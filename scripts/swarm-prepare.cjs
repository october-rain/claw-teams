#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadSwarmConfig, agentDataPaths } = require('./swarm-utils.cjs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, 'utf8');
}

function buildUserPrompt(agent, swarmDefaults) {
  const lines = [];
  lines.push(`# Identity: ${agent.name}`);
  lines.push('');
  lines.push(`- Role: ${agent.role}`);
  lines.push(`- Personality: ${agent.personality}`);
  lines.push('');
  lines.push('## Responsibilities');
  for (const item of agent.responsibilities) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Collaboration Rules');
  lines.push('- Keep answers concise and actionable.');
  lines.push('- Surface assumptions and risks explicitly.');
  lines.push('- Prefer concrete next steps over abstract discussion.');
  lines.push('');
  lines.push('## WhatsApp');
  lines.push(`- Account alias: ${agent.whatsapp.account}`);
  lines.push(`- Enabled: ${String(agent.whatsapp.enabled)}`);
  if (swarmDefaults?.sharedRepo?.enabled) {
    lines.push('');
    lines.push('## Shared Repository');
    lines.push(`- Shared repo mount path in container: ${swarmDefaults.sharedRepo.mountPath}`);
    lines.push('- All agents can edit the same host repository through this path.');
    lines.push('- Before editing, review current files to avoid overwrite conflicts.');
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildOpenClawConfig(swarm, agent) {
  const wa = agent.whatsapp;
  return {
    models: {
      mode: 'merge',
      providers: swarm.defaults.providerConfig
    },
    agents: {
      defaults: {
        model: {
          primary: agent.model
        },
        compaction: {
          mode: 'safeguard'
        }
      },
      list: [
        {
          id: 'main',
          name: 'main',
          identity: {
            name: agent.name
          }
        }
      ]
    },
    commands: {
      native: 'auto',
      nativeSkills: 'auto',
      restart: true,
      ownerDisplay: 'raw'
    },
    channels: {
      whatsapp: {
        enabled: Boolean(wa.enabled),
        dmPolicy: wa.dmPolicy,
        groupPolicy: wa.groupPolicy,
        selfChatMode: Boolean(wa.selfChatMode),
        allowFrom: wa.allowFrom,
        debounceMs: Number(wa.debounceMs),
        mediaMaxMb: Number(wa.mediaMaxMb)
      }
    },
    gateway: {
      mode: 'local',
      controlUi: swarm.defaults.gatewayControlUi
    },
    plugins: {
      entries: {
        whatsapp: {
          enabled: Boolean(wa.enabled)
        }
      }
    }
  };
}

function main() {
  const configPath = process.argv[2] || path.resolve(process.cwd(), 'swarm/agents.json');
  const swarm = loadSwarmConfig(configPath);

  for (const agent of swarm.agents) {
    const paths = agentDataPaths(swarm.projectRoot, swarm.defaults.dataRoot, agent.id);
    ensureDir(paths.configDir);
    ensureDir(paths.workspaceDir);

    writeJson(path.join(paths.configDir, 'openclaw.json'), buildOpenClawConfig(swarm, agent));
    writeJson(path.join(paths.configDir, 'agent.profile.json'), {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      personality: agent.personality,
      responsibilities: agent.responsibilities,
      model: agent.model,
      ports: agent.ports,
      whatsapp: agent.whatsapp
    });
    writeText(path.join(paths.workspaceDir, 'USER.md'), buildUserPrompt(agent, swarm.defaults));
  }

  console.log(`prepared ${swarm.agents.length} agent instances from ${swarm.configPath}`);
}

main();
