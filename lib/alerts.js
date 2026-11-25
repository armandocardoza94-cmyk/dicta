"use strict";
/*
 * Alertas para quienes siguen temas (categorías o palabras clave) o preguntas concretas:
 *   - new_poll: nueva encuesta en un tema seguido
 *   - debate:   actividad en el debate de una pregunta seguida (máx. 1 aviso por pregunta y hora)
 *   - shift:    cambio fuerte de resultados (tensión ±15 puntos o cambia la opción líder, con ≥10 votos)
 *   - closing:  la encuesta cierra en menos de 24 h o el debate en menos de 3 h
 * Se entregan dentro de la app (y en vivo por SSE) y por correo: inmediato (agrupado) o resumen diario.
 * Durante la veda electoral no se generan alertas de resultados de encuestas ocultas.
 */
const accounts = require("./accounts");
const mailer = require("./mailer");

let ctx = null;   // { store, publicUrl, pushToUser(uid, payload), signUnsub(uid) }
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

function setup(c) { ctx = c; }
const pollUrl = (pid) => `${ctx.publicUrl()}/p/${pid}`;

async function deliver(user, type, poll, data) {
  if (!user.prefs.triggers[type === "new_poll" ? "newPoll" : type]) return;
  const n = await accounts.addNotification(user.id, type, poll.id, { title: poll.title, i18n: poll.i18n || null, ...data });
  ctx.pushToUser(user.id, { type: "notification", notification: { ...n, read: false } });
}

const matchesKeywords = (u, poll) => {
  const kws = (u.follows.keywords || []).map(norm).filter((k) => k.length >= 3);
  if (!kws.length) return false;
  const text = norm([poll.title, poll.description, ...(poll.options || []), poll.i18n && poll.i18n.en && poll.i18n.en.title].join(" "));
  return kws.some((k) => text.includes(k));
};

async function onNewPoll(poll) {
  if (!accounts.enabled() || poll.hidden) return;
  try {
    for (const u of await accounts.allUsers()) {
      if (u.follows.cats.includes(poll.category) || matchesKeywords(u, poll)) await deliver(u, "new_poll", poll, { category: poll.category });
    }
  } catch (e) { console.error("alertas new_poll:", e.message); }
}

async function onDebate(poll) {
  if (!accounts.enabled()) return;
  try {
    for (const u of await accounts.allUsers()) {
      if (!u.follows.polls.includes(poll.id)) continue;
      if (await accounts.once(`debate:${u.id}:${poll.id}`, 3600e3)) await deliver(u, "debate", poll, {});
    }
  } catch (e) { console.error("alertas debate:", e.message); }
}

function leaderOf(p, agg) {
  if (p.type === "single" || p.type === "multiple") {
    const max = Math.max(...agg.counts); if (max <= 0) return null;
    const idx = agg.counts.indexOf(max); return agg.counts.filter((c) => c === max).length > 1 ? "empate" : String(idx);
  }
  if (agg.mean == null) return null;
  const mid = p.type === "likert" ? 3 : 5;
  return agg.mean < mid - 0.5 ? "bajo" : agg.mean > mid + 0.5 ? "alto" : "centro";
}

/* Revisión periódica: cambios fuertes y cierres próximos */
async function tick() {
  if (!accounts.enabled()) return;
  try {
    const users = await accounts.allUsers();
    const followers = (pid) => users.filter((u) => u.follows.polls.includes(pid));
    for (const p of ctx.store.allPolls()) {
      if (p.hidden) continue;
      const view = ctx.store.getPollView(p.id);
      if (!view) continue;
      const fl = followers(p.id);
      // Cambio fuerte de resultados (nunca durante la veda: los resultados están ocultos)
      if (!view.agg.masked && view.agg.n >= 10) {
        const t = view.agg.tension == null ? null : Math.round(view.agg.tension * 100);
        const leader = leaderOf(p, view.agg);
        const snap = await accounts.getSnapshot(p.id);
        if (!snap) await accounts.saveSnapshot(p.id, t, leader, view.agg.n);
        else {
          const dT = t != null && snap.tension != null ? t - Math.round(snap.tension) : 0;
          const leaderChanged = snap.leader && leader && snap.leader !== leader && leader !== "empate";
          if (Math.abs(dT) >= 15 || leaderChanged) {
            for (const u of fl) if (await accounts.once(`shift:${u.id}:${p.id}`, 6 * 3600e3)) {
              await deliver(u, "shift", p, { from: snap.tension == null ? null : Math.round(snap.tension), to: t, leaderChanged: !!leaderChanged,
                leader: leaderChanged && /^\d+$/.test(leader) ? p.options[Number(leader)] : null, n: view.agg.n });
            }
            await accounts.saveSnapshot(p.id, t, leader, view.agg.n);
          }
        }
      }
      // Cierre próximo de la votación (24 h) y del debate (3 h)
      const now = Date.now();
      if (!view.closed && p.closesAt && p.closesAt - now < 24 * 3600e3 && p.closesAt > now) {
        for (const u of fl) if (await accounts.once(`closing:${u.id}:${p.id}`, 30 * 864e5)) await deliver(u, "closing", p, { what: "poll", at: p.closesAt });
      }
      if (view.debateEndsAt && view.debateEndsAt - now < 3 * 3600e3 && view.debateEndsAt > now) {
        for (const u of fl) if (await accounts.once(`closingdeb:${u.id}:${p.id}`, 30 * 864e5)) await deliver(u, "closing", p, { what: "debate", at: view.debateEndsAt });
      }
    }
  } catch (e) { console.error("alertas tick:", e.message); }
}

/* ---------- Correos ---------- */
const T = {
  es: {
    new_poll: (d) => `Nueva encuesta en ${d.category}: «${d.title}»`,
    debate: (d) => `Nuevos mensajes en el debate de «${d.title}»`,
    shift: (d) => d.leaderChanged ? `Cambió la opción líder en «${d.title}»${d.leader ? `: ahora va «${d.leader}»` : ""}` : `La tensión en «${d.title}» pasó de ${d.from} a ${d.to}`,
    closing: (d) => d.what === "debate" ? `El debate de «${d.title}» cierra pronto` : `La votación de «${d.title}» cierra pronto`,
    subjectNow: (n) => n === 1 ? "Tienes una alerta nueva en Contradicta" : `Tienes ${n} alertas nuevas en Contradicta`,
    subjectDigest: "Tu resumen diario de Contradicta",
    intro: "Esto pasó en las preguntas y temas que sigues:",
    button: "Ver mis alertas",
    footer: (unsub, account) => `Recibes este correo porque activaste las alertas en Contradicta. <a href="${account}">Cambiar preferencias</a> · <a href="${unsub}">Dejar de recibir correos</a>. Los resultados son ejercicios de opinión no probabilísticos.`,
  },
  en: {
    new_poll: (d) => `New poll in ${d.category}: “${(d.i18n && d.i18n.en && d.i18n.en.title) || d.title}”`,
    debate: (d) => `New messages in the debate on “${(d.i18n && d.i18n.en && d.i18n.en.title) || d.title}”`,
    shift: (d) => d.leaderChanged ? `The leading option changed in “${(d.i18n && d.i18n.en && d.i18n.en.title) || d.title}”` : `Tension in “${(d.i18n && d.i18n.en && d.i18n.en.title) || d.title}” moved from ${d.from} to ${d.to}`,
    closing: (d) => `${d.what === "debate" ? "The debate" : "Voting"} on “${(d.i18n && d.i18n.en && d.i18n.en.title) || d.title}” closes soon`,
    subjectNow: (n) => n === 1 ? "You have a new alert on Contradicta" : `You have ${n} new alerts on Contradicta`,
    subjectDigest: "Your daily Contradicta digest",
    intro: "Here's what happened in the questions and topics you follow:",
    button: "See my alerts",
    footer: (unsub, account) => `You get this email because you turned on alerts on Contradicta. <a href="${account}">Change preferences</a> · <a href="${unsub}">Stop emails</a>. Results are non-probability opinion exercises.`,
  },
};
const textFor = (lang, n) => (T[lang] || T.es)[n.type](n.data);

async function sendEmails(digest) {
  if (!accounts.enabled() || !mailer.enabled()) return;
  for (const u of await accounts.allUsers()) {
    const freq = u.prefs.emailFreq;
    if (!u.prefs.emailConsent || freq === "nunca" || (digest ? freq !== "diario" : freq !== "inmediato")) continue;
    const since = digest ? Math.max(u.lastDigest, Date.now() - 2 * 864e5) : Date.now() - 864e5;
    const items = await accounts.pendingEmails(u.id, since);
    if (!items.length) continue;
    const L = T[u.prefs.lang] ? u.prefs.lang : "es";
    const base = ctx.publicUrl();
    const content = mailer.layout({
      title: digest ? T[L].subjectDigest : T[L].subjectNow(items.length),
      intro: T[L].intro,
      items: items.map((n) => ({ text: textFor(L, n), url: n.pollId ? pollUrl(n.pollId) : base })),
      button: { label: T[L].button, url: `${base}/#alertas` },
      footer: T[L].footer(`${base}/unsubscribe?u=${encodeURIComponent(u.id)}&s=${ctx.signUnsub(u.id)}`, `${base}/#cuenta`),
    });
    try {
      await mailer.send(u.email, digest ? T[L].subjectDigest : T[L].subjectNow(items.length), content);
      await accounts.markEmailed(items.map((n) => n.id), u.id, digest ? Date.now() : null);
    } catch (e) { console.error("correo de alertas:", e.message); }
  }
}

function start() {
  setInterval(tick, 10 * 60e3).unref();                       // cambios fuertes y cierres
  setInterval(() => sendEmails(false), 15 * 60e3).unref();    // correos inmediatos agrupados cada 15 min
  setInterval(async () => {                                   // resumen diario a las 8:00 (hora del centro de México)
    const h = new Date(Date.now() - 6 * 3600e3).getUTCHours();
    if (h === 8 && (await accounts.once("digest:" + new Date().toISOString().slice(0, 10), 20 * 3600e3))) sendEmails(true);
  }, 10 * 60e3).unref();
  setInterval(() => accounts.pruneNotifications().catch(() => {}), 24 * 3600e3).unref();
  setTimeout(tick, 60e3).unref();
}

module.exports = { setup, start, onNewPoll, onDebate, tick, sendEmails };
