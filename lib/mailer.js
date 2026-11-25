"use strict";
/*
 * Envío de correos por SMTP (Gmail con contraseña de aplicación, Resend, Brevo, etc.).
 * Variables: SMTP_URL (p. ej. smtps://usuario:clave@smtp.gmail.com:465) y MAIL_FROM
 * (p. ej. "Contradicta <tu-correo@gmail.com>"). Si faltan, el correo queda desactivado.
 */
const SMTP_URL = process.env.SMTP_URL || "";
const MAIL_FROM = process.env.MAIL_FROM || "";
let transport = null;
const enabled = () => !!(SMTP_URL && MAIL_FROM);

function getTransport() {
  if (!enabled()) return null;
  if (!transport) transport = require("nodemailer").createTransport(SMTP_URL);
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
  const t = getTransport();
  if (!t) throw new Error("El envío de correos no está configurado.");
  await t.sendMail({ from: MAIL_FROM, to, subject, text: content.text, html: content.html });
}

module.exports = { enabled, send, layout };
