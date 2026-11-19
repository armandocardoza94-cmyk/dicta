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
| `ADMIN_TOKEN` | Permite cerrar/eliminar cualquier encuesta o argumento. Actívalo en el navegador visitando `/#admin=TU_TOKEN`. |
| `PORT` | Puerto (Render lo define solo). |

## Despliegue

Incluye `render.yaml` (servicio web + Postgres gratis en Render).
