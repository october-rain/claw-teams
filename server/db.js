import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const rootDir = process.cwd();
const appDataDir = path.join(rootDir, 'data', 'app');
const dbPath = path.join(appDataDir, 'studio.db');

fs.mkdirSync(appDataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  mentions_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

function nowIso() {
  return new Date().toISOString();
}

function getSetting(key, fallbackValue = null) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  if (!row) {
    return fallbackValue;
  }
  return row.value;
}

function setSetting(key, value) {
  const ts = nowIso();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value), ts);
}

function ensureDefaultSettings() {
  if (getSetting('relay.maxDepth') === null) {
    setSetting('relay.maxDepth', '2');
  }
  if (getSetting('relay.maxDispatch') === null) {
    setSetting('relay.maxDispatch', '10');
  }
  if (getSetting('chat.defaultConversationTitle') === null) {
    setSetting('chat.defaultConversationTitle', 'Swarm Chat');
  }
}

function listSettings() {
  return db.prepare('SELECT key, value, updated_at FROM app_settings ORDER BY key ASC').all();
}

function createConversation(id, title) {
  const ts = nowIso();
  db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, title, ts, ts);
}

function touchConversation(id) {
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(nowIso(), id);
}

function listConversations() {
  return db
    .prepare(`
      SELECT c.*, (
        SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message
      FROM conversations c
      ORDER BY c.updated_at DESC
    `)
    .all();
}

function getConversation(id) {
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) || null;
}

function addMessage({ id, conversationId, senderType, senderId, content, mentions = [], status = 'ok' }) {
  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_type, sender_id, content, mentions_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, conversationId, senderType, senderId, content, JSON.stringify(mentions), status, nowIso());
  touchConversation(conversationId);
}

function listMessages(conversationId, limit = 300) {
  const rows = db
    .prepare(`
      SELECT id, conversation_id AS conversationId, sender_type AS senderType, sender_id AS senderId,
             content, mentions_json AS mentionsJson, status, created_at AS createdAt
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `)
    .all(conversationId, limit);

  return rows.map((row) => ({
    ...row,
    mentions: JSON.parse(row.mentionsJson || '[]')
  }));
}

function addRunLog(action, status, output) {
  db.prepare('INSERT INTO run_logs (action, status, output, created_at) VALUES (?, ?, ?, ?)').run(
    action,
    status,
    output,
    nowIso()
  );
}

function listRunLogs(limit = 200) {
  return db
    .prepare('SELECT id, action, status, output, created_at AS createdAt FROM run_logs ORDER BY id DESC LIMIT ?')
    .all(limit);
}

ensureDefaultSettings();

export {
  db,
  getSetting,
  setSetting,
  listSettings,
  createConversation,
  listConversations,
  getConversation,
  addMessage,
  listMessages,
  addRunLog,
  listRunLogs
};
