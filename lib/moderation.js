"use strict";
/*
 * Filtro de contenido para encuestas, argumentos y mensajes de debate.
 * - Bloquea insultos y expresiones de odio (lista editable abajo).
 * - Bloquea datos personales: correos y números de teléfono.
 * Los textos se normalizan (minúsculas, sin acentos, sustituciones tipo "p3nd3j0")
 * para que no sea trivial esquivar el filtro.
 */

// Raíces de palabras bloqueadas. Se comparan contra palabras normalizadas, como prefijo.
const BLOCKED = [
  // insultos comunes
  "pendej", "idiota", "imbecil", "estupid", "cabron", "culer", "puto", "puta", "putit", "chinga", "verga",
  "mamon", "mamad", "pinche", "ojete", "culo", "mierda", "gilipoll", "malparid", "hijueputa", "hdp", "ptm", "alv",
  "naco", "retrasad", "subnormal", "zorra", "perra",
  // odio y discriminación
  "maricon", "marica", "joto", "punal", "sudaca", "indio pata rajada", "negro de mierda",
  "matenlos", "hay que matar", "hay que matarlos",
];
// Palabras que contienen una raíz bloqueada pero son legítimas.
const ALLOWED = ["putativo", "putamen", "diputad", "vergara", "alvarez", "alvaro", "alvarado", "perrita", "culminar", "culmina"];

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[013457@$!]/g, (c) => LEET[c] || c)
    .replace(/(.)\1{2,}/g, "$1$1");     // "puuuuto" -> "puuto"
}

function hasBlocked(text) {
  const norm = normalize(text);
  const flat = " " + norm.replace(/[^a-zñ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  const words = flat.trim().split(" ");
  for (const b of BLOCKED) {
    if (b.includes(" ")) { if (flat.includes(" " + b)) return true; continue; }
    for (const w of words) {
      const ww = w.replace(/(.)\1+/g, "$1");  // "puuto" -> "puto"
      if ((w.startsWith(b) || ww.startsWith(b)) && !ALLOWED.some((a) => w.startsWith(a) || ww.startsWith(a))) return true;
    }
  }
  return false;
}

const EMAIL = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]| arroba )\s*[a-z0-9.-]+\s*(\.|\(dot\)| punto )\s*[a-z]{2,}/i;
function hasPersonalData(text) {
  const t = String(text || "");
  if (EMAIL.test(t)) return true;
  // 10 o más dígitos (con separadores sueltos): teléfonos, números de cuenta…
  if (/(?:\+?\d[\s.\-()]?){10,}/.test(t)) return true;
  return false;
}

/** ¿Pregunta por intención de voto o preferencias por candidaturas/partidos? (no se permiten en Contradicta) */
const ELECTORAL = [
  /por\s+qui[eé]n\s+(votar|votas|votar[aá]s|votar[ií]as)/i,
  /intenci[oó]n\s+de\s+voto/i,
  /preferencias?\s+electoral/i,
  /(votar[ií]as?|votar[aá]s|votas)\s+por\s+(el|la|los|las)?\s*(candidat|partido|coalici)/i,
  /qu[eé]\s+(partido|candidat[oa]|coalici[oó]n)\s+(votar|apoyar|elegir|prefier)/i,
  /si\s+hoy\s+fueran\s+las\s+elecciones/i,
  /(qui[eé]n|qu[eé]\s+candidat[oa])\s+(debe|deber[ií]a|va\s+a)\s+ganar\s+la\s+(elecci[oó]n|presidencia|gubernatura|alcald[ií]a)/i,
  // en inglés
  /who\s+(will|would|do)\s+you\s+vote\s+for/i,
  /voting\s+intention/i,
  /(which|what)\s+(party|candidate|coalition)\s+(will|would|do)\s+you\s+(vote|support|prefer)/i,
  /if\s+the\s+election\s+were\s+(held\s+)?today/i,
];
function isElectoral(...texts) {
  const t = texts.filter(Boolean).join(" \n ");
  return ELECTORAL.some((re) => re.test(t));
}

/** Devuelve un mensaje de error si el texto no se permite, o null si es válido. */
function check(...texts) {
  for (const t of texts) {
    if (!t) continue;
    if (hasPersonalData(t)) return "No compartas datos personales (teléfonos, correos o números de cuenta).";
    if (hasBlocked(t)) return "Tu texto contiene lenguaje ofensivo. Debate las ideas, no ataques a las personas.";
  }
  return null;
}

module.exports = { check, normalize, hasBlocked, hasPersonalData, isElectoral };
