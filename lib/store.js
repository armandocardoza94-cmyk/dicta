"use strict";
/*
 * Almacenamiento: memoria como fuente de lectura + escritura persistente.
 * - Con DATABASE_URL → Postgres (tablas creadas automáticamente).
 * - Sin DATABASE_URL → archivo JSON en DATA_DIR (por defecto ./data).
 * Varias instancias (p. ej. la vieja y la nueva durante un despliegue) se mantienen
 * sincronizadas con LISTEN/NOTIFY: cada escritura avisa y las demás recargan esa encuesta.
 */
const fs = require("fs");
const path = require("path");

const polls = new Map();        // id -> poll
const votes = new Map();        // pollId -> Map(voterId -> {value, region, t})
const args = new Map();         // id -> arg
const likes = new Map();        // argId -> Set(voterId)
const comments = new Map();     // id -> comentario de debate {id, pollId, parentId, voterId, text, stance, createdAt, hidden}
const reports = new Map();      // "tipo:id" -> Map(voterId -> {pollId, reason, t})

let pool = null;
let listener = null;
let ready = false;
const pending = new Set();
const INSTANCE = require("crypto").randomBytes(6).toString("hex");
const CHANNEL = "contradicta_changes";
const subscribers = [];
let driver = "file";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "contradicta.json");

/* ---------- Inicialización ---------- */
async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    const url = process.env.DATABASE_URL;
    let host = "";
    try { host = new URL(url).hostname; } catch (_) {}
    const needSsl = process.env.PGSSL === "true" || host.includes(".");
    pool = new Pool({ connectionString: url, ssl: needSsl ? { rejectUnauthorized: false } : false, max: 5 });
    driver = "postgres";
    await pool.query(`
      CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS votes (
        poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        voter_id TEXT NOT NULL, value JSONB NOT NULL, region TEXT, updated_at BIGINT NOT NULL,
        PRIMARY KEY (poll_id, voter_id));
      CREATE TABLE IF NOT EXISTS args (
        id TEXT PRIMARY KEY, poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        voter_id TEXT NOT NULL, text TEXT NOT NULL, stance JSONB, created_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS arg_likes (
        arg_id TEXT NOT NULL REFERENCES args(id) ON DELETE CASCADE, voter_id TEXT NOT NULL,
        PRIMARY KEY (arg_id, voter_id));
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
        voter_id TEXT NOT NULL, text TEXT NOT NULL, stance JSONB, created_at BIGINT NOT NULL);
      ALTER TABLE args ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
      CREATE TABLE IF NOT EXISTS reports (
        target_type TEXT NOT NULL, target_id TEXT NOT NULL,
        poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        voter_id TEXT NOT NULL, reason TEXT, created_at BIGINT NOT NULL,
        PRIMARY KEY (target_type, target_id, voter_id));
    `);
    await listen();
    await loadAll();
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      (d.polls || []).forEach((p) => polls.set(p.id, p));
      Object.entries(d.votes || {}).forEach(([pid, m]) => Object.entries(m).forEach(([vid, v]) => voteMap(pid).set(vid, v)));
      (d.args || []).forEach((a) => args.set(a.id, a));
      Object.entries(d.likes || {}).forEach(([aid, arr]) => arr.forEach((v) => likeSet(aid).add(v)));
      (d.comments || []).forEach((c) => comments.set(c.id, c));
      (d.reports || []).forEach(addReportRow);
    }
  }
}

/* ---------- Sincronización entre instancias (Postgres) ---------- */
const rowArg = (r) => ({ id: r.id, pollId: r.poll_id, voterId: r.voter_id, text: r.text, stance: r.stance, createdAt: Number(r.created_at), hidden: !!r.hidden });
const rowComment = (r) => ({ id: r.id, pollId: r.poll_id, parentId: r.parent_id, voterId: r.voter_id, text: r.text, stance: r.stance, createdAt: Number(r.created_at), hidden: !!r.hidden });

function dropPollLocal(id) {
  polls.delete(id);
  votes.delete(id);
  for (const [aid, a] of args) if (a.pollId === id) { args.delete(aid); likes.delete(aid); }
  for (const [cid, c] of comments) if (c.pollId === id) comments.delete(cid);
  for (const [k, m] of reports) { for (const [v, r] of m) if (r.pollId === id) m.delete(v); if (!m.size) reports.delete(k); }
}
const reportMap = (type, id) => { const k = type + ":" + id; let m = reports.get(k); if (!m) reports.set(k, (m = new Map())); return m; };
const addReportRow = (r) => reportMap(r.target_type, r.target_id).set(r.voter_id, { pollId: r.poll_id, reason: r.reason, t: Number(r.created_at) });
const REPORT_COLS = "target_type, target_id, poll_id, voter_id, reason, created_at";

// Carga completa desde la base de datos (arranque y tras perder la conexión de escucha).
async function loadAll() {
  ready = false;
  const [P, V, A, L, C, R] = await Promise.all([
    pool.query("SELECT id, data FROM polls"),
    pool.query("SELECT poll_id, voter_id, value, region, updated_at FROM votes"),
    pool.query("SELECT id, poll_id, voter_id, text, stance, created_at, hidden FROM args"),
    pool.query("SELECT arg_id, voter_id FROM arg_likes"),
    pool.query("SELECT id, poll_id, parent_id, voter_id, text, stance, created_at, hidden FROM comments"),
    pool.query(`SELECT ${REPORT_COLS} FROM reports`),
  ]);
  polls.clear(); votes.clear(); args.clear(); likes.clear(); comments.clear(); reports.clear();
  for (const r of P.rows) polls.set(r.id, { ...r.data, id: r.id });
  for (const r of V.rows) voteMap(r.poll_id).set(r.voter_id, { value: r.value, region: r.region, t: Number(r.updated_at) });
  for (const r of A.rows) args.set(r.id, rowArg(r));
  for (const r of L.rows) likeSet(r.arg_id).add(r.voter_id);
  for (const r of C.rows) comments.set(r.id, rowComment(r));
  for (const r of R.rows) addReportRow(r);
  ready = true;
  // Cambios avisados mientras cargábamos: recargarlos para no perder ninguno.
  const queued = [...pending]; pending.clear();
  for (const pid of queued) await reloadPoll(pid);
}

// Recarga una encuesta con todos sus votos, argumentos y mensajes.
async function reloadPoll(pid) {
  const [P, V, A, L, C, R] = await Promise.all([
    pool.query("SELECT id, data FROM polls WHERE id = $1", [pid]),
    pool.query("SELECT voter_id, value, region, updated_at FROM votes WHERE poll_id = $1", [pid]),
    pool.query("SELECT id, poll_id, voter_id, text, stance, created_at, hidden FROM args WHERE poll_id = $1", [pid]),
    pool.query("SELECT l.arg_id, l.voter_id FROM arg_likes l JOIN args a ON a.id = l.arg_id WHERE a.poll_id = $1", [pid]),
    pool.query("SELECT id, poll_id, parent_id, voter_id, text, stance, created_at, hidden FROM comments WHERE poll_id = $1", [pid]),
    pool.query(`SELECT ${REPORT_COLS} FROM reports WHERE poll_id = $1`, [pid]),
  ]);
  dropPollLocal(pid);
  if (!P.rows.length) return false;
  polls.set(pid, { ...P.rows[0].data, id: pid });
  const m = voteMap(pid);
  for (const r of V.rows) m.set(r.voter_id, { value: r.value, region: r.region, t: Number(r.updated_at) });
  for (const r of A.rows) args.set(r.id, rowArg(r));
  for (const r of L.rows) likeSet(r.arg_id).add(r.voter_id);
  for (const r of C.rows) comments.set(r.id, rowComment(r));
  for (const r of R.rows) addReportRow(r);
  return true;
}

function emit(evt) { for (const fn of subscribers) { try { fn(evt); } catch (e) { console.error(e); } } }

async function listen() {
  const { Client } = require("pg");
  const c = new Client({ connectionString: pool.options.connectionString, ssl: pool.options.ssl });
  let retried = false;
  const retry = () => {
    if (retried) return; retried = true;
    listener = null;
    try { c.end().catch(() => {}); } catch (_) {}
    console.error("Conexión de sincronización perdida; reintentando…");
    setTimeout(async () => {
      try { await listen(); await loadAll(); emit({ kind: "resync" }); }
      catch (e) { console.error(e); retried = false; retry(); }
    }, 2000);
  };
  c.on("error", retry);
  c.on("end", retry);
  c.on("notification", async (msg) => {
    let n; try { n = JSON.parse(msg.payload); } catch (_) { return; }
    if (!n || n.src === INSTANCE || !n.pid) return;
    if (!ready) { pending.add(n.pid); return; }
    try {
      const exists = await reloadPoll(n.pid);
      emit({ kind: n.kind, pid: n.pid, exists });
    } catch (e) { console.error("No se pudo recargar", n.pid, e.message); }
  });
  await c.connect();
  await c.query(`LISTEN ${CHANNEL}`);
  listener = c;
}

// Avisa a las demás instancias que una encuesta cambió.
async function notify(pid, kind) {
  if (!pool) return;
  try { await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify({ src: INSTANCE, pid, kind })]); }
  catch (e) { console.error("notify falló:", e.message); }
}
const onRemoteChange = (fn) => subscribers.push(fn);

const voteMap = (pid) => { let m = votes.get(pid); if (!m) votes.set(pid, (m = new Map())); return m; };
const likeSet = (aid) => { let s = likes.get(aid); if (!s) likes.set(aid, (s = new Set())); return s; };

let saveTimer = null;
function flushFile() {
  if (pool) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const d = {
      polls: [...polls.values()],
      votes: Object.fromEntries([...votes].map(([pid, m]) => [pid, Object.fromEntries(m)])),
      args: [...args.values()],
      likes: Object.fromEntries([...likes].map(([aid, s]) => [aid, [...s]])),
      comments: [...comments.values()],
      reports: [...reports].flatMap(([k, m]) => { const [type, ...rest] = k.split(":"); return [...m].map(([v, r]) => ({ target_type: type, target_id: rest.join(":"), poll_id: r.pollId, voter_id: v, reason: r.reason, created_at: r.t })); }),
    };
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(d));
    fs.renameSync(tmp, DATA_FILE);
  }, 200);
}

/* ---------- Escrituras ---------- */
async function savePoll(p) {
  const { id, ...data } = p;
  if (pool) await pool.query(
    "INSERT INTO polls (id, data, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
    [id, data, p.createdAt || Date.now()]);
  polls.set(id, { ...p });
  flushFile();
  await notify(id, "poll");
}
async function deletePoll(id) {
  if (pool) await pool.query("DELETE FROM polls WHERE id = $1", [id]);
  dropPollLocal(id);
  flushFile();
  await notify(id, "deleted");
}
async function saveVote(pid, vid, value, region) {
  const t = Date.now();
  if (pool) await pool.query(
    `INSERT INTO votes (poll_id, voter_id, value, region, updated_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (poll_id, voter_id) DO UPDATE SET value = EXCLUDED.value, region = EXCLUDED.region, updated_at = EXCLUDED.updated_at`,
    [pid, vid, JSON.stringify(value), region, t]);
  voteMap(pid).set(vid, { value, region, t });
  flushFile();
  await notify(pid, "poll");
}
async function deleteVote(pid, vid) {
  if (pool) await pool.query("DELETE FROM votes WHERE poll_id = $1 AND voter_id = $2", [pid, vid]);
  voteMap(pid).delete(vid);
  flushFile();
  await notify(pid, "poll");
}
async function saveArg(a) {
  if (pool) await pool.query(
    "INSERT INTO args (id, poll_id, voter_id, text, stance, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [a.id, a.pollId, a.voterId, a.text, JSON.stringify(a.stance), a.createdAt]);
  args.set(a.id, a);
  flushFile();
  await notify(a.pollId, "args");
}
async function deleteArg(id) {
  const a = args.get(id);
  if (pool) await pool.query("DELETE FROM args WHERE id = $1", [id]);
  args.delete(id);
  likes.delete(id);
  flushFile();
  if (a) await notify(a.pollId, "args");
}
async function saveComment(c) {
  if (pool) await pool.query(
    "INSERT INTO comments (id, poll_id, parent_id, voter_id, text, stance, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [c.id, c.pollId, c.parentId, c.voterId, c.text, c.stance === null ? null : JSON.stringify(c.stance), c.createdAt]);
  comments.set(c.id, c);
  flushFile();
  await notify(c.pollId, "comments");
}
async function deleteComment(id) {
  const c0 = comments.get(id);
  if (pool) await pool.query("DELETE FROM comments WHERE id = $1", [id]);
  comments.delete(id);
  for (const [cid, c] of comments) if (c.parentId === id) comments.delete(cid);
  flushFile();
  if (c0) await notify(c0.pollId, "comments");
}
/* ---------- Moderación ---------- */
// Devuelve el objeto reportable: {pollId, hidden} o null.
function target(type, id) {
  if (type === "comment") { const c = comments.get(id); return c ? { pollId: c.pollId, obj: c } : null; }
  if (type === "arg") { const a = args.get(id); return a ? { pollId: a.pollId, obj: a } : null; }
  if (type === "poll") { const p = polls.get(id); return p ? { pollId: p.id, obj: p } : null; }
  return null;
}
const reportCount = (type, id) => (reports.get(type + ":" + id) || new Map()).size;
const hasReported = (type, id, vid) => (reports.get(type + ":" + id) || new Map()).has(vid);
async function addReport(type, id, vid, reason) {
  const t = target(type, id);
  if (!t) return null;
  const now = Date.now();
  if (pool) await pool.query(
    `INSERT INTO reports (${REPORT_COLS}) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
    [type, id, t.pollId, vid, reason || null, now]);
  reportMap(type, id).set(vid, { pollId: t.pollId, reason: reason || null, t: now });
  flushFile();
  await notify(t.pollId, type === "comment" ? "comments" : type === "arg" ? "args" : "poll");
  return reportCount(type, id);
}
async function setHidden(type, id, hidden) {
  const t = target(type, id);
  if (!t) return false;
  if (type === "poll") {
    await savePoll({ ...t.obj, hidden });          // savePoll ya persiste y avisa
    return true;
  }
  const table = type === "comment" ? "comments" : "args";
  if (pool) await pool.query(`UPDATE ${table} SET hidden = $2 WHERE id = $1`, [id, hidden]);
  t.obj.hidden = hidden;
  flushFile();
  await notify(t.pollId, type === "comment" ? "comments" : "args");
  return true;
}
async function clearReports(type, id) {
  const t = target(type, id);
  if (pool) await pool.query("DELETE FROM reports WHERE target_type = $1 AND target_id = $2", [type, id]);
  reports.delete(type + ":" + id);
  flushFile();
  if (t) await notify(t.pollId, type === "comment" ? "comments" : type === "arg" ? "args" : "poll");
}
// Para el panel de moderación: todo lo reportado u oculto.
function listModeration() {
  const items = [];
  const push = (type, id, obj, pollId, text) => {
    const m = reports.get(type + ":" + id) || new Map();
    if (!m.size && !obj.hidden) return;
    const p = polls.get(pollId);
    const reasons = {};
    let last = 0;
    for (const r of m.values()) { const k = r.reason || "otro"; reasons[k] = (reasons[k] || 0) + 1; if (r.t > last) last = r.t; }
    items.push({ type, id, pollId, pollTitle: p ? p.title : "", text, hidden: !!obj.hidden, reports: m.size, reasons, lastReport: last, createdAt: obj.createdAt || 0 });
  };
  for (const c of comments.values()) push("comment", c.id, c, c.pollId, c.text);
  for (const a of args.values()) push("arg", a.id, a, a.pollId, a.text);
  for (const p of polls.values()) push("poll", p.id, p, p.id, p.title + (p.description ? " — " + p.description : ""));
  return items.sort((a, b) => (b.hidden - a.hidden) || (b.reports - a.reports) || (b.lastReport - a.lastReport));
}

async function toggleLike(aid, vid) {
  const s = likeSet(aid);
  if (s.has(vid)) {
    if (pool) await pool.query("DELETE FROM arg_likes WHERE arg_id = $1 AND voter_id = $2", [aid, vid]);
    s.delete(vid);
  } else {
    if (pool) await pool.query("INSERT INTO arg_likes (arg_id, voter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [aid, vid]);
    s.add(vid);
  }
  flushFile();
  const a = args.get(aid); if (a) await notify(a.pollId, "args");
}

/* ---------- Agregados ---------- */
function size(p) {
  if (p.type === "single" || p.type === "multiple") return p.options.length;
  return p.type === "likert" ? 5 : 11;
}
function aggregate(p) {
  const k = size(p);
  const lo = p.type === "likert" ? 1 : 0;
  const counts = new Array(k).fill(0);
  const byRegion = { mx: new Array(k).fill(0), ext: new Array(k).fill(0) };
  const regionN = { mx: 0, ext: 0 };
  const sums = { all: 0, mx: 0, ext: 0 };
  const vals = [];
  let n = 0, last24 = 0;
  const day = Date.now() - 864e5;
  for (const v of (votes.get(p.id) || new Map()).values()) {
    n++;
    if (v.t > day) last24++;
    const r = v.region === "mx" || v.region === "ext" ? v.region : null;
    if (r) regionN[r]++;
    const arr = Array.isArray(v.value) ? v.value : [v.value];
    for (const x of arr) {
      const i = x - (p.type === "single" || p.type === "multiple" ? 0 : lo);
      if (i >= 0 && i < k) { counts[i]++; if (r) byRegion[r][i]++; }
    }
    if (p.type === "likert" || p.type === "spectrum") {
      vals.push(v.value); sums.all += v.value; if (r) sums[r] += v.value;
    }
  }
  let mean = null, sd = null, tension = null;
  const means = { mx: null, ext: null };
  if (p.type === "single" || p.type === "multiple") {
    const tot = counts.reduce((s, x) => s + x, 0);
    if (n >= 2 && k >= 2 && tot > 0) {
      let H = 0;
      for (const c of counts) if (c > 0) { const q = c / tot; H -= q * Math.log(q); }
      tension = H / Math.log(k);
    }
  } else if (vals.length) {
    const hi = p.type === "likert" ? 5 : 10;
    mean = sums.all / vals.length;
    sd = Math.sqrt(vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length);
    if (vals.length >= 2) tension = Math.min(1, sd / ((hi - lo) / 2));
    if (regionN.mx) means.mx = sums.mx / regionN.mx;
    if (regionN.ext) means.ext = sums.ext / regionN.ext;
  }
  return { n, counts, byRegion, regionN, mean, sd, means, tension, last24 };
}

/* ---------- Lecturas ---------- */
const isClosed = (p) => !!p.closed || (!!p.closesAt && p.closesAt <= Date.now());
function view(p, vid) {
  const { createdBy, ...pub } = p;
  const mine = vid ? (votes.get(p.id) || new Map()).get(vid) : null;
  let argsCount = 0;
  for (const a of args.values()) if (a.pollId === p.id && !a.hidden) argsCount++;
  let commentsCount = 0, lastComment = 0;
  for (const c of comments.values()) if (c.pollId === p.id && !c.hidden) { commentsCount++; if (c.createdAt > lastComment) lastComment = c.createdAt; }
  return {
    ...pub, hidden: !!p.hidden, closed: isClosed(p), agg: aggregate(p), argsCount, commentsCount, lastComment,
    debateEndsAt: p.debateStartedAt ? p.debateStartedAt + 24 * 3600e3 : null,
    ...(vid ? { myVote: mine ? mine.value : null, mine: createdBy === vid, reported: hasReported("poll", p.id, vid) } : {}),
  };
}
const allPolls = () => [...polls.values()];
const getPoll = (id) => polls.get(id) || null;
// Las encuestas ocultas por moderación solo las ve quien administra.
const getPollView = (id, vid, admin) => { const p = polls.get(id); return p && (!p.hidden || admin) ? view(p, vid) : null; };
const listPolls = (vid, admin) => allPolls().filter((p) => admin || !p.hidden).map((p) => view(p, vid));
const getVote = (pid, vid) => (votes.get(pid) || new Map()).get(vid) || null;
const getArg = (id) => args.get(id) || null;
function listArgs(pid, vid, admin) {
  return [...args.values()].filter((a) => a.pollId === pid && (admin || !a.hidden)).map((a) => {
    const s = likes.get(a.id) || new Set();
    return { id: a.id, text: a.text, stance: a.stance, createdAt: a.createdAt, likes: s.size, liked: s.has(vid), mine: a.voterId === vid,
      reported: hasReported("arg", a.id, vid), ...(admin ? { hidden: !!a.hidden, reports: reportCount("arg", a.id) } : {}) };
  }).sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
}
const getComment = (id) => comments.get(id) || null;
// Alias anónimo y estable por encuesta: permite seguir quién responde a quién sin exponer la cookie.
const alias = (vid, pid) => "Participante " + require("crypto").createHash("sha256").update(vid + ":" + pid).digest("hex").slice(0, 4).toUpperCase();
function listComments(pid, vid, admin) {
  const all = [...comments.values()].filter((c) => c.pollId === pid);
  // Un mensaje oculto se muestra como "oculto por moderación" (sin texto) para no romper el hilo; quien administra ve el texto.
  const out = (c) => ({ id: c.id, parentId: c.parentId, createdAt: c.createdAt, author: alias(c.voterId, pid), mine: c.voterId === vid,
    reported: hasReported("comment", c.id, vid),
    ...(c.hidden && !admin ? { hidden: true, text: "", stance: null } : { text: c.text, stance: c.stance, hidden: !!c.hidden }),
    ...(admin ? { reports: reportCount("comment", c.id) } : {}) });
  const visibleReplies = (r) => all.filter((c) => c.parentId === r.id && (admin || !c.hidden)).sort((a, b) => a.createdAt - b.createdAt).map(out);
  const roots = all.filter((c) => !c.parentId).sort((a, b) => b.createdAt - a.createdAt);
  return roots.map((r) => ({ ...out(r), replies: visibleReplies(r) }))
    .filter((r) => admin || !r.hidden || r.replies.length);   // un mensaje oculto sin respuestas desaparece
}
function stats() {
  const voters = new Set();
  let total = 0;
  for (const m of votes.values()) for (const vid of m.keys()) { voters.add(vid); total++; }
  return { polls: polls.size, votes: total, participants: voters.size, args: args.size, comments: comments.size };
}

module.exports = {
  init, onRemoteChange, get driver() { return driver; },
  savePoll, deletePoll, saveVote, deleteVote, saveArg, deleteArg, toggleLike, saveComment, deleteComment,
  addReport, setHidden, clearReports, listModeration, reportCount, hasReported, target,
  allPolls, getPoll, getPollView, listPolls, getVote, getArg, listArgs, getComment, listComments, stats, isClosed,
};
