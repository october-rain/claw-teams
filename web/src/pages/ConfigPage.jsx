import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ConfigPage() {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [files, setFiles] = useState([]);
  const [filePath, setFilePath] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadFiles = async (id) => {
    const data = await api.getConfigFiles(id);
    const list = data.files || [];
    setFiles(list);
    if (list.length > 0) {
      setFilePath((prev) => (prev && list.includes(prev) ? prev : list[0]));
    } else {
      setFilePath('USER.md');
      setContent('');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getAgents();
        const list = data.agents || [];
        setAgents(list);
        if (list.length > 0) {
          setAgentId(list[0].id);
          await loadFiles(list[0].id);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!agentId || !filePath) return;
    (async () => {
      try {
        const data = await api.getConfigFile(agentId, filePath);
        setContent(data.content || '');
      } catch {
        setContent('');
      }
    })();
  }, [agentId, filePath]);

  const onAgentChange = async (nextId) => {
    setAgentId(nextId);
    setStatus('');
    setError('');
    try {
      await loadFiles(nextId);
    } catch (err) {
      setError(err.message);
    }
  };

  const onSave = async () => {
    if (!agentId || !filePath) return;
    setStatus('saving...');
    setError('');
    try {
      await api.saveConfigFile(agentId, filePath, content);
      setStatus('saved');
      await loadFiles(agentId);
    } catch (err) {
      setStatus('');
      setError(err.message);
    }
  };

  return (
    <div className="page config-page">
      <div className="panel config-sidebar">
        <h3>Agent</h3>
        <select value={agentId} onChange={(e) => onAgentChange(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} (@{a.id})</option>
          ))}
        </select>

        <h3>Markdown Files</h3>
        <div className="file-list">
          {files.map((f) => (
            <button key={f} className={`file-item ${filePath === f ? 'active' : ''}`} onClick={() => setFilePath(f)}>
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            const next = prompt('输入新文件名（例如 SOUL.md）');
            if (next) setFilePath(next.trim());
          }}
        >
          + New MD File
        </button>
      </div>

      <div className="panel config-editor">
        <div className="panel-header">
          <h2>{agentId || '-'} / {filePath || '-'}</h2>
          <button className="primary" onClick={onSave}>Save</button>
        </div>
        <textarea className="editor" value={content} onChange={(e) => setContent(e.target.value)} />
        {status && <div className="hint">{status}</div>}
      </div>

      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
