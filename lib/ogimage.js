"use strict";
/*
 * Imagen para compartir en redes (Open Graph, 1200×630 PNG) generada sin dependencias:
 * fondo oscuro con resplandores de color y el símbolo de Contradicta (arco "C" con degradado
 * y punto blanco). Se dibuja una vez al arrancar y se codifica como PNG con zlib.
 */
const zlib = require("zlib");

const W = 1200, H = 630;
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (x) => Math.max(0, Math.min(1, x));

function render() {
  const px = Buffer.alloc((W * 3 + 1) * H);
  // Degradado de la marca: rojo → magenta → violeta
  const grad = (t) => t < 0.55
    ? [mix(255, 193, t / 0.55), mix(61, 60, t / 0.55), mix(90, 240, t / 0.55)]
    : [mix(193, 124, (t - 0.55) / 0.45), mix(60, 92, (t - 0.55) / 0.45), mix(240, 255, (t - 0.55) / 0.45)];
  const glows = [ { x: 180, y: 90, r: 520, c: [255, 61, 90], a: 0.30 }, { x: 1080, y: 120, r: 560, c: [124, 92, 255], a: 0.30 }, { x: 600, y: 700, r: 600, c: [193, 60, 240], a: 0.18 } ];
  // Símbolo: arco grueso (de 40° a 320°) centrado, más un punto blanco en la abertura
  const cx = 600, cy = 300, R = 190, th = 58, dotX = cx + R * 0.98, dotY = cy, dotR = 30;
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1); px[row] = 0;
    for (let x = 0; x < W; x++) {
      let r = 9, g = 9, b = 15;
      for (const gl of glows) {
        const d = Math.hypot(x - gl.x, y - gl.y) / gl.r, k = gl.a * clamp(1 - d) ** 2;
        r = mix(r, gl.c[0], k); g = mix(g, gl.c[1], k); b = mix(b, gl.c[2], k);
      }
      // Retícula sutil
      if (x % 48 === 0 || y % 48 === 0) { const k = 0.035 * clamp(1 - Math.hypot(x - 600, y) / 900); r = mix(r, 255, k); g = mix(g, 255, k); b = mix(b, 255, k); }
      // Arco con degradado y bordes suavizados
      const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang < 0) ang += 360;
      const edge = clamp(th / 2 - Math.abs(dist - R) + 0.5);
      const inArc = ang >= 40 && ang <= 320;
      if (edge > 0 && inArc) { const c = grad((ang - 40) / 280); r = mix(r, c[0], edge); g = mix(g, c[1], edge); b = mix(b, c[2], edge); }
      // Extremos redondeados del arco
      for (const a of [40, 320]) {
        const ex = cx + R * Math.cos(a * Math.PI / 180), ey = cy + R * Math.sin(a * Math.PI / 180);
        const k = clamp(th / 2 - Math.hypot(x - ex, y - ey) + 0.5);
        if (k > 0) { const c = grad(a === 40 ? 0 : 1); r = mix(r, c[0], k); g = mix(g, c[1], k); b = mix(b, c[2], k); }
      }
      // Punto blanco
      const kd = clamp(dotR - Math.hypot(x - dotX, y - dotY) + 0.5);
      if (kd > 0) { r = mix(r, 255, kd); g = mix(g, 255, kd); b = mix(b, 255, kd); }
      // Barra inferior: "índice de tensión" estilizado
      if (y >= 540 && y <= 552 && x >= 360 && x <= 840) {
        const t = (x - 360) / 480, c = grad(t), k = clamp(Math.min(y - 540, 552 - y, x - 360, 840 - x) / 2 + 0.5);
        r = mix(r, c[0], k); g = mix(g, c[1], k); b = mix(b, c[2], k);
      }
      if (y >= 528 && y <= 564 && x >= 655 && x <= 661) { r = 255; g = 255; b = 255; }
      const o = row + 1 + x * 3; px[o] = r; px[o + 1] = g; px[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(px, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

let cached = null;
module.exports = { png: () => (cached || (cached = render())), WIDTH: W, HEIGHT: H };
