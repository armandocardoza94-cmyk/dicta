"use strict";
/*
 * Contradicta — praxis de la opinión.
 * Servidor Express: API REST + eventos en vivo (SSE) + persistencia en Postgres
 * (o en un archivo JSON si no hay DATABASE_URL, útil para desarrollo local).
 *
 * Seguridad:
 *  - Cabeceras: CSP, HSTS, nosniff, frame-ancestors.
 *  - Cookie anónima de votante (HttpOnly, Secure, SameSite).
 *  - Límites por votante Y por IP (no se esquivan borrando la cookie).
 *  - Verificación anti-bots con Cloudflare Turnstile (si TURNSTILE_* está configurado).
 *  - Filtro de lenguaje ofensivo y datos personales; reportes con ocultado automático.
 *  - Sesión de administración con cookie firmada (sin contraseña en la URL).
 */
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require("./lib/store");
const moderation = require("./lib/moderation");
const { CATS, TYPES, SEED } = require("./lib/catalog");

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const PROD = process.env.NODE_ENV === "production";
const PUBLIC = path.join(__dirname, "public");
const TURNSTILE_SITEKEY = process.env.TURNSTILE_SITEKEY || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";
const TURNSTILE_ON = !!(TURNSTILE_SITEKEY && TURNSTILE_SECRET);
const SECRET = process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update("contradicta:" + ADMIN_TOKEN + ":" + (process.env.DATABASE_URL || "")).digest("hex");
const REPORT_HIDE_AT = Number(process.env.REPORT_HIDE_AT) || 3;   // reportes de personas distintas para ocultar
const SSE_PER_IP = Number(process.env.SSE_PER_IP) || 8;
// Tras este plazo desde el primer voto, el voto es definitivo: ya no se puede cambiar ni retirar.
const VOTE_LOCK_MS = (Number(process.env.VOTE_LOCK_MINUTES) || 3) * 60e3;
const voteLocked = (v) => !!v && Date.now() > (v.c || v.t) + VOTE_LOCK_MS;
const LOCKED_MSG = "Tu voto ya es definitivo: el plazo para cambiarlo o retirarlo terminó.";

/* ---------- Marco legal ---------- */
// Versión del aviso de privacidad / términos. Cambiarla obliga a pedir de nuevo el consentimiento.
const CONSENT_VERSION = "2026-11-24";
// Datos del responsable (LFPDPPP): se configuran en Render. Si faltan, los documentos muestran "[pendiente]".
const LEGAL = {
  name: process.env.LEGAL_NAME || "", address: process.env.LEGAL_ADDRESS || "",
  email: process.env.LEGAL_EMAIL || "", city: process.env.LEGAL_CITY || "",
};
// Veda electoral (LGIPE art. 213): periodos "inicioISO/finISO" separados por comas. Durante la veda se ocultan
// los resultados de las encuestas de política nacional. Por defecto: elección federal del 6 de junio de 2027
// (3 días previos y hasta el cierre de casillas en todo el país). Verificar fechas con el calendario del INE.
const VEDA = (process.env.VEDA_PERIODS || "2027-06-03T00:00:00-06:00/2027-06-06T20:00:00-06:00")
  .split(",").map((s) => s.trim().split("/")).map(([a, b]) => [Date.parse(a), Date.parse(b)]).filter(([a, b]) => a && b && b > a);
const vedaNow = () => { const t = Date.now(); const v = VEDA.find(([a, b]) => t >= a && t < b); return v ? { active: true, until: v[1] } : { active: false, next: (VEDA.find(([a]) => a > t) || [])[0] || null }; };
const VEDA_CATS = ["Política nacional"];
store.setResultMask((p) => vedaNow().active && (VEDA_CATS.includes(p.category) || !!p.electoral));

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

/* ---------- Cabeceras de seguridad ---------- */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", CSP);
  if (PROD) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

/* ---------- Utilidades de cookies firmadas ---------- */
function parseCookies(h) {
  const out = {};
  (h || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) {} }
  });
  return out;
}
const sign = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("hex");
const safeEq = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
// Token firmado con vencimiento: "<exp>.<firma(scope:dato:exp)>"
const makeToken = (scope, data, ms) => { const exp = Date.now() + ms; return exp + "." + sign(`${scope}:${data}:${exp}`); };
const checkToken = (scope, data, tok) => {
  if (!tok || typeof tok !== "string") return false;
  const [exp, sig] = tok.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEq(sig, sign(`${scope}:${data}:${exp}`));
};
function setCookie(res, name, value, maxAgeSec, sameSite = "Lax") {
  res.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=${sameSite}${PROD ? "; Secure" : ""}`);
}

/* ---------- IP real del cliente ---------- */
// Render está detrás de Cloudflare: CF-Connecting-IP lo fija Cloudflare y no lo puede falsear el cliente.
const clientIp = (req) => String(req.headers["cf-connecting-ip"] || req.ip || "").split(",")[0].trim();

/* ---------- Identidad anónima del votante + sesión de administración ---------- */
app.use((req, res, next) => {
  const c = parseCookies(req.headers.cookie);
  let vid = c.vid;
  if (!vid || !/^[a-f0-9]{32}$/.test(vid)) {
    vid = crypto.randomBytes(16).toString("hex");
    setCookie(res, "vid", vid, 60 * 60 * 24 * 730);
  }
  req.vid = vid;
  req.cookies = c;
  req.clientIp = clientIp(req);
  req.isAdmin = !!ADMIN_TOKEN && checkToken("adm", "admin", c.adm);
  next();
});

/* ---------- Límites por votante y por IP ---------- */
const buckets = new Map();
function hit(key, max, perMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, t: now };
  if (now - b.t > perMs) { b.n = 0; b.t = now; }
  b.n++;
  buckets.set(key, b);
  return b.n <= max;
}
/** maxVid: por votante (cookie); maxIp: por IP, aunque se cambie de cookie. */
function limit(kind, maxVid, maxIp, perMs) {
  return (req, res, next) => {
    const okVid = hit(`${kind}:v:${req.vid}`, maxVid, perMs);
    const okIp = hit(`${kind}:i:${req.clientIp}`, maxIp, perMs);
    if (!okVid || !okIp) return res.status(429).json({ error: "Demasiadas acciones seguidas desde tu conexión. Espera unos minutos." });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 24 * 3600e3) buckets.delete(k); }, 600e3).unref();

/* ---------- Verificación anti-bots (Cloudflare Turnstile) ---------- */
// Tras verificar una vez, el votante recibe una cookie firmada válida 12 h para no repetir el reto en cada acción.
const HUMAN_MS = 12 * 3600e3;
async function verifyTurnstile(token, ip) {
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: String(token), remoteip: ip });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    return !!d.success;
  } catch (e) { console.error("Turnstile:", e.message); return false; }
}
// Antes de votar, crear o publicar: consentimiento expreso vigente (mayoría de edad + aviso de privacidad + términos).
function requireConsent(req, res, next) {
  if (req.isAdmin) return next();
  store.hasConsent(req.vid, CONSENT_VERSION).then((ok) => {
    if (ok) return next();
    res.status(403).json({ error: "Antes de participar, acepta el aviso de privacidad y los términos.", needConsent: true, version: CONSENT_VERSION });
  }).catch((e) => { console.error(e); res.status(500).json({ error: "Error interno. Inténtalo de nuevo." }); });
}
function requireHuman(req, res, next) {
  if (!TURNSTILE_ON || req.isAdmin) return next();
  if (checkToken("human", req.vid, req.cookies.hum)) return next();
  const token = req.body && req.body.turnstile;
  // La respuesta incluye la clave del sitio: así funciona aunque la página se haya abierto antes de activar Turnstile.
  if (!token) return res.status(403).json({ error: "Confirma que eres una persona.", needHuman: true, sitekey: TURNSTILE_SITEKEY });
  verifyTurnstile(token, req.clientIp).then((ok) => {
    if (!ok) return res.status(403).json({ error: "No pudimos verificar que eres una persona. Inténtalo de nuevo.", needHuman: true, sitekey: TURNSTILE_SITEKEY });
    setCookie(res, "hum", makeToken("human", req.vid, HUMAN_MS), HUMAN_MS / 1000);
    next();
  });
}

/* ---------- Eventos en vivo (SSE) ---------- */
const clients = new Set();
const sseByIp = new Map();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
// Difunde el estado público de una encuesta (o su retiro si está oculta/eliminada).
function pushPoll(pid) {
  const v = store.getPollView(pid);
  if (v) broadcast("poll", v); else broadcast("deleted", { id: pid });
}
app.get("/api/stream", (req, res) => {
  const ip = req.clientIp;
  const n = sseByIp.get(ip) || 0;
  if (n >= SSE_PER_IP) return res.status(429).json({ error: "Demasiadas conexiones abiertas desde tu red." });
  sseByIp.set(ip, n + 1);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ online: clients.size + 1 })}\n\n`);
  clients.add(res);
  broadcast("online", { online: clients.size });
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping); clients.delete(res);
    const m = (sseByIp.get(ip) || 1) - 1; if (m <= 0) sseByIp.delete(ip); else sseByIp.set(ip, m);
    broadcast("online", { online: clients.size });
  });
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
// Encuesta visible para quien pregunta (las ocultas solo las ve quien administra).
const visiblePoll = (req, id) => { const p = store.getPoll(id); return p && (!p.hidden || req.isAdmin) ? p : null; };
const send404 = (res) => res.status(404).json({ error: "Esta encuesta no existe o fue eliminada." });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ error: "Error interno. Inténtalo de nuevo." });
});
const newId = (prefix) => prefix + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

/* ---------- API ---------- */
app.get("/healthz", (req, res) => res.json({ ok: true, driver: store.driver }));

app.get("/api/meta", (req, res) => res.json({
  cats: CATS, types: TYPES, admin: req.isAdmin,
  turnstile: TURNSTILE_ON ? TURNSTILE_SITEKEY : null, reportHideAt: REPORT_HIDE_AT, voteLockMs: VOTE_LOCK_MS,
  consentVersion: CONSENT_VERSION, legal: LEGAL, veda: { ...vedaNow(), cats: VEDA_CATS },
}));

/* Consentimiento expreso: las opiniones políticas son datos personales sensibles (LFPDPPP). */
app.get("/api/consent", wrap(async (req, res) => res.json({ version: CONSENT_VERSION, given: await store.hasConsent(req.vid, CONSENT_VERSION) })));
app.post("/api/consent", limit("consent", 20, 60, 600e3), wrap(async (req, res) => {
  const b = req.body || {};
  if (b.version !== CONSENT_VERSION) return res.status(400).json({ error: "El aviso de privacidad cambió. Recarga la página para leer la versión vigente." });
  if (b.adult !== true || b.accept !== true) return res.status(400).json({ error: "Para participar debes confirmar que tienes 18 años o más y aceptar el aviso de privacidad y los términos." });
  await store.saveConsent(req.vid, CONSENT_VERSION);
  res.json({ ok: true, version: CONSENT_VERSION });
}));
/* Derecho de cancelación: borra todo lo asociado a este dispositivo y le asigna un identificador nuevo. */
app.delete("/api/me", limit("forget", 5, 20, 3600e3), wrap(async (req, res) => {
  const r = await store.deleteVoterData(req.vid);
  for (const pid of r.polls) { pushPoll(pid); broadcast("comments", { pollId: pid }); broadcast("args", { pollId: pid }); }
  setCookie(res, "vid", crypto.randomBytes(16).toString("hex"), 60 * 60 * 24 * 730);
  res.append("Set-Cookie", `hum=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${PROD ? "; Secure" : ""}`);
  console.log(`Datos de un dispositivo eliminados a petición (${r.deleted} registros)`);
  res.json({ ok: true, deleted: r.deleted });
}));

app.get("/api/polls", (req, res) => {
  res.json({ polls: store.listPolls(req.vid, req.isAdmin), stats: store.stats(), online: clients.size });
});

app.get("/api/polls/:id", (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  res.json({
    poll: store.getPollView(p.id, req.vid, req.isAdmin),
    args: store.listArgs(p.id, req.vid, req.isAdmin),
    comments: store.listComments(p.id, req.vid, req.isAdmin),
    canManage: canManage(req, p),
  });
});

app.post("/api/polls", limit("create", 8, 15, 3600e3), requireConsent, requireHuman, wrap(async (req, res) => {
  const b = req.body || {};
  const title = str(b.title, 200);
  const type = TYPES[b.type] ? b.type : null;
  const category = CATS.includes(b.category) ? b.category : "Otro";
  if (title.length < 5) return res.status(400).json({ error: "Escribe una pregunta (mínimo 5 caracteres)." });
  if (!type) return res.status(400).json({ error: "Tipo de encuesta no válido." });
  const poll = {
    id: newId("p"),
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
  const bad = moderation.check(poll.title, poll.description, poll.left, poll.right, ...poll.options);
  if (bad) return res.status(400).json({ error: bad });
  // Contradicta no publica encuestas de preferencias electorales (LGIPE art. 213; Reglamento de Elecciones del INE).
  if (b.noElectoral !== true) return res.status(400).json({ error: "Confirma que la pregunta no mide intención de voto por candidaturas, partidos o coaliciones." });
  if (moderation.isElectoral(poll.title, poll.description, ...poll.options)) return res.status(400).json({ error: "Contradicta no publica encuestas de intención de voto ni de preferencias por candidaturas, partidos o coaliciones." });
  const dup = store.allPolls().find((p) => p.title.toLowerCase() === title.toLowerCase());
  if (dup) return res.status(409).json({ error: "Ya existe una encuesta con esa pregunta.", id: dup.hidden ? undefined : dup.id });
  await store.savePoll(poll);
  pushPoll(poll.id);
  res.status(201).json({ poll: store.getPollView(poll.id, req.vid) });
}));

app.post("/api/polls/:id/vote", limit("vote", 120, 300, 600e3), requireConsent, requireHuman, wrap(async (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  if (store.isClosed(p)) return res.status(403).json({ error: "La votación está cerrada." });
  const value = req.body && req.body.value;
  if (!validValue(p, value)) return res.status(400).json({ error: "Respuesta no válida." });
  if (voteLocked(store.getVote(p.id, req.vid))) return res.status(403).json({ error: LOCKED_MSG, locked: true });
  // Por IP: como mucho 40 votantes distintos por encuesta y hora (hogares, oficinas y escuelas comparten IP).
  if (!store.getVote(p.id, req.vid) && !hit(`newvoter:${p.id}:${req.clientIp}`, 40, 3600e3))
    return res.status(429).json({ error: "Se alcanzó el límite de votos desde tu conexión para esta encuesta. Inténtalo más tarde." });
  const region = REGIONS.includes(req.body.region) ? req.body.region : null;
  const v = p.type === "multiple" ? [...value].sort((a, b) => a - b) : value;
  await store.saveVote(p.id, req.vid, v, region);
  pushPoll(p.id);
  res.json({ poll: store.getPollView(p.id, req.vid, req.isAdmin) });
}));

app.delete("/api/polls/:id/vote", limit("vote", 120, 300, 600e3), wrap(async (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  if (store.isClosed(p)) return res.status(403).json({ error: "La votación está cerrada." });
  if (voteLocked(store.getVote(p.id, req.vid))) return res.status(403).json({ error: LOCKED_MSG, locked: true });
  await store.deleteVote(p.id, req.vid);
  pushPoll(p.id);
  res.json({ poll: store.getPollView(p.id, req.vid, req.isAdmin) });
}));

app.patch("/api/polls/:id", limit("manage", 60, 120, 600e3), wrap(async (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  if (!canManage(req, p)) return res.status(403).json({ error: "Solo quien creó la encuesta puede modificarla." });
  const next = { ...p };
  if (typeof req.body.closed === "boolean") { next.closed = req.body.closed; if (!next.closed) next.closesAt = null; }
  if (req.isAdmin && typeof req.body.featured === "boolean") next.featured = req.body.featured;
  await store.savePoll(next);
  pushPoll(p.id);
  res.json({ poll: store.getPollView(p.id, req.vid, req.isAdmin) });
}));

app.delete("/api/polls/:id", limit("manage", 60, 120, 600e3), wrap(async (req, res) => {
  const p = store.getPoll(req.params.id);
  if (!p) return send404(res);
  if (!canManage(req, p)) return res.status(403).json({ error: "Solo quien creó la encuesta puede eliminarla." });
  await store.deletePoll(p.id);
  broadcast("deleted", { id: p.id });
  res.json({ ok: true });
}));

/* Argumentos: cada participante puede defender su posición */
app.post("/api/polls/:id/args", limit("arg", 10, 30, 600e3), requireConsent, requireHuman, wrap(async (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  const text = str(req.body && req.body.text, 400);
  if (text.length < 10) return res.status(400).json({ error: "Desarrolla tu argumento (mínimo 10 caracteres)." });
  const bad = moderation.check(text);
  if (bad) return res.status(400).json({ error: bad });
  const mine = store.getVote(p.id, req.vid);
  if (!mine) return res.status(403).json({ error: "Vota primero para poder argumentar tu posición." });
  const arg = { id: newId("a"), pollId: p.id, voterId: req.vid, text, stance: mine.value, createdAt: Date.now(), hidden: false };
  await store.saveArg(arg);
  broadcast("args", { pollId: p.id });
  pushPoll(p.id);
  res.status(201).json({ args: store.listArgs(p.id, req.vid, req.isAdmin) });
}));

app.post("/api/args/:id/like", limit("like", 200, 400, 600e3), requireConsent, requireHuman, wrap(async (req, res) => {
  const a = store.getArg(req.params.id);
  if (!a || (a.hidden && !req.isAdmin)) return res.status(404).json({ error: "Argumento no encontrado." });
  await store.toggleLike(a.id, req.vid);
  broadcast("args", { pollId: a.pollId });
  res.json({ args: store.listArgs(a.pollId, req.vid, req.isAdmin) });
}));

app.delete("/api/args/:id", limit("manage", 60, 120, 600e3), wrap(async (req, res) => {
  const a = store.getArg(req.params.id);
  if (!a) return res.status(404).json({ error: "Argumento no encontrado." });
  const p = store.getPoll(a.pollId);
  if (!(req.isAdmin || a.voterId === req.vid || (p && p.createdBy === req.vid))) return res.status(403).json({ error: "No puedes eliminar este argumento." });
  await store.deleteArg(a.id);
  broadcast("args", { pollId: a.pollId });
  pushPoll(a.pollId);
  res.json({ args: store.listArgs(a.pollId, req.vid, req.isAdmin) });
}));

/* Debate: conversación abierta por pregunta, mensajes de hasta 200 caracteres con respuestas */
const DEBATE_MAX = 200;
const DEBATE_MS = 24 * 3600e3;
app.get("/api/polls/:id/comments", (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  res.json({ comments: store.listComments(p.id, req.vid, req.isAdmin) });
});
app.post("/api/polls/:id/comments", limit("comment", 20, 60, 600e3), requireConsent, requireHuman, wrap(async (req, res) => {
  const p = visiblePoll(req, req.params.id);
  if (!p) return send404(res);
  // El debate dura 24 h desde su primer mensaje; después queda en solo lectura.
  if (p.debateStartedAt && Date.now() > p.debateStartedAt + DEBATE_MS) return res.status(403).json({ error: "Este debate ya cerró: duró 24 horas." });
  const raw = typeof (req.body && req.body.text) === "string" ? req.body.text.trim() : "";
  if (raw.length < 2) return res.status(400).json({ error: "Escribe tu mensaje." });
  if ([...raw].length > DEBATE_MAX) return res.status(400).json({ error: `Máximo ${DEBATE_MAX} caracteres.` });
  const bad = moderation.check(raw);
  if (bad) return res.status(400).json({ error: bad });
  let parentId = null;
  if (req.body.parentId) {
    const parent = store.getComment(String(req.body.parentId));
    if (!parent || parent.pollId !== p.id || (parent.hidden && !req.isAdmin)) return res.status(400).json({ error: "El mensaje al que respondes ya no está disponible." });
    parentId = parent.parentId || parent.id; // un solo nivel de respuestas
  }
  const mine = store.getVote(p.id, req.vid);
  const c = { id: newId("c"), pollId: p.id, parentId, voterId: req.vid, text: raw, stance: mine ? mine.value : null, createdAt: Date.now(), hidden: false };
  if (!p.debateStartedAt) await store.savePoll({ ...p, debateStartedAt: c.createdAt });
  await store.saveComment(c);
  broadcast("comments", { pollId: p.id });
  pushPoll(p.id);
  res.status(201).json({ comments: store.listComments(p.id, req.vid, req.isAdmin) });
}));
app.delete("/api/comments/:id", limit("manage", 60, 120, 600e3), wrap(async (req, res) => {
  const c = store.getComment(req.params.id);
  if (!c) return res.status(404).json({ error: "Mensaje no encontrado." });
  const p = store.getPoll(c.pollId);
  if (!(req.isAdmin || c.voterId === req.vid || (p && p.createdBy === req.vid))) return res.status(403).json({ error: "No puedes eliminar este mensaje." });
  await store.deleteComment(c.id);
  broadcast("comments", { pollId: c.pollId });
  pushPoll(c.pollId);
  res.json({ comments: store.listComments(c.pollId, req.vid, req.isAdmin) });
}));

/* ---------- Reportes de la comunidad ---------- */
const REPORT_TYPES = ["comment", "arg", "poll"];
const REPORT_REASONS = ["ofensivo", "odio", "violencia_genero", "encuesta_electoral", "spam", "datos_personales", "desinformacion", "otro"];
app.post("/api/report", limit("report", 20, 40, 3600e3), requireConsent, requireHuman, wrap(async (req, res) => {
  const type = REPORT_TYPES.includes(req.body && req.body.type) ? req.body.type : null;
  const id = str(req.body && req.body.id, 40);
  const reason = REPORT_REASONS.includes(req.body && req.body.reason) ? req.body.reason : "otro";
  if (!type || !id) return res.status(400).json({ error: "Reporte no válido." });
  const t = store.target(type, id);
  if (!t || (t.obj.hidden && !req.isAdmin)) return res.status(404).json({ error: "Ese contenido ya no está disponible." });
  if (t.obj.voterId === req.vid || t.obj.createdBy === req.vid) return res.status(400).json({ error: "No puedes reportar tu propio contenido." });
  // Un reporte por conexión y contenido: una sola persona no puede ocultar algo cambiando de cookie.
  const wasNew = !store.hasReported(type, id, req.vid);
  if (wasNew && !hit(`rep:${type}:${id}:${req.clientIp}`, 1, 30 * 864e5)) return res.json({ ok: true, hidden: !!t.obj.hidden });
  const count = await store.addReport(type, id, req.vid, reason);
  let hidden = !!t.obj.hidden;
  if (wasNew && count >= REPORT_HIDE_AT && !hidden) {
    await store.setHidden(type, id, true);
    hidden = true;
    console.log(`Ocultado automáticamente ${type}:${id} tras ${count} reportes`);
  }
  if (type === "comment") broadcast("comments", { pollId: t.pollId });
  if (type === "arg") broadcast("args", { pollId: t.pollId });
  pushPoll(t.pollId);
  res.json({ ok: true, hidden });
}));

/* ---------- Administración ---------- */
const ADMIN_MS = 12 * 3600e3;
app.post("/api/admin/login", limit("login", 5, 5, 15 * 60e3), (req, res) => {
  const token = str(req.body && req.body.token, 200);
  if (!ADMIN_TOKEN) return res.status(503).json({ error: "La administración no está configurada (falta ADMIN_TOKEN)." });
  if (!token || !safeEq(token, ADMIN_TOKEN)) {
    console.warn("Intento de acceso de administración fallido");
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  setCookie(res, "adm", makeToken("adm", "admin", ADMIN_MS), ADMIN_MS / 1000, "Strict");
  res.json({ ok: true });
});
app.post("/api/admin/logout", (req, res) => {
  res.append("Set-Cookie", `adm=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${PROD ? "; Secure" : ""}`);
  res.json({ ok: true });
});
const adminOnly = (req, res, next) => (req.isAdmin ? next() : res.status(401).json({ error: "Inicia sesión como administrador." }));
app.get("/api/admin/moderation", adminOnly, (req, res) => res.json({ items: store.listModeration() }));
app.post("/api/admin/moderate", adminOnly, wrap(async (req, res) => {
  const type = REPORT_TYPES.includes(req.body && req.body.type) ? req.body.type : null;
  const id = str(req.body && req.body.id, 40);
  const action = req.body && req.body.action;
  const t = type && store.target(type, id);
  if (!t) return res.status(404).json({ error: "Contenido no encontrado." });
  if (action === "hide") await store.setHidden(type, id, true);
  else if (action === "restore") { await store.setHidden(type, id, false); await store.clearReports(type, id); }
  else if (action === "dismiss") await store.clearReports(type, id);
  else if (action === "delete") {
    if (type === "comment") await store.deleteComment(id);
    else if (type === "arg") await store.deleteArg(id);
    else { await store.deletePoll(id); broadcast("deleted", { id }); }
  } else return res.status(400).json({ error: "Acción no válida." });
  if (type === "comment") broadcast("comments", { pollId: t.pollId });
  if (type === "arg") broadcast("args", { pollId: t.pollId });
  if (!(type === "poll" && action === "delete")) pushPoll(t.pollId);
  res.json({ items: store.listModeration() });
}));

/* Exportar resultados agregados (sin datos personales) */
app.get("/api/polls/:id/export.csv", (req, res) => {
  const p = store.getPollView(req.params.id);
  if (!p) return send404(res);
  if (p.agg.masked) return res.status(403).json({ error: "Resultados no disponibles durante la veda electoral." });
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
  rows.push([q("aviso"), q("Ejercicio de opinión no probabilístico (participación voluntaria). No es una encuesta por muestreo, no tiene margen de error y no representa a ninguna población. No debe usarse para inferir preferencias electorales."), "", "", ""].join(","));
  rows.push([q("fuente"), q(`Contradicta · ${new Date().toISOString().slice(0, 10)} · ${PUBLIC_URL || ""}/p/${p.id}`), "", "", ""].join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="contradicta-${p.id}.csv"`);
  res.send(String.fromCharCode(0xfeff) + rows.join("\n"));
});

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

/* ---------- Códigos QR ---------- */
// Solo para enlaces del propio sitio (la portada o una encuesta), nunca para direcciones arbitrarias.
const QRCode = require("qrcode");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
app.get(["/qr.png", "/qr.svg"], limit("qr", 120, 300, 600e3), wrap(async (req, res) => {
  let p = typeof req.query.path === "string" ? req.query.path : "/";
  if (!/^\/(p\/[A-Za-z0-9_-]{1,40})?$/.test(p)) p = "/";
  const url = (PUBLIC_URL || `${req.protocol}://${req.get("host")}`) + p;
  const opts = { errorCorrectionLevel: "H", margin: 4, color: { dark: "#09090f", light: "#ffffff" } };
  const name = p === "/" ? "contradicta-qr" : "contradicta-" + p.slice(3) + "-qr";
  res.setHeader("Cache-Control", "public, max-age=86400");
  const svg = req.path.endsWith(".svg");
  if (req.query.download) res.setHeader("Content-Disposition", `attachment; filename="${name}.${svg ? "svg" : "png"}"`);
  if (svg) return res.type("image/svg+xml").send(await QRCode.toString(url, { ...opts, type: "svg" }));
  const width = Math.min(2048, Math.max(256, Number(req.query.size) || 1024));
  res.type("png").send(await QRCode.toBuffer(url, { ...opts, width }));
}));

/* ---------- Frontend ---------- */
// Huella de versión en las URL de app.js y styles.css: cada despliegue obliga a descargar la versión nueva.
const fingerprint = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(PUBLIC, f))).digest("hex").slice(0, 10);
const indexHtml = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8")
  .replace('src="/app.js"', `src="/app.js?v=${fingerprint("app.js")}"`)
  .replace('src="/i18n.js"', `src="/i18n.js?v=${fingerprint("i18n.js")}"`)
  .replace('src="/legal.js"', `src="/legal.js?v=${fingerprint("legal.js")}"`)
  .replace('href="/styles.css"', `href="/styles.css?v=${fingerprint("styles.css")}"`);
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
  const resumen = p.agg.masked ? "Resultados ocultos durante la veda electoral." : `${p.agg.n} votos · tensión ${p.agg.tension == null ? "—" : Math.round(p.agg.tension * 100)}/100.`;
  res.type("html").send(page(`${p.title} · Contradicta`, `${resumen} Ejercicio de opinión no probabilístico. Toma posición en Contradicta.`));
});
// Sin caché larga: el navegador revalida con ETag y siempre recibe la última versión tras un despliegue.
app.use(express.static(PUBLIC, { index: false, maxAge: 0, setHeaders: (res) => res.setHeader("Cache-Control", "no-cache") }));
app.get("*", (req, res) => res.type("html").send(indexHtml));

/* ---------- Cambios hechos por otra instancia (p. ej. durante un despliegue) ---------- */
store.onRemoteChange(({ kind, pid, exists }) => {
  if (kind === "resync") return broadcast("resync", {});
  if (!exists || kind === "deleted") return broadcast("deleted", { id: pid });
  pushPoll(pid);
  if (kind === "args") broadcast("args", { pollId: pid });
  if (kind === "comments") broadcast("comments", { pollId: pid });
});

/* ---------- Arranque ---------- */
(async () => {
  await store.init();
  if (store.allPolls().length === 0) {
    for (const s of SEED) await store.savePoll({ ...s, createdBy: "seed" });
    console.log(`Sembradas ${SEED.length} encuestas iniciales.`);
  }
  // Al empezar o terminar una veda electoral, pedir a los navegadores que recarguen los resultados.
  let vedaWas = vedaNow().active;
  setInterval(() => { const v = vedaNow().active; if (v !== vedaWas) { vedaWas = v; broadcast("resync", {}); console.log(`Veda electoral ${v ? "iniciada" : "terminada"}`); } }, 30e3).unref();
  // Cierre automático de encuestas con fecha límite
  setInterval(() => {
    for (const p of store.allPolls()) if (!p.closed && p.closesAt && p.closesAt <= Date.now()) {
      store.savePoll({ ...p, closed: true }).then(() => pushPoll(p.id)).catch(console.error);
    }
  }, 30e3).unref();
  console.log(`Turnstile: ${TURNSTILE_ON ? "activo" : "inactivo (faltan TURNSTILE_SITEKEY/TURNSTILE_SECRET)"}`);
  app.listen(PORT, () => console.log(`Contradicta escuchando en :${PORT} (almacenamiento: ${store.driver})`));
})().catch((e) => { console.error("No se pudo iniciar:", e); process.exit(1); });
