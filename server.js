"use strict";
/*
 * Contradicta — praxis de la opinión.
 * Servidor Express: API REST + eventos en vivo (SSE) + persistencia en Postgres
 * (o en un archivo JSON si no hay DATABASE_URL, útil para desarrollo local).
 */
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require("./lib/store");
const { CATS, TYPES, SEED } = require("./lib/catalog");

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const PROD = process.env.NODE_ENV === "production";
const PUBLIC = path.join(__dirname, "public");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

/* ---------- Seguridad básica ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

/* ---------- Identidad anónima del votante (cookie) ---------- */
function parseCookies(h) {
  const out = {};
  (h || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
app.use((req, res, next) => {
  const c = parseCookies(req.headers.cookie);
  let vid = c.vid;
  if (!vid || !/^[a-f0-9]{32}$/.test(vid)) {
    vid = crypto.randomBytes(16).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `vid=${vid}; Path=/; Max-Age=${60 * 60 * 24 * 730}; HttpOnly; SameSite=Lax${PROD ? "; Secure" : ""}`
    );
  }
  req.vid = vid;
  req.isAdmin = !!ADMIN_TOKEN && req.headers["x-admin-token"] === ADMIN_TOKEN;
  next();
});

/* ---------- Límite de escrituras por votante/IP ---------- */
const buckets = new Map();
function limit(kind, max, perMs) {
  return (req, res, next) => {
    const key = kind + ":" + req.vid + ":" + req.ip;
    const now = Date.now();
    const b = buckets.get(key) || { n: 0, t: now };
    if (now - b.t > perMs) { b.n = 0; b.t = now; }
    b.n++;
    buckets.set(key, b);
    if (b.n > max) return res.status(429).json({ error: "Demasiadas acciones seguidas. Espera un momento." });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 3600e3) buckets.delete(k); }, 600e3).unref();

/* ---------- Eventos en vivo (SSE) ---------- */
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ online: clients.size + 1 })}\n\n`);
  clients.add(res);
  broadcast("online", { online: clients.size });
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => { clearInterval(ping); clients.delete(res); broadcast("online", { online: clients.size }); });
});

/* ---------- Validación ---------- */
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const REGIONS = ["mx", "ext"];
function validValue(p, v) {
  if (p.type === "single") return Number.isInteger(v) && v >= 0 && v < p.options.length;
  if (p.type === "multiple")
    return Array.isArray(v) && v.length > 0 && v.length <= p.options.length &&
      new Set(v).size === v.length && v.every((i) => Number.isInteger(i) && i >= 0 && i < p.options.length);
  if (p.type === "likert") return Number.isInteger(v) && v >= 1 && v <= 5;
  if (p.type === "spectrum") return Number.isInteger(v) && v >= 0 && v <= 10;
  return false;
}
const canManage = (req, p) => req.isAdmin || p.createdBy === req.vid;
const send404 = (res) => res.status(404).json({ error: "Esta encuesta no existe o fue eliminada." });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ error: "Error interno. Inténtalo de nuevo." });
});

/* ---------- API ---------- */
app.get("/healthz", (req, res) => res.json({ ok: true, driver: store.driver }));

app.get("/api/meta", (req, res) => res.json({ cats: CATS, types: TYPES, admin: req.isAdmin }));

app.get("/api/polls", (req, res) => {
  res.json({ polls: store.listPolls(req.vid), stats: store.stats(), online: clients.size });
});

app.get("/api/polls/:id", (req, res) => {
  const p = store.getPollView(req.params.id, req.vid);
  if (!p) return send404(res);
  res.json({ poll: p, args: store.listArgs(req.params.id, req.vid), comments: store.listComments(req.params.id, req.vid), canManage: canManage(req, store.getPoll(req.params.id)) });
});

app.post("/api/polls", limit("create", 8, 3600e3), wrap(async (req, res) => {
  const b = req.body || {};
  const title = str(b.title, 200);
  const type = TYPES[b.type] ? b.type : null;
  const category = CATS.includes(b.category) ? b.category : "Otro";
  if (title.length < 5) return res.status(400).json({ error: "Escribe una pregunta (mínimo 5 caracteres)." });
  if (!type) return res.status(400).json({ error: "Tipo de encuesta no válido." });
  const poll = {
    id: "p" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"),
    title, description: str(b.description, 600), category, type,
    options: [], left: "", right: "", closed: false,
    closesAt: Number.isFinite(b.closesAt) && b.closesAt > Date.now() ? Math.min(b.closesAt, Date.now() + 365 * 864e5) : null,
    createdAt: Date.now(), createdBy: req.vid,
  };
  if (type === "single" || type === "multiple") {
    const opts = (Array.isArray(b.options) ? b.options : []).map((o) => str(o, 140)).filter(Boolean).slice(0, 10);
    if (opts.length < 2) return res.status(400).json({ error: "Añade al menos dos opciones." });
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return res.status(400).json({ error: "Hay opciones repetidas." });
    poll.options = opts;
  }
  if (type === "spectrum") {
    poll.left = str(b.left, 60); poll.right = str(b.right, 60);
    if (!poll.left || !poll.right) return res.status(400).json({ error: "Define ambos polos del espectro." });
  }
  const dup = store.allPolls().find((p) => p.title.toLowerCase() === title.toLowerCase());
  if (dup) return res.status(409).json({ error: "Ya existe una encuesta con esa pregunta.", id: dup.id });
  await store.savePoll(poll);
  broadcast("poll", store.getPollView(poll.id));
  res.status(201).json({ poll: store.getPollView(poll.id, req.vid) });
}));

app.post("/api/polls/:id/vote", limit("vote", 120, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  if (store.isClosed(p)) return res.status(403).json({ error: "La votación está cerrada." });
  const value = req.body && req.body.value;
  if (!validValue(p, value)) return res.status(400).json({ error: "Respuesta no válida." });
  const region = REGIONS.includes(req.body.region) ? req.body.region : null;
  const v = p.type === "multiple" ? [...value].sort((a, b) => a - b) : value;
  await store.saveVote(p.id, req.vid, v, region);
  broadcast("poll", store.getPollView(p.id));
  res.json({ poll: store.getPollView(p.id, req.vid) });
}));

app.delete("/api/polls/:id/vote", limit("vote", 120, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  if (store.isClosed(p)) return res.status(403).json({ error: "La votación está cerrada." });
  await store.deleteVote(p.id, req.vid);
  broadcast("poll", store.getPollView(p.id));
  res.json({ poll: store.getPollView(p.id, req.vid) });
}));

app.patch("/api/polls/:id", limit("manage", 60, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  if (!canManage(req, p)) return res.status(403).json({ error: "Solo quien creó la encuesta puede modificarla." });
  const next = { ...p };
  if (typeof req.body.closed === "boolean") { next.closed = req.body.closed; if (!next.closed) next.closesAt = null; }
  if (req.isAdmin && typeof req.body.featured === "boolean") next.featured = req.body.featured;
  await store.savePoll(next);
  broadcast("poll", store.getPollView(p.id));
  res.json({ poll: store.getPollView(p.id, req.vid) });
}));

app.delete("/api/polls/:id", limit("manage", 60, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  if (!canManage(req, p)) return res.status(403).json({ error: "Solo quien creó la encuesta puede eliminarla." });
  await store.deletePoll(p.id);
  broadcast("deleted", { id: p.id });
  res.json({ ok: true });
}));

/* Argumentos: cada participante puede defender su posición */
app.post("/api/polls/:id/args", limit("arg", 10, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  const text = str(req.body && req.body.text, 400);
  if (text.length < 10) return res.status(400).json({ error: "Desarrolla tu argumento (mínimo 10 caracteres)." });
  const mine = store.getVote(p.id, req.vid);
  if (!mine) return res.status(403).json({ error: "Vota primero para poder argumentar tu posición." });
  const arg = { id: "a" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), pollId: p.id, voterId: req.vid, text, stance: mine.value, createdAt: Date.now() };
  await store.saveArg(arg);
  broadcast("args", { pollId: p.id });
  res.status(201).json({ args: store.listArgs(p.id, req.vid) });
}));

app.post("/api/args/:id/like", limit("like", 200, 600e3), wrap(async (req, res) => {
  const a = store.getArg(req.params.id);
  if (!a) return res.status(404).json({ error: "Argumento no encontrado." });
  await store.toggleLike(a.id, req.vid);
  broadcast("args", { pollId: a.pollId });
  res.json({ args: store.listArgs(a.pollId, req.vid) });
}));

app.delete("/api/args/:id", wrap(async (req, res) => {
  const a = store.getArg(req.params.id);
  if (!a) return res.status(404).json({ error: "Argumento no encontrado." });
  const p = store.getPoll(a.pollId);
  if (!(req.isAdmin || a.voterId === req.vid || (p && p.createdBy === req.vid))) return res.status(403).json({ error: "No puedes eliminar este argumento." });
  await store.deleteArg(a.id);
  broadcast("args", { pollId: a.pollId });
  res.json({ args: store.listArgs(a.pollId, req.vid) });
}));

/* Debate: conversación abierta por pregunta, mensajes de hasta 200 caracteres con respuestas */
const DEBATE_MAX = 200;
app.get("/api/polls/:id/comments", (req, res) => {
  if (!store.getPoll(req.params.id)) return send404(res);
  res.json({ comments: store.listComments(req.params.id, req.vid) });
});
app.post("/api/polls/:id/comments", limit("comment", 20, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  const raw = typeof (req.body && req.body.text) === "string" ? req.body.text.trim() : "";
  if (raw.length < 2) return res.status(400).json({ error: "Escribe tu mensaje." });
  if ([...raw].length > DEBATE_MAX) return res.status(400).json({ error: `Máximo ${DEBATE_MAX} caracteres.` });
  let parentId = null;
  if (req.body.parentId) {
    const parent = store.getComment(String(req.body.parentId));
    if (!parent || parent.pollId !== p.id) return res.status(400).json({ error: "El mensaje al que respondes ya no existe." });
    parentId = parent.parentId || parent.id; // un solo nivel de respuestas
  }
  const mine = store.getVote(p.id, req.vid);
  const c = { id: "c" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), pollId: p.id, parentId, voterId: req.vid, text: raw, stance: mine ? mine.value : null, createdAt: Date.now() };
  await store.saveComment(c);
  broadcast("comments", { pollId: p.id });
  broadcast("poll", store.getPollView(p.id));
  res.status(201).json({ comments: store.listComments(p.id, req.vid) });
}));
app.delete("/api/comments/:id", wrap(async (req, res) => {
  const c = store.getComment(req.params.id);
  if (!c) return res.status(404).json({ error: "Mensaje no encontrado." });
  const p = store.getPoll(c.pollId);
  if (!(req.isAdmin || c.voterId === req.vid || (p && p.createdBy === req.vid))) return res.status(403).json({ error: "No puedes eliminar este mensaje." });
  await store.deleteComment(c.id);
  broadcast("comments", { pollId: c.pollId });
  broadcast("poll", store.getPollView(c.pollId));
  res.json({ comments: store.listComments(c.pollId, req.vid) });
}));

/* Exportar resultados agregados (sin datos personales) */
app.get("/api/polls/:id/export.csv", (req, res) => {
  const p = store.getPollView(req.params.id);
  if (!p) return send404(res);
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const labels = p.type === "single" || p.type === "multiple" ? p.options
    : p.type === "likert" ? ["Totalmente en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Totalmente de acuerdo"]
    : Array.from({ length: 11 }, (_, i) => String(i) + (i === 0 ? ` (${p.left})` : i === 10 ? ` (${p.right})` : ""));
  const rows = [["respuesta", "votos_total", "porcentaje", "votos_mexico", "votos_extranjero"].join(",")];
  labels.forEach((l, i) => {
    const c = p.agg.counts[i] || 0;
    rows.push([q(l), c, p.agg.n ? ((c / p.agg.n) * 100).toFixed(2) : "0.00", p.agg.byRegion.mx[i] || 0, p.agg.byRegion.ext[i] || 0].join(","));
  });
  rows.push(["participantes", p.agg.n, "", p.agg.regionN.mx, p.agg.regionN.ext].join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="contradicta-${p.id}.csv"`);
  res.send("﻿" + rows.join("\n"));
});

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

/* ---------- Frontend ---------- */
const indexHtml = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function page(title, desc) {
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escHtml(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${escHtml(desc)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${escHtml(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${escHtml(desc)}`);
}
// Enlaces compartibles con vista previa (Open Graph) por encuesta
app.get("/p/:id", (req, res) => {
  const p = store.getPollView(req.params.id);
  if (!p) return res.redirect("/");
  res.type("html").send(page(`${p.title} · Contradicta`, `${p.agg.n} votos · tensión ${p.agg.tension == null ? "—" : Math.round(p.agg.tension * 100)}/100. Toma posición en Contradicta.`));
});
app.use(express.static(PUBLIC, { index: false, maxAge: PROD ? "1h" : 0 }));
app.get("*", (req, res) => res.type("html").send(indexHtml));

/* ---------- Arranque ---------- */
(async () => {
  await store.init();
  if (store.allPolls().length === 0) {
    for (const s of SEED) await store.savePoll({ ...s, createdBy: "seed" });
    console.log(`Sembradas ${SEED.length} encuestas iniciales.`);
  }
  // Cierre automático de encuestas con fecha límite
  setInterval(() => {
    for (const p of store.allPolls()) if (!p.closed && p.closesAt && p.closesAt <= Date.now()) {
      store.savePoll({ ...p, closed: true }).then(() => broadcast("poll", store.getPollView(p.id))).catch(console.error);
    }
  }, 30e3).unref();
  app.listen(PORT, () => console.log(`Contradicta escuchando en :${PORT} (almacenamiento: ${store.driver})`));
})().catch((e) => { console.error("No se pudo iniciar:", e); process.exit(1); });
