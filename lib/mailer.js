"use strict";
/*
 * Envío de correos. Dos vías (la API tiene prioridad si está configurada):
 *  - BREVO_API_KEY: API HTTP de Brevo (puerto 443). Funciona en el plan gratuito de Render,
 *    que bloquea los puertos SMTP desde septiembre de 2025.
 *  - SMTP_URL (p. ej. smtps://usuario:clave@smtp.gmail.com:465): requiere un plan de pago en Render.
 * MAIL_FROM: remitente, p. ej. "Contradicta <tu-correo@gmail.com>" (en Brevo debe ser un remitente verificado).
 */
const SMTP_URL = process.env.SMTP_URL || "";
const MAIL_FROM = process.env.MAIL_FROM || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
let transport = null;
const enabled = () => !!((BREVO_API_KEY || SMTP_URL) && MAIL_FROM);
const via = () => (BREVO_API_KEY ? "brevo" : SMTP_URL ? "smtp" : "ninguno");

// "Nombre <correo@dominio>" → { name, email }
function parseFrom(s) {
  const m = String(s).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(s).trim() };
}
async function sendBrevo(to, subject, content) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: parseFrom(MAIL_FROM), to: [{ email: to }], subject, htmlContent: content.html, textContent: content.text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    let detail = ""; try { const d = await r.json(); detail = d.message || d.code || ""; } catch (_) {}
    throw new Error(`Brevo respondió ${r.status}${detail ? ": " + detail : ""}`);
  }
}

function getTransport() {
  if (!SMTP_URL) return null;
  if (!transport) transport = require("nodemailer").createTransport(SMTP_URL, { connectionTimeout: 15000, greetingTimeout: 10000 });
  return transport;
}

const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Plantilla sobria: texto plano + HTML. items: [{text, url}] */
function layout({ title, intro, items = [], button, footer }) {
  const text = [title, "", intro, "", ...items.map((i) => `• ${i.text}${i.url ? "\n  " + i.url : ""}`), "", button ? `${button.label}: ${button.url}` : "", "", footer || ""].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="margin:0 0 4px;font-size:22px">Contradi<span style="color:#c13cf0">cta</span></h2>
  <p style="color:#666;margin:0 0 18px;font-size:13px">praxis de la opinión</p>
  <h3 style="font-size:18px;margin:0 0 10px">${escHtml(title)}</h3>
  <p style="font-size:15px;line-height:1.5">${escHtml(intro)}</p>
  ${items.length ? `<ul style="padding-left:18px;font-size:15px;line-height:1.5">${items.map((i) => `<li style="margin-bottom:8px">${i.url ? `<a href="${escHtml(i.url)}" style="color:#7c3aed">${escHtml(i.text)}</a>` : escHtml(i.text)}</li>`).join("")}</ul>` : ""}
  ${button ? `<p style="margin:22px 0"><a href="${escHtml(button.url)}" style="background:#e11d48;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${escHtml(button.label)}</a></p>` : ""}
  <p style="font-size:12px;color:#888;line-height:1.5;border-top:1px solid #eee;padding-top:12px">${footer || ""}</p>
</div>`;
  return { text, html };
}

async function send(to, subject, content) {
  if (!enabled()) throw new Error("El envío de correos no está configurado.");
  if (BREVO_API_KEY) return sendBrevo(to, subject, content);
  const t = getTransport();
  await t.sendMail({ from: MAIL_FROM, to, subject, text: content.text, html: content.html });
}

module.exports = { enabled, send, layout, via };
