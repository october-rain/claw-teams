import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';

function stringToHue(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return 190 + (Math.abs(hash) % 50);
}

function MessageItem({ message }) {
  const isMine = message.senderType === 'user';
  const isAgent = message.senderType === 'agent';
  const hue = isAgent ? stringToHue(message.senderId || 'agent') : 205;

  return (
    <div className={`msg-row ${isMine ? 'mine' : 'other'}`}>
      <div className={`msg ${message.senderType} ${isMine ? 'mine' : 'other'}`} style={{ '--agent-hue': hue }}>
        <div className="msg-meta">
          <span>{message.senderType === 'agent' ? `@${message.senderId}` : message.senderType}</span>
          <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <pre className="msg-content">{message.content}</pre>
        {message.mentions?.length > 0 && (
          <div className="mention-row">
            {message.mentions.map((m) => (
              <span key={m} className="mention-chip">@{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [agents, setAgents] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSystemLogs, setShowSystemLogs] = useState(false);
  const [error, setError] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionActive, setMentionActive] = useState(0);
  const textareaRef = useRef(null);

  const mentionHints = useMemo(() => agents.map((a) => `@${a.id}`).join(' '), [agents]);
  const systemLogCount = useMemo(
    () => messages.filter((m) => m.senderType === 'system').length,
    [messages]
  );
  const visibleMessages = useMemo(
    () => messages.filter((m) => showSystemLogs || m.senderType !== 'system'),
    [messages, showSystemLogs]
  );
  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const list = agents.filter((a) => !q || a.id.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [agents, mentionQuery]);

  const closeMention = () => {
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStart(-1);
    setMentionActive(0);
  };

  const syncMentionState = (value, cursor) => {
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex < 0) {
      closeMention();
      return;
    }
    if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) {
      closeMention();
      return;
    }
    const token = beforeCursor.slice(atIndex + 1);
    if (/[\s]/.test(token)) {
      closeMention();
      return;
    }
    setMentionStart(atIndex);
    setMentionCursor(cursor);
    setMentionQuery(token);
    setMentionOpen(true);
    setMentionActive(0);
  };

  const applyMention = (agentId) => {
    if (mentionStart < 0) return;
    const cursor = mentionCursor;
    const text = input;
    const next = `${text.slice(0, mentionStart)}@${agentId} ${text.slice(cursor)}`;
    const nextCursor = mentionStart + agentId.length + 2;
    setInput(next);
    closeMention();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const loadConversations = async () => {
    const data = await api.getConversations();
    let list = data.conversations || [];
    if (list.length === 0) {
      const created = await api.createConversation('Swarm Chat');
      list = [{ id: created.id, title: created.title }];
    }
    setConversations(list);
    if (!conversationId) {
      setConversationId(list[0].id);
    }
  };

  const createConversation = async () => {
    if (creatingConversation) return;
    setCreatingConversation(true);
    setError('');
    try {
      const title = `Swarm Chat ${new Date().toLocaleString()}`;
      const created = await api.createConversation(title);
      await loadConversations();
      setConversationId(created.id);
      setMessages([]);
      setInput('');
      await loadMessages(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingConversation(false);
    }
  };

  const loadMessages = async (cid) => {
    if (!cid) return;
    const data = await api.getMessages(cid);
    setMessages(data.messages || []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [a] = await Promise.all([api.getAgents(), loadConversations()]);
        if (!mounted) return;
        setAgents(a.agents || []);
      } catch (err) {
        if (mounted) setError(err.message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    const tick = async () => {
      try {
        await loadMessages(conversationId);
      } catch (err) {
        if (alive) setError(err.message);
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [conversationId]);

  const onSend = async () => {
    const content = input.trim();
    if (!content || !conversationId || loading) return;
    const prevInput = input;
    setInput('');
    closeMention();
    setLoading(true);
    setError('');
    try {
      await api.sendChat(conversationId, content);
      await loadConversations();
      await loadMessages(conversationId);
    } catch (err) {
      setInput(prevInput);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const appendMention = (agentId) => {
    setInput((prev) => {
      const next = `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${agentId} `;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          const pos = next.length;
          el.setSelectionRange(pos, pos);
        }
      });
      return next;
    });
  };

  const onInputChange = (e) => {
    const next = e.target.value;
    const cursor = e.target.selectionStart ?? next.length;
    setInput(next);
    syncMentionState(next, cursor);
  };

  const onInputKeyDown = async (e) => {
    if (mentionOpen && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActive((idx) => (idx + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActive((idx) => (idx - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        applyMention(mentionCandidates[mentionActive].id);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await onSend();
    }
  };

  return (
    <div className="page chat-page">
      <div className="panel chat-sidebar">
        <div className="chat-sidebar-head">
          <div className="panel-title">Conversations</div>
          <button
            type="button"
            className="primary"
            onClick={createConversation}
            disabled={creatingConversation}
          >
            {creatingConversation ? 'Creating...' : '+ New'}
          </button>
        </div>
        <div className="conversation-list">
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`conversation-item ${conversationId === c.id ? 'active' : ''}`}
              onClick={() => setConversationId(c.id)}
            >
              <div>{c.title}</div>
              <small>{c.last_message ? c.last_message.slice(0, 36) : 'No messages'}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="panel chat-main">
        <div className="panel-header">
          <div>
            <h2>Swarm Chatroom</h2>
            <p>Use mentions to route: {mentionHints || 'loading...'}</p>
          </div>
          <div className="chat-header-actions">
            <button type="button" onClick={() => setShowSystemLogs((v) => !v)}>
              {showSystemLogs ? 'Hide System Logs' : `Show System Logs (${systemLogCount})`}
            </button>
          </div>
        </div>

        <div className="messages">
          {visibleMessages.map((m) => (
            <MessageItem key={m.id} message={m} />
          ))}
        </div>

        <div className="composer">
          <div className="mention-toolbar">
            {agents.map((a) => (
              <button key={a.id} onClick={() => appendMention(a.id)} type="button">
                @{a.id}
              </button>
            ))}
          </div>
          <div className="composer-input-wrap">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={onInputChange}
              onKeyDown={onInputKeyDown}
              onBlur={() => setTimeout(closeMention, 120)}
              onClick={(e) => syncMentionState(e.target.value, e.target.selectionStart ?? 0)}
              placeholder="输入消息，@main 可指挥全队；也可 @frontend-developer @backend-developer ..."
            />
            {mentionOpen && mentionCandidates.length > 0 && (
              <div className="mention-dropdown">
                {mentionCandidates.map((agent, idx) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={`mention-option ${idx === mentionActive ? 'active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMention(agent.id);
                    }}
                  >
                    <span>@{agent.id}</span>
                    <small>{agent.name}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="composer-actions">
            <button className="primary" onClick={onSend} disabled={loading}>
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
