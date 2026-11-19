"use strict";

const CATS = ["Política nacional", "Política internacional", "Mexicanos en el extranjero", "Economía", "Sociedad", "Derechos", "Medio ambiente", "Cultura", "Otro"];

const TYPES = {
  single: { name: "Opción única", desc: "Elegir una sola respuesta." },
  multiple: { name: "Opción múltiple", desc: "Marcar varias respuestas." },
  likert: { name: "Grado de acuerdo", desc: "De totalmente en desacuerdo a totalmente de acuerdo." },
  spectrum: { name: "Espectro", desc: "Ubicarse entre dos polos opuestos (0–10)." },
};

// Encuestas iniciales para que la plataforma no arranque vacía (sin votos).
const base = Date.now();
let i = 0;
const mk = (category, title, type, extra, description = "") => {
  const p = { id: "seed" + (++i), title, description, category, type, options: [], left: "", right: "", closed: false, closesAt: null, createdAt: base - i * 60000 };
  if (type === "single" || type === "multiple") p.options = extra;
  if (type === "spectrum") { p.left = extra[0]; p.right = extra[1]; }
  return p;
};

const SEED = [
  mk("Economía", "¿Quién debe dirigir la economía?", "spectrum", ["Estado", "Mercado"], "La contradicción clásica: planificación pública frente a libre mercado."),
  mk("Política nacional", "¿Qué tema debe ser la prioridad del gobierno?", "single", ["Seguridad", "Economía y empleo", "Salud", "Educación", "Corrupción"]),
  mk("Mexicanos en el extranjero", "¿Qué debe priorizar el gobierno para los mexicanos en el extranjero?", "single", ["Protección legal y consular", "Documentos de identidad", "Defensa ante deportaciones", "Facilidades para enviar remesas", "Programas de retorno"]),
  mk("Derechos", "¿Seguridad o libertades civiles: qué debe priorizarse?", "spectrum", ["Libertades civiles", "Seguridad"]),
  mk("Medio ambiente", "¿Debe México acelerar la transición a energías renovables?", "likert"),
  mk("Política internacional", "¿Con qué región debe México fortalecer sus lazos?", "multiple", ["Norteamérica", "América Latina", "Europa", "Asia", "África"]),
  mk("Sociedad", "¿Los programas sociales deben ser universales o focalizados?", "spectrum", ["Universales", "Focalizados"]),
  mk("Cultura", "¿Cómo te informas principalmente sobre política?", "single", ["Redes sociales", "Televisión", "Prensa digital", "Radio", "Conversaciones"]),
];

module.exports = { CATS, TYPES, SEED };
