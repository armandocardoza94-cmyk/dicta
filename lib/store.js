"use strict";
/*
 * Almacenamiento: memoria como fuente de lectura + escritura persistente.
 * - Con DATABASE_URL → Postgres (tablas creadas automáticamente).
 * - Sin DATABASE_URL → archivo JSON en DATA_DIR (por defecto ./data).
 * Pensado para una sola instancia (como el plan de Render).
 */
const fs = require("fs");
const path = require("path");

const polls = new Map();        // id -> poll
const votes = new Map();        // pollId -> Map(voterId -> {value, region, t})
const args = new Map();         // id -> arg
const likes = new Map();        // argId -> Set(voterId)

let pool = null;
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
    `);
    for (const r of (await pool.query("SELECT id, data FROM polls")).rows) polls.set(r.id, { ...r.data, id: r.id });
    for (const r of (await pool.query("SELECT poll_id, voter_id, value, region, updated_at FROM votes")).rows) {
      voteMap(r.poll_id).set(r.voter_id, { value: r.value, region: r.region, t: Number(r.updated_at) });
    }
    for (const r of (await pool.query("SELECT id, poll_id, voter_id, text, stance, created_at FROM args")).rows) {
      args.set(r.id, { id: r.id, pollId: r.poll_id, voterId: r.voter_id, text: r.text, stance: r.stance, createdAt: Number(r.created_at) });
    }
    for (const r of (await pool.query("SELECT arg_id, voter_id FROM arg_likes")).rows) likeSet(r.arg_id).add(r.voter_id);
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      (d.polls || []).forEach((p) => polls.set(p.id, p));
      Object.entries(d.votes || {}).forEach(([pid, m]) => Object.entries(m).forEach(([vid, v]) => voteMap(pid).set(vid, v)));
      (d.args || []).forEach((a) => args.set(a.id, a));
      Object.entries(d.likes || {}).forEach(([aid, arr]) => arr.forEach((v) => likeSet(aid).add(v)));
    }
  }
}

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
}
async function deletePoll(id) {
  if (pool) await pool.query("DELETE FROM polls WHERE id = $1", [id]);
  polls.delete(id);
  votes.delete(id);
  for (const [aid, a] of args) if (a.pollId === id) { args.delete(aid); likes.delete(aid); }
  flushFile();
}
async function saveVote(pid, vid, value, region) {
  const t = Date.now();
  if (pool) await pool.query(
    `INSERT INTO votes (poll_id, voter_id, value, region, updated_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (poll_id, voter_id) DO UPDATE SET value = EXCLUDED.value, region = EXCLUDED.region, updated_at = EXCLUDED.updated_at`,
    [pid, vid, JSON.stringify(value), region, t]);
  voteMap(pid).set(vid, { value, region, t });
  flushFile();
}
async function deleteVote(pid, vid) {
  if (pool) await pool.query("DELETE FROM votes WHERE poll_id = $1 AND voter_id = $2", [pid, vid]);
  voteMap(pid).delete(vid);
  flushFile();
}
async function saveArg(a) {
  if (pool) await pool.query(
    "INSERT INTO args (id, poll_id, voter_id, text, stance, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [a.id, a.pollId, a.voterId, a.text, JSON.stringify(a.stance), a.createdAt]);
  args.set(a.id, a);
  flushFile();
}
async function deleteArg(id) {
  if (pool) await pool.query("DELETE FROM args WHERE id = $1", [id]);
  args.delete(id);
  likes.delete(id);
  flushFile();
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
  for (const a of args.values()) if (a.pollId === p.id) argsCount++;
  return {
    ...pub, closed: isClosed(p), agg: aggregate(p), argsCount,
    ...(vid ? { myVote: mine ? mine.value : null, mine: createdBy === vid } : {}),
  };
}
const allPolls = () => [...polls.values()];
const getPoll = (id) => polls.get(id) || null;
const getPollView = (id, vid) => (polls.has(id) ? view(polls.get(id), vid) : null);
const listPolls = (vid) => allPolls().map((p) => view(p, vid));
const getVote = (pid, vid) => (votes.get(pid) || new Map()).get(vid) || null;
const getArg = (id) => args.get(id) || null;
function listArgs(pid, vid) {
  return [...args.values()].filter((a) => a.pollId === pid).map((a) => {
    const s = likes.get(a.id) || new Set();
    return { id: a.id, text: a.text, stance: a.stance, createdAt: a.createdAt, likes: s.size, liked: s.has(vid), mine: a.voterId === vid };
  }).sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
}
function stats() {
  const voters = new Set();
  let total = 0;
  for (const m of votes.values()) for (const vid of m.keys()) { voters.add(vid); total++; }
  return { polls: polls.size, votes: total, participants: voters.size, args: args.size };
}

module.exports = {
  init, get driver() { return driver; },
  savePoll, deletePoll, saveVote, deleteVote, saveArg, deleteArg, toggleLike,
  allPolls, getPoll, getPollView, listPolls, getVote, getArg, listArgs, stats, isClosed,
};
