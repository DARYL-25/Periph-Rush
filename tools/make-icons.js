// Génère les icônes PNG de Périph' Rush sans dépendance externe
// (encodeur PNG minimal + rastérisation simple).
// Usage : node tools/make-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- rastérisation ----
function makeIcon(S) {
  const px = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const al = a / 255, inv = 1 - al;
    px[i] = r * al + px[i] * inv;
    px[i + 1] = g * al + px[i + 1] * inv;
    px[i + 2] = b * al + px[i + 2] * inv;
    px[i + 3] = Math.min(255, px[i + 3] + a);
  };
  const u = S / 100; // unités relatives
  // fond dégradé nuit avec coins arrondis (l'iOS masque tout seul, on remplit tout)
  for (let y = 0; y < S; y++) {
    const t = y / S;
    const r = 12 + t * 10, g = 18 + t * 16, b = 32 + t * 34;
    for (let x = 0; x < S; x++) set(x, y, r, g, b);
  }
  // périph : anneau gris avec pointillés
  const cx = S / 2, cy = S / 2 + 4 * u;
  const R = 34 * u, W = 13 * u;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - R) < W / 2) {
        set(x, y, 58, 63, 72);
        if (Math.abs(d - R) < 0.8 * u) {
          const ang = Math.atan2(y - cy, x - cx);
          if (Math.floor(ang * 9) % 2 === 0) set(x, y, 210, 214, 220);
        }
        if (Math.abs(Math.abs(d - R) - W / 2) < 1.2 * u) set(x, y, 130, 136, 146);
      }
    }
  }
  // cartouche jaune en haut
  const bx = 18 * u, by = 12 * u, bw = 64 * u, bh = 14 * u, rr = 4 * u;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const inX = x > bx && x < bx + bw, inY = y > by && y < by + bh;
      if (inX && inY) {
        const dx = Math.max(bx + rr - x, x - (bx + bw - rr), 0);
        const dy = Math.max(by + rr - y, y - (by + bh - rr), 0);
        if (Math.hypot(dx, dy) <= rr) set(x, y, 247, 198, 0);
      }
    }
  }
  // voiture (vue dessus) sur l'anneau, à droite
  const carX = cx + R, carY = cy, cw = 8 * u, cl = 15 * u;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (Math.abs(x - carX) < cw / 2 && Math.abs(y - carY) < cl / 2) {
        const edge = Math.min(cw / 2 - Math.abs(x - carX), cl / 2 - Math.abs(y - carY));
        if (edge > 0.5 * u) {
          set(x, y, 214, 40, 40);
          if (Math.abs(y - carY) < cl / 6) set(x, y, 26, 30, 38); // vitres
        }
      }
    }
  }
  // phares
  for (let dx = -1; dx <= 1; dx += 2) {
    for (let k = 0; k < 3 * u; k++) {
      set(Math.round(carX + dx * cw / 3), Math.round(carY - cl / 2 - k), 255, 240, 180, 160 - (k / (3 * u)) * 150);
    }
  }
  return encodePNG(S, S, px);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icons/icon-${size}.png OK`);
}
