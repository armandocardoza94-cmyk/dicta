/*
 * Contradicta — traducción de la interfaz.
 *
 * Cómo funciona: la app escribe sus textos en español; esta capa los traduce en pantalla
 * al idioma elegido. NO se traduce lo que escriben las personas (títulos de encuestas,
 * opciones, argumentos, mensajes): esos elementos llevan translate="no".
 *
 * Para corregir o ampliar una traducción basta con editar los diccionarios de abajo:
 *   - DICT[idioma]["Texto exacto en español"] = "Traducción"
 *   - RULES[idioma] = [[/expresión con números/, reemplazo], ...] para textos con cifras.
 * Lo que no esté traducido se muestra en español.
 *
 * Náhuatl: traducción PRELIMINAR y parcial. Debe revisarla gente hablante (por ejemplo un
 * traductor certificado del padrón PANITLI del INALI) antes de difundirla.
 */
(() => {
"use strict";

const LANGS = [
  { code: "es",  name: "Español",            htmlLang: "es-MX", locale: "es-MX" },
  { code: "en",  name: "English",            htmlLang: "en",    locale: "en-US" },
  { code: "nah", name: "Nāhuatlahtōlli",     htmlLang: "nah",   locale: "es-MX", preliminary: "náhuatl" },
];

/* ---------------------------------------------------------------- Inglés ---- */
const EN = {
  // Navegación y cabecera
  "Encuestas en vivo": "Live polls",
  "praxis de la opinión.": "the praxis of opinion.",
  "Toda sociedad es una": "Every society is a",
  "contradicción en movimiento": "contradiction in motion",
  "contradicción": "contradiction",
  "en movimiento. Contradicta la hace": "in motion. Contradicta makes it",
  ". Contradicta la hace": ". Contradicta makes it",
  "visible": "visible",
  "Encuestas": "Polls", "Pulso": "Pulse", "Debates": "Debates", "Crear": "Create", "Manifiesto": "Manifesto",
  "Moderación": "Moderation", "Administración": "Administration",
  "Participo desde": "Voting from", "México": "Mexico", "El extranjero": "Abroad",
  "Se usa para comparar la opinión en México y en el extranjero": "Used to compare opinion in Mexico and abroad",
  "Idioma": "Language",
  "Conectando…": "Connecting…", "En vivo": "Live", "Reconectando…": "Reconnecting…",
  "No se pudo conectar con el servidor. Reintentando…": "Couldn't reach the server. Retrying…",
  "Región sin indicar": "Region not set",
  "Contradicta · praxis de la opinión. Los resultados reflejan solo a quienes participan; no son una muestra representativa. Un voto por dispositivo; puedes corregirlo durante 3 minutos y después es definitivo. ·":
    "Contradicta · the praxis of opinion. Results only reflect those who take part; they are not a representative sample. One vote per device; you can correct it for 3 minutes, then it is final. ·",

  // Categorías y tipos
  "Todas": "All", "Política nacional": "National politics", "Política internacional": "International politics",
  "Mexicanos en el extranjero": "Mexicans abroad", "Economía": "Economy", "Sociedad": "Society", "Derechos": "Rights",
  "Medio ambiente": "Environment", "Cultura": "Culture", "Otro": "Other",
  "Opción única": "Single choice", "Opción múltiple": "Multiple choice", "Grado de acuerdo": "Level of agreement", "Espectro": "Spectrum",
  "Elegir una sola respuesta.": "Pick one answer.", "Marcar varias respuestas.": "Pick several answers.",
  "De totalmente en desacuerdo a totalmente de acuerdo.": "From strongly disagree to strongly agree.",
  "Ubicarse entre dos polos opuestos (0–10).": "Place yourself between two opposite poles (0–10).",
  "Totalmente en desacuerdo": "Strongly disagree", "En desacuerdo": "Disagree", "Neutral": "Neutral",
  "De acuerdo": "Agree", "Totalmente de acuerdo": "Strongly agree",
  "Tesis": "Thesis", "Antítesis": "Antithesis",

  // Lista
  "Encuestas abiertas al debate": "Polls open for debate",
  "Buscar": "Search", "Ordenar": "Sort",
  "Más recientes": "Newest", "En tendencia (24 h)": "Trending (24 h)", "Más votadas": "Most voted",
  "Más tensas": "Most divided", "Más debatidas": "Most debated",
  "Toca una para votarla o crearla": "Tap one to vote on it or create it",
  "Votar →": "Vote →", "Crear +": "Create +",
  "Cargando encuestas…": "Loading polls…", "No se pudo conectar. Reintentando…": "Couldn't connect. Retrying…",
  "Ninguna encuesta coincide con el filtro.": "No poll matches the filter.", "Aún no hay encuestas.": "No polls yet.",
  "Crear la primera": "Create the first one",
  "Cerrada": "Closed", "Nueva": "New", "· votaste": "· you voted", "Tensión —": "Tension —",

  // Pulso
  "Pulso de la contradicción": "Pulse of the contradiction",
  "participantes": "participants", "votos emitidos": "votes cast", "encuestas": "polls",
  "argumentos publicados": "arguments posted", "mensajes de debate": "debate messages",
  "Contradicciones más agudas": "Sharpest contradictions", "Mayor consenso": "Strongest consensus",
  "En tendencia · últimas 24 h": "Trending · last 24 h", "Tensión por categoría": "Tension by category",
  "Aún no hay datos.": "No data yet.",
  "Tensión ponderada por número de votos. 0 = unanimidad; 100 = polarización máxima.": "Tension weighted by number of votes. 0 = unanimity; 100 = maximum polarization.",
  "Sin datos suficientes": "Not enough data", "Consenso": "Consensus", "Disputa": "Dispute", "Contradicción aguda": "Sharp contradiction",
  "consenso": "consensus", "disputa": "dispute", "contradicción aguda": "sharp contradiction", "sin datos suficientes": "not enough data",

  // Detalle
  "← Todas las encuestas": "← All polls", "Cargando encuesta…": "Loading poll…",
  "Esta encuesta no existe o fue eliminada.": "This poll doesn't exist or was deleted.",
  "Copiar enlace": "Copy link", "Compartir…": "Share…", "Descargar CSV": "Download CSV",
  "Código QR": "QR code", "Código QR del sitio": "Site QR code", "Descargar PNG": "Download PNG", "Descargar SVG": "Download SVG", "Cerrar": "Close",
  "Escanéalo para abrir esta encuesta en el celular.": "Scan it to open this poll on your phone.",
  "Escanéalo para abrir Contradicta en el celular.": "Scan it to open Contradicta on your phone.",
  "Reportar": "Report", "Reportado": "Reported", "Encuesta reportada": "Poll reported", "Encuesta oculta": "Poll hidden",
  "Enlace copiado": "Link copied", "Copia el enlace:": "Copy the link:",
  "Votación cerrada": "Voting closed", "Toma posición": "Take a stand", "Tu posición": "Your position",
  "Tu voto · definitivo": "Your vote · final",
  "Votar": "Vote", "Actualizar voto": "Update vote", "Retirar voto": "Withdraw vote",
  "Voto registrado.": "Vote recorded.", "Voto registrado y definitivo.": "Vote recorded and final.",
  "Puedes marcar varias opciones.": "You can pick several options.",
  "⏱ Puedes cambiar o retirar tu voto durante": "⏱ You can change or withdraw your vote for",
  ". Después quedará": ". After that it will be",
  "definitivo": "final", ".": ".",
  "Indica arriba si participas desde México o desde el extranjero para comparar ambas miradas.": "Tell us above whether you vote from Mexico or abroad, to compare both views.",
  "Elige una opción primero.": "Choose an option first.", "Guardando…": "Saving…",
  "Voto actualizado": "Vote updated", "Voto retirado": "Vote withdrawn", "Tu voto ya es definitivo": "Your vote is now final",
  "Tu posición": "Your position",
  "Resultados en vivo": "Live results",
  "Todavía no hay votos. La contradicción espera ser expresada.": "No votes yet. The contradiction is waiting to be expressed.",
  "Media": "Mean", "Desv.": "SD", "Votos": "Votes", "Hoy": "Today",
  "Índice de tensión (0–100): cuán dividida está la opinión. 0 = unanimidad; 100 = polarización máxima.": "Tension index (0–100): how divided opinion is. 0 = unanimity; 100 = maximum polarization.",
  "media": "mean",
  "México vs. el extranjero": "Mexico vs. abroad",
  "Aún no hay votos con región indicada. Elige arriba desde dónde participas para que tu voto entre en la comparación.": "No votes with a region yet. Choose above where you vote from so your vote counts in the comparison.",
  "Brecha:": "Gap:", "miradas casi idénticas": "nearly identical views", "diferencia moderada": "moderate difference",
  "contradicción entre ambas orillas": "contradiction between both shores",
  "Cerrar votación": "Close voting", "Reabrir votación": "Reopen voting", "Eliminar encuesta": "Delete poll",
  "¿Seguro? Pulsa de nuevo": "Sure? Click again", "Encuesta eliminada": "Poll deleted",

  // Argumentos
  "Publicar": "Post", "Argumento publicado": "Argument posted",
  "Vota para poder publicar un argumento que defienda tu posición.": "Vote to be able to post an argument defending your position.",
  "Todavía nadie ha argumentado. Sé la primera voz.": "Nobody has argued yet. Be the first voice.",
  "Eliminar": "Delete", "¿Seguro?": "Sure?",

  // Debate
  "⏱ El debate dura": "⏱ The debate lasts", "24 horas": "24 hours", "a partir del primer mensaje.": "from the first message.",
  "⏱ Debate abierto · cierra en": "⏱ Debate open · closes in",
  "Enviar": "Send", "Responder": "Reply", "Cancelar": "Cancel",
  "Mensaje enviado": "Message sent", "Respuesta enviada": "Reply sent",
  "tú": "you", "sin votar": "hasn't voted",
  "Mensaje oculto por reportes de la comunidad, pendiente de revisión.": "Message hidden after community reports, pending review.",
  "Este debate no tuvo mensajes.": "This debate had no messages.",
  "Aún no hay mensajes. Abre el debate: el primer mensaje inicia el reloj de 24 horas.": "No messages yet. Open the debate: the first message starts the 24-hour clock.",
  "¿Qué opinas? Responde a la pregunta o a otra postura…": "What do you think? Answer the question or another position…",
  "En curso · cierran pronto primero": "Ongoing · closing soonest first", "Abre el debate": "Open the debate",
  "Cerrados · solo lectura": "Closed · read only", "Sin mensajes todavía": "No messages yet",
  "Debate cerrado": "Debate closed", "Cargando…": "Loading…",
  "Cada pregunta tiene su propio debate en vivo. Mensajes de máximo 200 caracteres, y cada debate dura": "Every question has its own live debate. Messages of up to 200 characters, and each debate lasts",
  "desde su primer mensaje.": "from its first message.",

  // Crear
  "Plantear una pregunta": "Ask a question",
  "Pregunta sugerida precargada. Ajusta el texto, el tipo o las opciones antes de publicar.": "Suggested question preloaded. Adjust the text, type or options before publishing.",
  "Pregunta": "Question", "Contexto (opcional)": "Context (optional)", "Categoría": "Category",
  "Cierre automático (opcional)": "Automatic closing (optional)", "Déjalo vacío para mantenerla abierta.": "Leave it empty to keep it open.",
  "Tipo de encuesta": "Poll type", "Opciones de respuesta": "Answer options", "+ Añadir opción": "+ Add option", "Quitar": "Remove",
  "Los dos polos de la contradicción": "The two poles of the contradiction", "Escala": "Scale",
  "Publicar encuesta": "Publish poll", "Podrás cerrarla o eliminarla desde este dispositivo.": "You'll be able to close or delete it from this device.",
  "Datos, antecedentes o matices que ayuden a responder.": "Facts, background or nuances that help answer.",
  "¿Debe el Estado garantizar la vivienda como derecho?": "Should the State guarantee housing as a right?",
  "Polo izquierdo (0) · p. ej. Estado": "Left pole (0) · e.g. State", "Polo derecho (10) · p. ej. Mercado": "Right pole (10) · e.g. Market",
  "Escribe una pregunta (mínimo 5 caracteres).": "Write a question (at least 5 characters).",
  "La fecha de cierre debe estar en el futuro.": "The closing date must be in the future.",
  "Añade al menos dos opciones.": "Add at least two options.", "Hay opciones repetidas.": "There are duplicate options.",
  "Define ambos polos del espectro.": "Define both poles of the spectrum.", "Encuesta publicada": "Poll published",
  "Ir a votarla →": "Go vote on it →", "Ya existe una encuesta con esa pregunta.": "A poll with that question already exists.",

  // Manifiesto
  "Praxis": "Praxis", "Polos": "Poles", "Tensión": "Tension", "Compromiso": "Commitment", "Argumento": "Argument", "Dos orillas": "Two shores",
  "La opinión no es un dato inerte: se forma al confrontarse. Aquí cada pregunta es una tesis puesta a prueba por quienes participan.": "Opinion is not inert data: it is formed through confrontation. Here every question is a thesis tested by those who take part.",
  "Las encuestas de espectro sitúan la opinión entre dos fuerzas opuestas —Estado y mercado, orden y libertad— en lugar de reducirla a sí o no.": "Spectrum polls place opinion between two opposing forces — State and market, order and freedom — instead of reducing it to yes or no.",
  "Cada resultado lleva un índice de tensión: 0 cuando hay unanimidad, 100 cuando la sociedad está partida. No buscamos el consenso, lo medimos.": "Every result carries a tension index: 0 when there is unanimity, 100 when society is split. We don't seek consensus; we measure it.",
  "Votar no basta: cada posición puede defenderse con razones, y las mejores suben por el respaldo de los demás.": "Voting is not enough: every position can be defended with reasons, and the best rise through others' support.",
  "Millones de mexicanos viven fuera del país. Contradicta compara lo que se piensa en México y en el extranjero.": "Millions of Mexicans live abroad. Contradicta compares what people think in Mexico and abroad.",
  "Tipos de encuesta": "Poll types", "Cómo funciona": "How it works",
  "Un voto por dispositivo": "One vote per device", "Datos abiertos": "Open data", "Sin muestra representativa": "Not a representative sample",
  "No pedimos registro. Una cookie anónima identifica tu dispositivo para que no se duplique tu voto.": "No sign-up needed. An anonymous cookie identifies your device so your vote isn't counted twice.",
  "Cada encuesta puede descargarse como CSV con los resultados agregados, sin datos personales.": "Every poll can be downloaded as a CSV with aggregate results, without personal data.",
  "Los resultados reflejan solo a quienes participan. Son una conversación, no un sondeo científico.": "Results only reflect those who take part. They are a conversation, not a scientific survey.",
  "Toda sociedad es una contradicción en movimiento. Contradicta la hace visible.": "Every society is a contradiction in motion. Contradicta makes it visible.",

  // Verificación anti-bots
  "Un momento": "One moment", "Confirma que eres una persona para continuar:": "Confirm you're a person to continue:",
  "marca la casilla": "tick the box", "del recuadro de Cloudflare. Solo se pide una vez cada 12 horas.": "in the Cloudflare box. It's only asked once every 12 hours.",
  "Cargando la verificación de Cloudflare…": "Loading Cloudflare's check…", "Reintentar": "Retry",
  "Verificación cancelada.": "Check cancelled.",
  "¿No ves la casilla? Algún bloqueador de anuncios o de rastreo puede estar ocultándola: permite": "Can't see the box? An ad or tracking blocker may be hiding it: allow",
  "para este sitio, o prueba en otro navegador.": "for this site, or try another browser.",
  "Tu navegador no es compatible con la verificación de Cloudflare. Prueba con Chrome, Edge, Firefox o Safari actualizados.": "Your browser doesn't support Cloudflare's check. Try an up-to-date Chrome, Edge, Firefox or Safari.",
  "No se pudo cargar la verificación. Revisa tu conexión.": "Couldn't load the check. Check your connection.",

  // Reportes
  "Reportar mensaje": "Report message", "Reportar argumento": "Report argument", "Reportar encuesta": "Report poll",
  "Si varias personas lo reportan, se oculta automáticamente hasta que alguien de moderación lo revise.": "If several people report it, it's hidden automatically until a moderator reviews it.",
  "Lenguaje ofensivo o insultos": "Offensive language or insults", "Discurso de odio o discriminación": "Hate speech or discrimination",
  "Spam o publicidad": "Spam or advertising", "Datos personales de alguien": "Someone's personal data",
  "Desinformación deliberada": "Deliberate disinformation", "Otro motivo": "Other reason",
  "Gracias. Lo revisaremos.": "Thanks. We'll review it.", "Reportado. El contenido quedó oculto para revisión.": "Reported. The content is hidden for review.",

  // Administración y moderación
  "Contraseña de administración": "Admin password", "Entrar": "Sign in",
  "Solo para quien modera Contradicta. Tras 5 intentos fallidos se bloquea el acceso durante 15 minutos.": "Only for Contradicta moderators. After 5 failed attempts, access is blocked for 15 minutes.",
  "Tienes una sesión de administración activa en este navegador (dura 12 horas).": "You have an active admin session in this browser (lasts 12 hours).",
  "Ir a moderación": "Go to moderation", "Cerrar sesión": "Sign out", "Sesión cerrada": "Signed out", "Sesión iniciada": "Signed in",
  "Necesitas iniciar sesión como administrador.": "You need to sign in as an administrator.",
  "Mensaje de debate": "Debate message", "Oculto": "Hidden", "Visible": "Visible", "Abrir encuesta": "Open poll",
  "Ocultar": "Hide", "Restaurar": "Restore", "Descartar reportes": "Dismiss reports", "¿Eliminar definitivamente?": "Delete permanently?",
  "No hay nada pendiente. 🎉": "Nothing pending. 🎉", "Hecho": "Done",

  // Legal
  "Aviso de privacidad": "Privacy notice", "Términos y condiciones": "Terms and conditions", "Nota metodológica": "Methodology note",
  "Aviso de privacidad integral": "Privacy notice", "Términos y condiciones de uso": "Terms of use", "Nota metodológica y de transparencia": "Methodology and transparency note",
  "← Volver": "← Back", "Legal documents are provided in Spanish; the Spanish version prevails.": "Legal documents are provided in Spanish; the Spanish version prevails.",
  "Antes de participar": "Before you take part", "Aceptar y continuar": "Accept and continue", "Ahora no": "Not now",
  "Ejercicio de opinión no probabilístico: no es una encuesta por muestreo, no tiene margen de error y no representa a la población.": "Non-probability opinion exercise: it is not a sample survey, has no margin of error and does not represent the population.",
  "Metodología": "Methodology",
  "Veda electoral": "Electoral blackout", "Veda electoral en curso": "Electoral blackout in effect",
  "Los resultados de las encuestas de política nacional se ocultan durante la veda electoral (LGIPE, art. 213). Puedes seguir votando: se mostrarán al terminar la veda.": "Results of national politics polls are hidden during the electoral blackout (LGIPE, art. 213). You can keep voting: they'll be shown when the blackout ends.",
  "Oculto durante la veda electoral.": "Hidden during the electoral blackout.",
  "Confirmo que esta pregunta": "I confirm this question", "no mide intención de voto": "does not measure voting intention",
  "ni preferencias por candidaturas, partidos o coaliciones (no permitidas por la ley electoral).": "or preferences for candidates, parties or coalitions (not allowed by electoral law).",
  "Más información": "More information",
  "Violencia política contra las mujeres en razón de género": "Gender-based political violence against women",
  "Encuesta de intención de voto (no permitida)": "Voting-intention poll (not allowed)",
  "¿Seguro? Pulsa de nuevo para borrar todo": "Sure? Click again to delete everything", "Datos eliminados": "Data deleted",
  "Eliminar mis datos de este dispositivo": "Delete my data from this device",
  "Antes de participar, acepta el aviso de privacidad y los términos.": "Before taking part, accept the privacy notice and terms.",
  "Para participar necesitas aceptar el aviso de privacidad.": "To take part you need to accept the privacy notice.",
  "Para participar debes confirmar que tienes 18 años o más y aceptar el aviso de privacidad y los términos.": "To take part you must confirm you are 18 or older and accept the privacy notice and terms.",
  "El aviso de privacidad cambió. Recarga la página para leer la versión vigente.": "The privacy notice changed. Reload the page to read the current version.",
  "Confirma que la pregunta no mide intención de voto por candidaturas, partidos o coaliciones.": "Confirm the question doesn't measure voting intention for candidates, parties or coalitions.",
  "Contradicta no publica encuestas de intención de voto ni de preferencias por candidaturas, partidos o coaliciones.": "Contradicta doesn't publish voting-intention polls or polls on preferences for candidates, parties or coalitions.",
  "Resultados no disponibles durante la veda electoral.": "Results unavailable during the electoral blackout.",

  // Mensajes del servidor
  "No se pudo completar la acción.": "The action couldn't be completed.",
  "Confirma que eres una persona.": "Confirm you're a person.",
  "No pudimos verificar que eres una persona. Inténtalo de nuevo.": "We couldn't verify you're a person. Please try again.",
  "Demasiadas acciones seguidas desde tu conexión. Espera unos minutos.": "Too many actions in a row from your connection. Wait a few minutes.",
  "Demasiadas conexiones abiertas desde tu red.": "Too many open connections from your network.",
  "Se alcanzó el límite de votos desde tu conexión para esta encuesta. Inténtalo más tarde.": "The vote limit from your connection for this poll was reached. Try again later.",
  "Tu voto ya es definitivo: el plazo para cambiarlo o retirarlo terminó.": "Your vote is final: the time to change or withdraw it is over.",
  "La votación está cerrada.": "Voting is closed.", "Respuesta no válida.": "Invalid answer.",
  "Desarrolla tu argumento (mínimo 10 caracteres).": "Develop your argument (at least 10 characters).",
  "Vota primero para poder argumentar tu posición.": "Vote first to argue your position.",
  "Escribe tu mensaje.": "Write your message.", "Máximo 200 caracteres.": "200 characters maximum.",
  "Este debate ya cerró: duró 24 horas.": "This debate has closed: it lasted 24 hours.",
  "El mensaje al que respondes ya no está disponible.": "The message you're replying to is no longer available.",
  "No compartas datos personales (teléfonos, correos o números de cuenta).": "Don't share personal data (phone numbers, emails or account numbers).",
  "Tu texto contiene lenguaje ofensivo. Debate las ideas, no ataques a las personas.": "Your text contains offensive language. Debate ideas, don't attack people.",
  "No puedes reportar tu propio contenido.": "You can't report your own content.", "Ese contenido ya no está disponible.": "That content is no longer available.",
  "Solo quien creó la encuesta puede modificarla.": "Only the poll's creator can change it.", "Solo quien creó la encuesta puede eliminarla.": "Only the poll's creator can delete it.",
  "No puedes eliminar este argumento.": "You can't delete this argument.", "No puedes eliminar este mensaje.": "You can't delete this message.",
  "Contraseña incorrecta.": "Wrong password.", "Inicia sesión como administrador.": "Sign in as an administrator.",
  "Error interno. Inténtalo de nuevo.": "Internal error. Please try again.", "Tipo de encuesta no válido.": "Invalid poll type.",
};

const EN_RULES = [
  [/^hace un momento$/, "just now"],
  [/^hace (\d+) min$/, "$1 min ago"], [/^hace (\d+) h$/, "$1 h ago"], [/^hace (\d+) d$/, "$1 d ago"],
  [/^hace (\d+) (min|h|d) · tuyo$/, "$1 $2 ago · yours"], [/^hace un momento · tuyo$/, "just now · yours"],
  [/^(En vivo|Reconectando…) · ([\d,]+) encuestas · ([\d,]+) participantes · ([\d,]+) votos$/, (m, a, p, u, v) => `${a === "En vivo" ? "Live" : "Reconnecting…"} · ${p} polls · ${u} participants · ${v} votes`],
  [/^(\d+) persona conectada$/, "$1 person online"], [/^(\d+) personas conectadas$/, "$1 people online"],
  [/^([\d,]+) voto$/, "$1 vote"], [/^([\d,]+) votos$/, "$1 votes"],
  [/^· \+(\d+) hoy$/, "· +$1 today"], [/^· (\d+) arg\.$/, "· $1 arg."], [/^· (\d+) msj\.$/, "· $1 msg."],
  [/^Tensión (\d+)$/, "Tension $1"],
  [/^Buscar una pregunta… \(p\. ej\. (.*)\)$/, "Search for a question… (e.g. $1)"],
  [/^Preguntas frecuentes · todas las categorías$/, "Frequent questions · all categories"],
  [/^Preguntas frecuentes · (.+)$/, (m, c) => "Frequent questions · " + (EN[c] || c)],
  [/^tensión media · (.+)$/, (m, l) => "mean tension · " + (EN[l] || l)],
  [/^(\d+) encuestas? · ([\d,]+) votos$/, (m, k, v) => `${k} ${k === "1" ? "poll" : "polls"} · ${v} votes`],
  [/^· cierra (.+)$/, "· closes $1"],
  [/^Al votar tendrás (\d+) minutos? para corregir tu voto; después será definitivo\.$/, "When you vote you'll have $1 min to correct it; after that it will be final."],
  [/^Voto registrado · tienes (\d+) min para corregirlo$/, "Vote recorded · you have $1 min to correct it"],
  [/^Porcentajes sobre ([\d,]+) participantes; pueden sumar más de 100%\.$/, "Percentages out of $1 participants; they may add up to more than 100%."],
  [/^(\d)\. (.+)$/, (m, n, l) => EN[l] ? `${n}. ${EN[l]}` : m],
  [/^media en México · ([\d,]+) votos$/, "mean in Mexico · $1 votes"], [/^media en el extranjero · ([\d,]+) votos$/, "mean abroad · $1 votes"],
  [/^puntos · (.+)$/, (m, l) => "points · " + (EN[l] || l)],
  [/^México · ([\d,]+)$/, "Mexico · $1"], [/^El extranjero · ([\d,]+)$/, "Abroad · $1"],
  [/^([+-]?\d+) pts$/, "$1 pts"],
  [/^Argumentos · (\d+)$/, "Arguments · $1"],
  [/^¿Por qué piensas así\? Defiende tu posición \((.*)\)\.$/, "Why do you think so? Defend your position ($1)."],
  [/^Debate · (\d+) mensajes?$/, (m, n) => `Debate · ${n} ${n === "1" ? "message" : "messages"}`],
  [/^(\d+) h (\d+) min$/, "$1 h $2 min"],
  [/^Debate cerrado · duró 24 horas y terminó el (.+)\. Puedes leerlo, pero ya no recibe mensajes\.$/, "Debate closed · it lasted 24 hours and ended on $1. You can read it, but it no longer accepts messages."],
  [/^Máximo (\d+) caracteres por mensaje: di lo esencial\.( Si votas, tu posición aparecerá junto a tu mensaje\.)?$/, (m, n, v) => `${n} characters max per message: say what matters.${v ? " If you vote, your position will appear next to your message." : ""}`],
  [/^Responder a (Participante [0-9A-F]{4})…$/, (m, a) => `Reply to ${a.replace("Participante", "Participant")}…`],
  [/^Participante ([0-9A-F]{4})$/, "Participant $1"],
  [/^⏱ quedan (.+)$/, "⏱ $1 left"],
  [/^(\d+) mensajes? · (.+)$/, (m, n, a) => `${n} ${n === "1" ? "message" : "messages"} · ${tr(a)}`],
  [/^Participas desde (.+)$/, (m, r) => "You're voting from " + (r === "méxico" ? "Mexico" : "abroad")],
  [/^Tras votar tienes (\d+) minutos para corregir o retirar tu voto; después queda definitivo\. Una posición tomada es una posición sostenida, y los resultados se actualizan en vivo para todos\.$/,
    "After voting you have $1 minutes to correct or withdraw your vote; then it is final. A position taken is a position held, and results update live for everyone."],
  [/^Opción (\d+)$/, "Option $1"],
  [/^Versión vigente: (.+)\.$/, "Current version: $1."],
  [/^Listo: se eliminaron (\d+) registros y este dispositivo tiene un identificador nuevo\.$/, "Done: $1 records were deleted and this device has a new identifier."],
  [/^· hasta el (.+)\. Se ocultan los resultados de las encuestas de política nacional \(LGIPE, art\. 213\)\.$/, "· until $1. Results of national politics polls are hidden (LGIPE, art. 213)."],
  [/^(\d+) elementos? por revisar · (\d+) ocultos?\. El contenido se oculta solo al recibir (\d+) reportes de personas distintas\.$/, "$1 item(s) to review · $2 hidden. Content is hidden automatically after $3 reports from different people."],
  [/^(\d+) reportes?$/, (m, n) => `${n} ${n === "1" ? "report" : "reports"}`],
  [/^· hace (.+)$/, (m, a) => "· " + tr("hace " + a)],
  [/^En: (.*)$/, "In: $1"],
  [/^La verificación falló \(código (.+)\)\. Pulsa$/, "The check failed (code $1). Press"],
  [/^No se pudo cargar la verificación de Cloudflare\.(.*)$/, "Couldn't load Cloudflare's check.$1"],
  [/^Escala$/, "Scale"],
  [/^Tu navegador/, (m) => m],
];

/* ------------------------------------------------- Lenguas indígenas -------- */
// Traducción preliminar y parcial: solo textos breves y muy visibles. Pendiente de revisión por hablantes.
const NAH = {
  "Encuestas": "Tlatlaniliztli", "México": "Mexihco",
  "Toma posición": "Xiquihto tlen ticnemilia", "Tu posición": "Motlahtol",
  "¿Qué opinas? Responde a la pregunta o a otra postura…": "¿Tlen ticnemilia?…",
  "Gracias. Lo revisaremos.": "Tlazohcamati.",
};
const DICT = { en: EN, nah: NAH };
const RULES = { en: EN_RULES, nah: [] };

/* ------------------------------------------------------------- Motor -------- */
const stored = (() => { try { return localStorage.getItem("lang"); } catch (_) { return null; } })();
let lang = LANGS.some((l) => l.code === stored) ? stored : ((navigator.language || "").toLowerCase().startsWith("en") ? "en" : "es");
const info = () => LANGS.find((l) => l.code === lang) || LANGS[0];

function tr(s) {
  if (lang === "es" || s == null) return s;
  const raw = String(s);
  const key = raw.trim();
  if (!key) return raw;
  const d = DICT[lang] || {};
  let out = Object.prototype.hasOwnProperty.call(d, key) ? d[key] : undefined;
  if (out === undefined) {
    for (const [re, rep] of RULES[lang] || []) {
      if (re.test(key)) { out = key.replace(re, rep); break; }
    }
  }
  if (out === undefined || out === key) return raw;
  return raw.match(/^\s*/)[0] + out + raw.match(/\s*$/)[0];
}

const origText = new WeakMap(), lastText = new WeakMap();
const origAttr = new WeakMap();
const ATTRS = ["placeholder", "aria-label", "title"];
const skip = (el) => !el || !!el.closest('[translate="no"],script,style,textarea,noscript');

function doText(node) {
  const p = node.parentElement;
  if (skip(p)) return;
  const cur = node.nodeValue;
  let o = origText.get(node);
  if (o === undefined || cur !== lastText.get(node)) { o = cur; origText.set(node, o); }
  const t = tr(o);
  if (t !== cur) node.nodeValue = t;
  lastText.set(node, t);
}
function doAttr(el, a) {
  // Los atributos (p. ej. el placeholder de un textarea) sí se traducen; solo se respeta translate="no".
  if (!el.hasAttribute(a) || el.closest('[translate="no"]')) return;
  let m = origAttr.get(el); if (!m) origAttr.set(el, (m = {}));
  const cur = el.getAttribute(a);
  if (!m[a] || cur !== m[a].last) m[a] = { orig: cur };
  const t = tr(m[a].orig);
  if (t !== cur) el.setAttribute(a, t);
  m[a].last = t;
}
function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) doText(n);
  for (const a of ATTRS) {
    if (root.hasAttribute && root.hasAttribute(a)) doAttr(root, a);
    root.querySelectorAll("[" + a + "]").forEach((el) => doAttr(el, a));
  }
}

let observer = null;
function start() {
  translateTree(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/* Selector de idioma y aviso de traducción preliminar */
function paint() {
  document.documentElement.lang = info().htmlLang;
  const sel = document.getElementById("lang");
  if (sel) sel.value = lang;
  const note = document.getElementById("i18n-note");
  if (note) {
    const pre = info().preliminary;
    note.hidden = !pre;
    if (pre) note.innerHTML = `<b>${info().name}</b> · Traducción preliminar al ${pre}: por ahora solo algunos textos están traducidos y el resto se muestra en español. Hablantes de la lengua deben revisarla; si puedes ayudar a mejorarla, escríbenos.`;
  }
}
function setLang(code) {
  if (!LANGS.some((l) => l.code === code) || code === lang) return;
  lang = code;
  try { localStorage.setItem("lang", code); } catch (_) {}
  paint();
  translateTree(document.body);
  window.dispatchEvent(new CustomEvent("langchange", { detail: code }));
}
function mountSelector() {
  const sel = document.getElementById("lang");
  if (!sel) return;
  sel.innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.name}</option>`).join("");
  sel.addEventListener("change", () => setLang(sel.value));
}

window.I18N = { LANGS, t: tr, lang: () => lang, locale: () => info().locale, setLang, turnstileLang: () => (lang === "en" ? "en" : "es") };

const boot = () => { mountSelector(); paint(); start(); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
