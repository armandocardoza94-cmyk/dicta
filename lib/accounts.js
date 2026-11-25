"use strict";
/*
 * Cuentas de usuario (acceso con enlace por correo, sin contraseña), preferencias, temas seguidos
 * y notificaciones. Los VOTOS siguen siendo anónimos: aquí no se guarda ninguna respuesta.
 * Requiere Postgres (en modo archivo las cuentas quedan desactivadas).
 */
const crypto = require("crypto");
let pool = null;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const newId = (p) => p + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");

const DEFAULT_PREFS = { emailFreq: "diario", emailConsent: false, lang: "es", triggers: { newPoll: true, debate: true, shift: true, closing: true } };
const DEFAULT_FOLLOWS = { cats: [], keywords: [], polls: [] };

async function init(p) {
  pool = p;
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at BIGINT NOT NULL,
      onboarded BOOLEAN NOT NULL DEFAULT false, prefs JSONB NOT NULL DEFAULT '{}', follows JSONB NOT NULL DEFAULT '{}',
      session_ver INTEGER NOT NULL DEFAULT 1, last_digest BIGINT NOT NULL DEFAULT 0, accepted_version TEXT);
    CREATE TABLE IF NOT EXISTS login_tokens (
      token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at BIGINT NOT NULL, used BOOLEAN NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, poll_id TEXT, data JSONB NOT NULL DEFAULT '{}', created_at BIGINT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false, emailed BOOLEAN NOT NULL DEFAULT false);
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS alert_log (key TEXT PRIMARY KEY, at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS poll_snapshots (poll_id TEXT PRIMARY KEY, tension REAL, leader TEXT, n INTEGER NOT NULL, at BIGINT NOT NULL);
  `);
  return true;
}
const enabled = () => !!pool;

function shapeUser(r) {
  if (!r) return null;
  return {
    id: r.id, email: r.email, createdAt: Number(r.created_at), onboarded: r.onboarded,
    prefs: { ...DEFAULT_PREFS, ...(r.prefs || {}), triggers: { ...DEFAULT_PREFS.triggers, ...((r.prefs || {}).triggers || {}) } },
    follows: { ...DEFAULT_FOLLOWS, ...(r.follows || {}) },
    sessionVer: r.session_ver, lastDigest: Number(r.last_digest), acceptedVersion: r.accepted_version,
  };
}

/* ---------- Enlaces de acceso ---------- */
async function createLoginToken(email, ttlMs = 20 * 60e3) {
  const raw = crypto.randomBytes(32).toString("hex");
  await pool.query("DELETE FROM login_tokens WHERE expires_at < $1", [Date.now()]);
  await pool.query("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES ($1, $2, $3)", [sha(raw), email, Date.now() + ttlMs]);
  return raw;
}
async function consumeLoginToken(raw) {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const r = await pool.query("UPDATE login_tokens SET used = true WHERE token_hash = $1 AND used = false AND expires_at > $2 RETURNING email", [sha(raw), Date.now()]);
  return r.rows[0] ? r.rows[0].email : null;
}

/* ---------- Usuarios ---------- */
async function findOrCreateUser(email, acceptedVersion) {
  const found = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (found.rows[0]) {
    if (acceptedVersion) await pool.query("UPDATE users SET accepted_version = $2 WHERE id = $1", [found.rows[0].id, acceptedVersion]);
    return { user: shapeUser(found.rows[0]), isNew: false };
  }
  const id = newId("u");
  const r = await pool.query(
    "INSERT INTO users (id, email, created_at, prefs, follows, accepted_version) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [id, email, Date.now(), DEFAULT_PREFS, DEFAULT_FOLLOWS, acceptedVersion || null]);
  return { user: shapeUser(r.rows[0]), isNew: true };
}
async function getUser(id) {
  if (!pool || !id) return null;
  const r = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return shapeUser(r.rows[0]);
}
async function updateUser(id, { prefs, follows, onboarded }) {
  const u = await getUser(id); if (!u) return null;
  const p = prefs ? { ...u.prefs, ...prefs, triggers: { ...u.prefs.triggers, ...(prefs.triggers || {}) } } : u.prefs;
  const f = follows ? { ...u.follows, ...follows } : u.follows;
  const r = await pool.query("UPDATE users SET prefs = $2, follows = $3, onboarded = COALESCE($4, onboarded) WHERE id = $1 RETURNING *",
    [id, p, f, typeof onboarded === "boolean" ? onboarded : null]);
  return shapeUser(r.rows[0]);
}
async function setFollowPoll(id, pollId, on) {
  const u = await getUser(id); if (!u) return null;
  const set = new Set(u.follows.polls);
  if (on) set.add(pollId); else set.delete(pollId);
  return updateUser(id, { follows: { polls: [...set].slice(-200) } });
}
async function bumpSession(id) { await pool.query("UPDATE users SET session_ver = session_ver + 1 WHERE id = $1", [id]); }
async function deleteUser(id) { await pool.query("DELETE FROM users WHERE id = $1", [id]); }
async function allUsers() { const r = await pool.query("SELECT * FROM users"); return r.rows.map(shapeUser); }

/* ---------- Notificaciones ---------- */
// Evita repetir la misma alerta: devuelve true solo la primera vez dentro de la ventana.
async function once(key, windowMs) {
  const now = Date.now();
  const r = await pool.query(
    `INSERT INTO alert_log (key, at) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET at = EXCLUDED.at WHERE alert_log.at < $3 RETURNING key`,
    [key, now, now - windowMs]);
  return r.rowCount > 0;
}
async function addNotification(userId, type, pollId, data) {
  const n = { id: newId("n"), userId, type, pollId, data, createdAt: Date.now() };
  await pool.query("INSERT INTO notifications (id, user_id, type, poll_id, data, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [n.id, userId, type, pollId, data, n.createdAt]);
  return n;
}
const shapeN = (r) => ({ id: r.id, type: r.type, pollId: r.poll_id, data: r.data, createdAt: Number(r.created_at), read: r.read });
async function listNotifications(userId, limit = 50) {
  const r = await pool.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2", [userId, limit]);
  return r.rows.map(shapeN);
}
async function unreadCount(userId) {
  const r = await pool.query("SELECT count(*)::int AS c FROM notifications WHERE user_id = $1 AND read = false", [userId]);
  return r.rows[0].c;
}
async function markRead(userId, ids) {
  if (ids === "all") await pool.query("UPDATE notifications SET read = true WHERE user_id = $1", [userId]);
  else if (Array.isArray(ids) && ids.length) await pool.query("UPDATE notifications SET read = true WHERE user_id = $1 AND id = ANY($2)", [userId, ids.slice(0, 200)]);
}
async function pendingEmails(userId, since) {
  const r = await pool.query("SELECT * FROM notifications WHERE user_id = $1 AND emailed = false AND read = false AND created_at > $2 ORDER BY created_at DESC LIMIT 30", [userId, since]);
  return r.rows.map(shapeN);
}
async function markEmailed(ids, userId, digestAt) {
  if (ids.length) await pool.query("UPDATE notifications SET emailed = true WHERE id = ANY($1)", [ids]);
  if (digestAt) await pool.query("UPDATE users SET last_digest = $2 WHERE id = $1", [userId, digestAt]);
}
async function pruneNotifications() {
  await pool.query("DELETE FROM notifications WHERE created_at < $1", [Date.now() - 90 * 864e5]);
  await pool.query("DELETE FROM alert_log WHERE at < $1", [Date.now() - 30 * 864e5]);
}

/* ---------- Instantáneas de resultados (para detectar cambios fuertes) ---------- */
async function getSnapshot(pollId) { const r = await pool.query("SELECT * FROM poll_snapshots WHERE poll_id = $1", [pollId]); return r.rows[0] || null; }
async function saveSnapshot(pollId, tension, leader, n) {
  await pool.query(`INSERT INTO poll_snapshots (poll_id, tension, leader, n, at) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (poll_id) DO UPDATE SET tension = EXCLUDED.tension, leader = EXCLUDED.leader, n = EXCLUDED.n, at = EXCLUDED.at`, [pollId, tension, leader, n, Date.now()]);
}

module.exports = {
  init, enabled, createLoginToken, consumeLoginToken, findOrCreateUser, getUser, updateUser, setFollowPoll,
  bumpSession, deleteUser, allUsers, once, addNotification, listNotifications, unreadCount, markRead,
  pendingEmails, markEmailed, pruneNotifications, getSnapshot, saveSnapshot, DEFAULT_PREFS,
};
