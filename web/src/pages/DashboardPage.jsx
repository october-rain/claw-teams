import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function DashboardPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await api.getDashboard();
        if (!alive) return;
        setItems(data.items || []);
      } catch (err) {
        if (alive) setError(err.message);
      }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Swarm Dashboard</h2>
          <p>实时查看每个龙虾实例状态</p>
        </div>
        <div className="status-grid">
          {items.map((it) => (
            <div key={it.id} className="status-card">
              <div className="status-title">{it.name}</div>
              <div className="status-role">@{it.id} · {it.role}</div>
              <div className="status-line"><label>Container</label><span>{it.status}</span></div>
              <div className="status-line"><label>Health</label><span>{it.health}</span></div>
              <div className="status-line"><label>Endpoint</label><span>{it.endpoint}</span></div>
              <div className="status-line"><label>Gateway</label><span>{it.gatewayPort}</span></div>
              <div className="status-line"><label>WhatsApp</label><span>{it.whatsapp?.enabled ? 'on' : 'off'}</span></div>
            </div>
          ))}
        </div>
      </div>
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
