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
| `PORT` | Puerto (Render lo define solo). |

## Seguridad

- Cabeceras: CSP estricta, HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy`.
- Límites por votante **y por IP** (no se esquivan borrando la cookie), incluido un máximo de votantes nuevos por IP y encuesta.
- Verificación anti-bots con Turnstile (opcional, por variables de entorno).
- Filtro de insultos, odio y datos personales (`lib/moderation.js`, lista editable).
- Reportes de la comunidad con ocultado automático y panel de moderación en `/#moderar`.
- Sincronización entre instancias con `LISTEN/NOTIFY` de Postgres.

## Despliegue

Incluye `render.yaml` (servicio web + Postgres gratis en Render).
