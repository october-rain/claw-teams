import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [links, setLinks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [log, setLog] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [s, a] = await Promise.all([api.getSettings(), api.getAgents()]);
    setLinks(s.tokenLinks || []);
    setAgents(a.agents || []);
    const map = {};
    for (const row of s.settings || []) map[row.key] = row.value;
    setSettings(map);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const runAction = async (action) => {
    setError('');
    setLog(`running ${action}...`);
    try {
      const res = await api.swarmAction(action);
      setLog(res.output || '(done)');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveSetting = async (key, value) => {
    try {
      await api.setSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page settings-page">
      <div className="panel">
        <h2>Swarm Controls</h2>
        <div className="button-row">
          <button className="primary" onClick={() => runAction('up')}>One-Click Start Swarm</button>
          <button onClick={() => runAction('down')}>Stop Swarm</button>
          <button onClick={() => runAction('approvePairing')}>Approve Pairing</button>
          <button onClick={() => runAction('cleanLegacy')}>Clean Legacy</button>
        </div>
        <pre className="log-box">{log}</pre>
      </div>

      <div className="panel">
        <h2>Relay Settings</h2>
        <div className="form-grid">
          <label>
            relay.maxDepth
            <input
              value={settings['relay.maxDepth'] || '2'}
              onChange={(e) => setSettings((p) => ({ ...p, 'relay.maxDepth': e.target.value }))}
              onBlur={(e) => saveSetting('relay.maxDepth', e.target.value)}
            />
          </label>
          <label>
            relay.maxDispatch
            <input
              value={settings['relay.maxDispatch'] || '10'}
              onChange={(e) => setSettings((p) => ({ ...p, 'relay.maxDispatch': e.target.value }))}
              onBlur={(e) => saveSetting('relay.maxDispatch', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2>Gateway Links</h2>
        <div className="link-list">
          {links.map((l) => (
            <a key={l.id} href={l.gatewayUrl} target="_blank" rel="noreferrer">{l.name} (@{l.id})</a>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>WhatsApp Login Commands</h2>
        <div className="code-list">
          {agents.map((a) => (
            <code key={a.id}>./scripts/swarm-whatsapp-login.sh {a.id}</code>
          ))}
        </div>
      </div>

      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
