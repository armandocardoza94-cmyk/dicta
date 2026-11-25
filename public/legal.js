/*
 * Contradicta — documentos legales (aviso de privacidad, términos y condiciones, nota metodológica).
 *
 * IMPORTANTE: borrador elaborado con base en la legislación mexicana vigente a noviembre de 2026
 * (LFPDPPP publicada en el DOF el 20/03/2025; LGIPE art. 213; Reglamento de Elecciones del INE,
 * arts. 132–148; Ley General en Materia de Delitos Electorales art. 251) y en las prácticas de
 * transparencia de AAPOR y Pew Research Center. Debe revisarlo una persona abogada antes de
 * considerarlo definitivo. Los datos del responsable se configuran en Render
 * (LEGAL_NAME, LEGAL_ADDRESS, LEGAL_EMAIL, LEGAL_CITY).
 */
(() => {
"use strict";
const VERSION_DATE = "24 de noviembre de 2026";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pend = (label) => `<mark class="pend">[pendiente: ${label}]</mark>`;
const val = (v, label) => (v ? esc(v) : pend(label));

function header(title, L) {
  const missing = !L.name || !L.address || !L.email || !L.city;
  return `<a class="back" href="#encuestas">← Volver</a>
    <h2 class="sec">${title}</h2>
    <p class="note">Versión vigente: ${VERSION_DATE}. <span lang="en">Legal documents are provided in Spanish; the Spanish version prevails.</span></p>
    ${missing ? `<div class="caveat legal-warn">Faltan datos del responsable (nombre, domicilio, correo o ciudad). Se configuran en Render con las variables <code>LEGAL_NAME</code>, <code>LEGAL_ADDRESS</code>, <code>LEGAL_EMAIL</code> y <code>LEGAL_CITY</code>.</div>` : ""}
    <nav class="legal-nav"><a href="#privacidad">Aviso de privacidad</a><a href="#terminos">Términos y condiciones</a><a href="#metodologia">Nota metodológica</a></nav>`;
}

function privacidad(L) {
  return `${header("Aviso de privacidad integral", L)}
  <article class="legal" translate="no">
    <p>En cumplimiento de la <b>Ley Federal de Protección de Datos Personales en Posesión de los Particulares</b> (DOF, 20 de marzo de 2025) y su normativa aplicable, se informa lo siguiente:</p>

    <h3>1. Responsable</h3>
    <p>${val(L.name, "nombre o razón social")}, con domicilio en ${val(L.address, "domicilio completo")}, es responsable del tratamiento de los datos personales que se recaban a través de Contradicta (en adelante, "la plataforma"). Contacto en materia de datos personales: ${val(L.email, "correo electrónico")}.</p>

    <h3>2. Datos personales que tratamos</h3>
    <p>Contradicta <b>no solicita nombre, correo, teléfono ni registro</b>. Para funcionar trata únicamente:</p>
    <ul>
      <li><b>Identificador anónimo del dispositivo</b>: un código aleatorio guardado en una cookie, que evita que un mismo dispositivo vote varias veces.</li>
      <li><b>Tus respuestas</b> a las encuestas, la hora en que votas y, si la indicas voluntariamente, si participas desde México o desde el extranjero.</li>
      <li><b>Los textos que publiques</b> (argumentos y mensajes de debate), con la postura que hayas votado.</li>
      <li><b>Datos técnicos de conexión</b> (dirección IP y tipo de navegador), que se usan solo en memoria para seguridad y límites contra abuso, y no se guardan en la base de datos.</li>
      <li><b>Reportes</b> que hagas sobre contenido.</li>
    </ul>
    <p><b>Datos personales sensibles.</b> Tus opiniones sobre temas políticos, sociales o de derechos pueden considerarse datos sensibles. Por eso solo los tratamos con tu <b>consentimiento expreso</b>, que se te pide antes de participar por primera vez, y siempre de forma anónima: no los asociamos a tu identidad.</p>

    <h3>3. Finalidades</h3>
    <p><b>Finalidades necesarias</b> (sin ellas la plataforma no puede funcionar): (a) registrar tu voto sin duplicarlo y permitirte corregirlo durante el plazo indicado; (b) mostrar resultados agregados y comparar México con el extranjero; (c) publicar y moderar argumentos y mensajes; (d) prevenir fraude, abuso y ataques automatizados; (e) atender solicitudes de derechos ARCO.</p>
    <p><b>No usamos tus datos</b> para publicidad, perfilamiento comercial o político, ni los vendemos o cedemos a terceros. Los resultados que se publican son siempre agregados y no permiten identificar a nadie.</p>

    <h3>4. Encargados y transferencias</h3>
    <p>Para operar recurrimos a proveedores que tratan datos por cuenta nuestra (encargados), algunos con servidores fuera de México:</p>
    <ul>
      <li><b>Render Services, Inc.</b> (Estados Unidos): alojamiento de la plataforma y de la base de datos.</li>
      <li><b>Cloudflare, Inc.</b> (Estados Unidos): red de entrega y verificación anti-bots Turnstile.</li>
      <li><b>Google LLC</b> (Estados Unidos): tipografías web (Google Fonts), que reciben la dirección IP al cargar la página.</li>
    </ul>
    <p>No realizamos transferencias que requieran tu consentimiento. Solo entregaríamos información a una autoridad competente cuando una ley o un mandato judicial lo exijan.</p>

    <h3>5. Cookies y almacenamiento local</h3>
    <ul>
      <li><code>vid</code>: identificador anónimo del dispositivo (2 años). Necesaria.</li>
      <li><code>hum</code>: recuerda que pasaste la verificación anti-bots (12 horas). Necesaria.</li>
      <li><code>adm</code>: sesión de administración, solo para moderadores (12 horas).</li>
      <li>Almacenamiento local del navegador: idioma y región elegidos.</li>
    </ul>
    <p>No usamos cookies de publicidad ni de rastreo de terceros. Si bloqueas las cookies, podrás leer resultados, pero no votar ni publicar.</p>

    <h3>6. Conservación</h3>
    <p>Conservamos tus votos y textos mientras exista la encuesta correspondiente o hasta que solicites su eliminación. Los datos técnicos de conexión que usa la plataforma se descartan automáticamente en un plazo máximo de 24 horas. Los proveedores de alojamiento y red pueden conservar registros técnicos de acceso conforme a sus propias políticas de privacidad.</p>

    <h3>7. Derechos ARCO y revocación del consentimiento</h3>
    <p>Tienes derecho a <b>acceder</b> a tus datos, <b>rectificarlos</b>, <b>cancelarlos</b> y <b>oponerte</b> a su tratamiento, así como a <b>revocar tu consentimiento</b>. Como no pedimos datos de identidad, la forma más directa es desde este dispositivo:</p>
    <div class="forget-box">
      <p><b>Eliminar mis datos.</b> Borra todos los votos, argumentos, mensajes, apoyos, reportes y el consentimiento asociados a este dispositivo, y genera un identificador nuevo. Los mensajes tuyos que ya tengan respuestas de otras personas se anonimizan para no romper la conversación. Esta acción no se puede deshacer.</p>
      <button class="btn danger" id="forget-me">Eliminar mis datos de este dispositivo</button>
      <span class="note" id="forget-note"></span>
    </div>
    <p>También puedes escribir a ${val(L.email, "correo electrónico")} indicando tu solicitud. Para ubicar tus datos necesitaremos, por ejemplo, el texto o la fecha de un mensaje que hayas publicado. Responderemos en los plazos que establece la ley. Si consideras que tu derecho no fue atendido, puedes acudir a la <b>Secretaría Anticorrupción y Buen Gobierno</b>, autoridad garante en materia de protección de datos personales.</p>

    <h3>8. Menores de edad</h3>
    <p>Contradicta está dirigida a personas de <b>18 años o más</b>. Antes de participar se pide confirmar la mayoría de edad. Si detectamos datos de una persona menor de edad, los eliminaremos.</p>

    <h3>9. Cambios a este aviso</h3>
    <p>Cualquier cambio se publicará en esta página con su nueva fecha de vigencia. Si el cambio afecta el tratamiento de datos sensibles, se volverá a pedir tu consentimiento antes de que participes.</p>
  </article>`;
}

function terminos(L) {
  return `${header("Términos y condiciones de uso", L)}
  <article class="legal" translate="no">
    <p>Al usar Contradicta aceptas estos términos. Si no estás de acuerdo, no participes en la plataforma.</p>

    <h3>1. Qué es Contradicta</h3>
    <p>Contradicta es un <b>espacio de expresión y debate</b> donde cualquier persona puede plantear preguntas, votar y argumentar. Sus resultados son <b>ejercicios de opinión no probabilísticos</b>: reflejan solo a quienes deciden participar, <b>no son encuestas por muestreo</b>, no tienen margen de error y no representan a la población de México ni de ningún grupo. Consulta la <a href="#metodologia">nota metodológica</a>.</p>

    <h3>2. Quién puede participar</h3>
    <p>Debes tener <b>18 años o más</b> y aceptar el <a href="#privacidad">aviso de privacidad</a>. El servicio es gratuito.</p>

    <h3>3. Encuestas electorales: prohibidas</h3>
    <p>Para cumplir la <b>Ley General de Instituciones y Procedimientos Electorales</b> (art. 213) y el <b>Reglamento de Elecciones del INE</b> (arts. 132 a 148), en Contradicta <b>no se permite</b> crear preguntas que midan <b>intención de voto</b> o <b>preferencias por candidaturas, partidos políticos o coaliciones</b>, ni usar sus resultados para presentarlos como tendencias electorales. Las preguntas así se eliminan. Durante los periodos de <b>veda electoral</b> (los tres días previos a una jornada electoral y hasta el cierre de las casillas) se ocultan los resultados de las encuestas de política nacional. Difundir encuestas electorales durante la veda puede constituir un delito (Ley General en Materia de Delitos Electorales, art. 251).</p>

    <h3>4. Uso de los resultados</h3>
    <p>Puedes compartir y citar los resultados indicando siempre la fuente, la fecha, el número de votos y que se trata de un <b>ejercicio no probabilístico de Contradicta</b>. Está prohibido presentarlos como encuesta científica, como representativos de la población o como resultados electorales.</p>

    <h3>5. Conducta prohibida</h3>
    <ul>
      <li>Votar varias veces, usar bots, scripts, redes de cuentas o cualquier medio para alterar resultados o eludir los límites.</li>
      <li>Discurso de odio o discriminación por origen étnico, género, edad, discapacidad, condición social, religión, orientación sexual u otra condición (art. 1 de la Constitución y Ley Federal para Prevenir y Eliminar la Discriminación).</li>
      <li><b>Violencia política contra las mujeres en razón de género</b>, amenazas, acoso o incitación a la violencia.</li>
      <li>Publicar datos personales de terceros (teléfonos, domicilios, correos, documentos).</li>
      <li>Afirmaciones falsas que dañen el honor o la reputación de personas identificables.</li>
      <li>Propaganda electoral durante la veda, spam, publicidad o enlaces maliciosos.</li>
      <li>Contenido que infrinja derechos de autor o de propiedad industrial.</li>
    </ul>

    <h3>6. Contenido de las personas usuarias y moderación</h3>
    <p>Cada persona es <b>responsable de lo que publica</b>. Al publicar, autorizas a Contradicta a mostrar tu texto de forma gratuita y no exclusiva dentro de la plataforma. Contradicta actúa como intermediario: no revisa previamente cada publicación, pero aplica filtros automáticos, recibe reportes, oculta automáticamente el contenido que reportan varias personas y puede <b>eliminar contenido u ocultar encuestas</b> que incumplan estos términos o la ley, sin necesidad de aviso previo.</p>

    <h3>7. Avisos y reclamaciones</h3>
    <p>Para reportar contenido usa el botón <b>Reportar</b>. Para reclamaciones por derechos de autor, honor, datos personales o cualquier otra afectación, escribe a ${val(L.email, "correo electrónico")} indicando el enlace del contenido, el motivo y tus datos de contacto. Atenderemos los avisos fundados retirando el contenido a la brevedad.</p>

    <h3>8. Propiedad intelectual</h3>
    <p>El nombre Contradicta, su diseño y su código son propiedad de su titular. Los resultados agregados pueden reutilizarse conforme a la sección 4.</p>

    <h3>9. Limitación de responsabilidad</h3>
    <p>La plataforma se ofrece "tal cual", sin garantía de disponibilidad continua ni de exactitud de los resultados, que pueden verse afectados por la autoselección de participantes o por intentos de manipulación. En la medida que lo permita la ley, Contradicta no responde por decisiones tomadas con base en los resultados ni por el contenido publicado por las personas usuarias.</p>

    <h3>10. Cambios, legislación y jurisdicción</h3>
    <p>Podemos modificar estos términos; la versión vigente es la publicada en esta página. Estos términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de ${val(L.city, "ciudad")}, renunciando a cualquier otro fuero, salvo que la ley disponga otra cosa.</p>

    <h3>11. Contacto</h3>
    <p>${val(L.name, "nombre o razón social")} · ${val(L.address, "domicilio completo")} · ${val(L.email, "correo electrónico")}</p>
  </article>`;
}

function metodologia(L, meta) {
  const lockMin = Math.round((meta && meta.voteLockMs || 180000) / 60000);
  return `${header("Nota metodológica y de transparencia", L)}
  <article class="legal" translate="no">
    <p>Contradicta sigue, en lo aplicable, los principios de transparencia de la <b>American Association for Public Opinion Research (AAPOR)</b> y las recomendaciones de organizaciones como <b>Pew Research Center</b> sobre encuestas con participación voluntaria.</p>

    <h3>Tipo de estudio</h3>
    <p><b>Muestra no probabilística por autoselección</b> (participación voluntaria en línea, conocida como <i>opt-in</i>). No hay un marco muestral ni una selección aleatoria de participantes, por lo que <b>no se calculan medidas de precisión</b> como el margen de error o el nivel de confianza, y los resultados <b>no se pueden generalizar</b> a ninguna población.</p>

    <h3>Quiénes participan</h3>
    <p>Cualquier persona de 18 años o más que visite la plataforma y acepte el aviso de privacidad. La región ("México" o "el extranjero") la declara cada participante y no se verifica.</p>

    <h3>Control de calidad</h3>
    <ul>
      <li>Un voto por dispositivo, mediante una cookie anónima. El voto puede corregirse durante ${lockMin} minutos y después queda definitivo.</li>
      <li>Límites de participación por dispositivo y por conexión, incluido un máximo de votantes nuevos por conexión y encuesta.</li>
      <li>Verificación anti-bots de Cloudflare Turnstile y filtros de contenido.</li>
      <li>Aun así, los resultados pueden verse afectados por personas con varios dispositivos o por campañas organizadas.</li>
    </ul>

    <h3>Ponderación</h3>
    <p>Los resultados <b>no se ponderan</b>: son conteos simples de los votos recibidos.</p>

    <h3>Índice de tensión</h3>
    <p>Mide qué tan dividida está la opinión, de 0 (unanimidad) a 100 (máxima división). En preguntas de opción única o múltiple se calcula con la entropía normalizada de la distribución de respuestas. En escalas de acuerdo y de espectro se calcula con la desviación estándar dividida entre la máxima posible. Es un indicador descriptivo de quienes participaron, no una estimación poblacional.</p>

    <h3>Encuestas electorales</h3>
    <p>Contradicta <b>no realiza ni publica encuestas o sondeos sobre preferencias electorales</b> en los términos del artículo 213 de la LGIPE y del Reglamento de Elecciones del INE. Las preguntas de intención de voto se rechazan, y durante la veda electoral se ocultan los resultados de las encuestas de política nacional.</p>

    <h3>Cómo citar</h3>
    <p class="cite">"Ejercicio de opinión no probabilístico de Contradicta, consultado el [fecha], con [N] votos. No representa a la población."</p>
    <p>Cada encuesta puede descargarse en CSV con los conteos agregados, que no incluyen datos personales.</p>
  </article>`;
}

/* Aviso de privacidad simplificado: se muestra al pedir el consentimiento expreso. */
function consentText() {
  return `<p>Para participar (votar, crear preguntas, argumentar o debatir) necesitamos tu <b>consentimiento expreso</b>:</p>
    <ul class="consent-list">
      <li>Tus respuestas sobre temas políticos o sociales pueden ser <b>datos personales sensibles</b>. Las tratamos <b>de forma anónima</b>, con un identificador aleatorio de tu dispositivo, sin pedirte nombre, correo ni teléfono.</li>
      <li>Las usamos solo para contar votos sin duplicados, mostrar resultados agregados, moderar y prevenir abusos. No las vendemos ni las usamos para publicidad.</li>
      <li>Puedes <b>eliminar tus datos</b> cuando quieras desde el <a href="#privacidad" target="_blank">aviso de privacidad</a>.</li>
      <li>Los resultados son <b>ejercicios no probabilísticos</b>: no representan a la población. Las encuestas de intención de voto están prohibidas.</li>
    </ul>`;
}

window.LEGAL_DOCS = { privacidad, terminos, metodologia, consentText, VERSION_DATE };
})();
