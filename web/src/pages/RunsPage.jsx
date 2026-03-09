import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function RunsPage() {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await api.getRuns();
        if (!alive) return;
        setRuns(data.runs || []);
      } catch (err) {
        if (alive) setError(err.message);
      }
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="page">
      <div className="panel">
        <h2>Run Logs</h2>
        <div className="run-list">
          {runs.map((run) => (
            <div key={run.id} className={`run-item ${run.status}`}>
              <div className="run-head">
                <strong>{run.action}</strong>
                <span>{run.status}</span>
                <small>{new Date(run.createdAt).toLocaleString()}</small>
              </div>
              <pre>{run.output}</pre>
            </div>
          ))}
        </div>
      </div>
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
