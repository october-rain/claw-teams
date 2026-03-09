const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: JSON_HEADERS,
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  getAgents: () => request('/api/agents'),
  getDashboard: () => request('/api/dashboard'),
  getConversations: () => request('/api/conversations'),
  createConversation: (title) => request('/api/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  getMessages: (conversationId) => request(`/api/conversations/${conversationId}/messages`),
  sendChat: (conversationId, content) => request('/api/chat/send', { method: 'POST', body: JSON.stringify({ conversationId, content }) }),
  getConfigFiles: (agentId) => request(`/api/config/${agentId}/files`),
  getConfigFile: (agentId, filePath) => request(`/api/config/${agentId}/file?path=${encodeURIComponent(filePath)}`),
  saveConfigFile: (agentId, filePath, content) => request(`/api/config/${agentId}/file`, { method: 'PUT', body: JSON.stringify({ path: filePath, content }) }),
  getSettings: () => request('/api/settings'),
  setSetting: (key, value) => request('/api/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  swarmAction: (action) => request('/api/swarm/action', { method: 'POST', body: JSON.stringify({ action }) }),
  getRuns: () => request('/api/runs'),
  getWhatsappLoginCommand: (agentId) => request('/api/whatsapp/login-command', { method: 'POST', body: JSON.stringify({ agentId }) })
};
