# Contradicta · praxis de la opinión

Encuestas en vivo con **índice de tensión**: mide cuán dividida está la opinión (0 = unanimidad, 100 = polarización máxima).

## Qué incluye (v2)

- **Datos compartidos y persistentes** en Postgres (o archivo JSON en local).
- **Tiempo real** con Server-Sent Events: votos, encuestas nuevas y personas conectadas se actualizan al instante.
- **4 tipos de encuesta**: opción única, múltiple, grado de acuerdo (Likert) y espectro entre dos polos.
- **México vs. el extranjero**: cada participante indica desde dónde vota y los resultados se comparan entre ambas orillas.
- **Argumentos**: quien vota puede defender su posición; los demás respaldan los mejores.
- **Pulso**: panel con KPIs, contradicciones más agudas, mayor consenso, tendencia de 24 h y tensión por categoría.
- **Compartir** (enlace con vista previa, WhatsApp, X, Web Share) y **exportar CSV** de resultados agregados.
- Cierre automático por fecha, retirar voto, un voto por dispositivo (cookie anónima), límites anti-abuso.
- PWA instalable.

## Ejecutar en local

```bash
npm install
npm start          # http://localhost:3000 — guarda en ./data/contradicta.json
```

Con Postgres: `DATABASE_URL=postgres://... npm start` (las tablas se crean solas).

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión a Postgres. Sin ella se usa un archivo JSON. |
| `ADMIN_TOKEN` | Contraseña de administración. Se inicia sesión en `/#admin` (cookie firmada de 12 h; 5 intentos cada 15 min). |
| `SESSION_SECRET` | Clave para firmar las cookies de sesión y de verificación. Usa un valor largo y aleatorio. |
| `TURNSTILE_SITEKEY` / `TURNSTILE_SECRET` | Claves de [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile). Si están, se pide verificación anti-bots al votar, crear, publicar y reportar (una vez cada 12 h). |
| `REPORT_HIDE_AT` | Reportes de personas distintas para ocultar un contenido automáticamente (por defecto 3). |
| `SSE_PER_IP` | Conexiones en vivo simultáneas por IP (por defecto 8). |
| `VOTE_LOCK_MINUTES` | Minutos para corregir o retirar un voto; después queda definitivo (por defecto 3). |
| `PUBLIC_URL` | Dirección pública del sitio que llevan los códigos QR (p. ej. `https://contradicta.onrender.com`). |
| `LEGAL_NAME` / `LEGAL_ADDRESS` / `LEGAL_EMAIL` / `LEGAL_CITY` | Datos del responsable que aparecen en el aviso de privacidad y los términos (obligatorios por la LFPDPPP). |
| `BREVO_API_KEY` | Envío de correos por la API de Brevo (puerto 443). **Necesario en el plan gratuito de Render**, que bloquea los puertos SMTP desde sept. 2025. Tiene prioridad sobre `SMTP_URL`. |
| `SMTP_URL` / `MAIL_FROM` | Envío de correos (enlaces de acceso y alertas). Ej.: `smtps://usuario:clave-de-aplicacion@smtp.gmail.com:465` y `Contradicta <correo@gmail.com>`. Sin ellas, las cuentas quedan desactivadas. |
| `VEDA_PERIODS` | Periodos de veda electoral `inicioISO/finISO`, separados por comas. Por defecto, la elección federal del 6 de junio de 2027. |
| `PORT` | Puerto (Render lo define solo). |

## Marco legal (borrador, requiere revisión de abogado)

- **Aviso de privacidad integral** (`/#privacidad`) conforme a la LFPDPPP del 20/03/2025: responsable, datos tratados, datos sensibles, finalidades, encargados (Render, Cloudflare, Google Fonts), cookies, conservación, derechos ARCO y autoridad (Secretaría Anticorrupción y Buen Gobierno).
- **Consentimiento expreso** antes de participar (las opiniones políticas son datos sensibles), con confirmación de mayoría de edad. Se guarda por dispositivo y versión (`CONSENT_VERSION` en `server.js`).
- **Eliminar mis datos** (derecho de cancelación) desde el aviso de privacidad: `DELETE /api/me`.
- **Términos y condiciones** (`/#terminos`): naturaleza no probabilística, prohibición de encuestas electorales, conducta prohibida (odio, violencia política de género, datos de terceros…), moderación, avisos de retiro, jurisdicción.
- **Nota metodológica** (`/#metodologia`) siguiendo la transparencia de AAPOR/Pew: muestra por autoselección, sin margen de error, sin ponderación, definición del índice de tensión y cómo citar.
- **Ley electoral**: se rechazan preguntas de intención de voto (LGIPE art. 213; Reglamento de Elecciones del INE arts. 132–148) y, durante la **veda electoral**, se ocultan en servidor los resultados de las encuestas de política nacional (también en CSV y vistas previas).
- Leyenda "ejercicio no probabilístico" junto a cada resultado y en los CSV.

## Seguridad

- Cabeceras: CSP estricta, HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy`.
- Límites por votante **y por IP** (no se esquivan borrando la cookie), incluido un máximo de votantes nuevos por IP y encuesta.
- Verificación anti-bots con Turnstile (opcional, por variables de entorno).
- Filtro de insultos, odio y datos personales (`lib/moderation.js`, lista editable).
- Reportes de la comunidad con ocultado automático y panel de moderación en `/#moderar`.
- Sincronización entre instancias con `LISTEN/NOTIFY` de Postgres.

## Despliegue

Incluye `render.yaml` (servicio web + Postgres gratis en Render).

## Respaldos y registros

- **Logs:** el servidor escribe en la consola (Render → servicio → *Logs*): arranque, errores con su traza (nunca se muestran al usuario), moderación y descargas de respaldo. No se registran direcciones IP.
- **Respaldo manual:** con sesión de administración, en *Moderación* → **Descargar respaldo de la base de datos** (`GET /api/admin/backup`). Es un JSON con todas las tablas, incluidos correos: guárdalo cifrado.
- **Respaldo automático:** el plan gratuito de Postgres en Render **no tiene respaldos** y vence a los 30 días; el plan de pago incluye respaldos diarios y restauración a un punto en el tiempo.

## Lista de verificación (seguridad, errores, UX, legal)

| # | Punto | Cómo se cumple |
|---|---|---|
| 1 | Secretos | Solo en variables de entorno de Render; `.env` en `.gitignore`; ninguna clave en el código ni en el historial. La clave pública de Turnstile es pública por diseño. |
| 2 | Validación | Toda entrada se valida en el servidor (tipos, rangos, opciones válidas, filtros de contenido). |
| 3 | Límites | Cuerpo JSON ≤ 32 KB; longitudes máximas por campo; 500 encuestas, 300 argumentos, 300 hilos y 50 alertas por consulta; sin subida de archivos. |
| 4 | XSS / CSP | Todo texto de usuario pasa por `esc()` antes de insertarse; CSP sin scripts en línea (solo estilos en línea). |
| 5 | Inyección SQL | Consultas parametrizadas (`$1`, `$2`…); solo se interpolan constantes internas. |
| 6 | Permisos | Cada ruta comprueba identidad (cookie anónima, sesión firmada o sesión de administración); nadie ve alertas ni datos de otra cuenta. |
| 7 | Rate limiting | Por dispositivo y por IP en votos, creación, debate, reportes, acceso (5 intentos/15 min), enlaces por correo (1/min por dirección) y conexiones en vivo. |
| 8 | HTTPS y cabeceras | HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP. |
| 9 | CORS | Sin cabeceras CORS: solo el propio sitio. Las escrituras con un `Origin` ajeno se rechazan (también protege contra CSRF). |
| 10 | Dependencias | `npm audit` en cada despliegue (ver logs de compilación) y Dependabot semanal (`.github/dependabot.yml`). |
| 11 | 404 | Página propia para rutas inexistentes, en el servidor y dentro de la app. |
| 12 | 500 | Manejador final de errores: mensaje genérico, sin trazas; JSON en la API. |
| 13 | Estados | Carga, lista vacía y error en listas, Pulso, Debates, encuesta, alertas y moderación. |
| 14 | Enlaces | Sin enlaces vacíos (`#`); todas las rutas existen. |
| 15 | Responsive | Diseño fluido con puntos de quiebre para celular, tableta y escritorio. |
| 16 | Accesibilidad | Etiquetas en campos, `alt` en imágenes, "Saltar al contenido", foco visible, Escape cierra ventanas, contraste alto, `prefers-reduced-motion`. |
| 17 | Rendimiento | Sin imágenes pesadas; compresión Brotli (Cloudflare); caché con ETag y huella de versión; fuentes con `display=swap`. |
| 18 | SEO | Título, descripción, favicon, manifiesto y Open Graph/Twitter con imagen PNG 1200×630 (`/og.png`); vista previa propia por encuesta. |
| 19 | Legal | Aviso de privacidad (incluye cookies, todas necesarias), términos y nota metodológica. |
| 20 | Logs, respaldo y README | Ver arriba. |
