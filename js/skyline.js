// ============================================================
// Périph' Rush — v26 : grands repères de la ligne d'horizon modélisés
// en détail, positions réelles (OSM / Wikipédia), formes et façades
// reconnaissables depuis le périphérique (aucun logo reproduit) :
//  • Tours Duo (J. Nouvel, 180 m et 122 m, Paris 13e) : deux tours
//    inclinées en V, façades de verre en mosaïque argentée
//  • Tour Triangle (Herzog & de Meuron, 180 m, Porte de Versailles)
//  • Tribunal de Paris (R. Piano, 160 m, Porte de Clichy) : socle et
//    trois volumes vitrés en gradins, terrasses plantées, aileron
//  • Hôtel Hyatt Regency Étoile (137 m + antenne) et Palais des Congrès
//  • Les Mercuriales (Bagnolet, 2 × 122 m) : « jumelles » sombres rayées
//  • Philharmonie de Paris (J. Nouvel) : colline d'aluminium « oiseaux »
//    et lame inclinée
//  • Stade Jean-Bouin (R. Ricciotti) : résille de béton blanc
//  • Adidas Arena (Porte de la Chapelle) : bardage bois, toit courbe
//  • Tour Montparnasse (210 m) : plan en lentille, bandeaux sombres
//  • La Défense : Grande Arche évidée, First, Hekla, Majunga, Coupole…
// Coordonnées monde : X est, Z sud (même projection que scenery.js).
// ============================================================

import { Batch, rgb, shade } from './geo.js';
import { rng } from './utils.js';

const LAT0 = 48.8590, LON0 = 2.3400, M_LAT = 111132, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const G = (lat, lon) => [(lon - LON0) * M_LON, -(lat - LAT0) * M_LAT];

// emprises où les bâtiments OSM génériques sont retirés (remplacés ici)
export const SKYLINE_ZONES = [
  { lat: 48.82497, lon: 2.38285, r: 70, name: 'Tours Duo' },
  { lat: 48.83166, lon: 2.28596, r: 80, name: 'Tour Triangle' },
  { lat: 48.89730, lon: 2.31210, r: 95, name: 'Tribunal de Paris' },
  { lat: 48.88056, lon: 2.28444, r: 40, name: 'Hyatt Regency Étoile' },
  { lat: 48.87890, lon: 2.28330, r: 85, name: 'Palais des Congrès' },
  { lat: 48.86790, lon: 2.41520, r: 70, name: 'Les Mercuriales' },
  { lat: 48.89150, lon: 2.39350, r: 85, name: 'Philharmonie' },
  { lat: 48.84306, lon: 2.25278, r: 85, name: 'Stade Jean-Bouin' },
  { lat: 48.89950, lon: 2.36130, r: 75, name: 'Adidas Arena' },
];

// ---------------------------------------------------------------- textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(T, cv, srgb = true) {
  const t = new T.CanvasTexture(cv);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
// façade + carte des fenêtres éclairées la nuit (même découpage)
function facade(T, W, H, seed, draw, lit) {
  const cv = canvas(W, H), c = cv.getContext('2d'), r = rng(seed);
  draw(c, W, H, r);
  const gv = canvas(W, H), g = gv.getContext('2d'), r2 = rng(seed + 1);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (lit) lit(g, W, H, r2);
  return { map: texOf(T, cv), glow: texOf(T, gv) };
}
// fenêtres éclairées : grille (cols × rows), proportion p, teinte chaude ou froide
function litGrid(cols, rows, p, inset = 0.15) {
  return (g, W, H, r) => {
    const cw = W / cols, rh = H / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (r() > p) continue;
      const k = 0.55 + r() * 0.45;
      g.fillStyle = r() < 0.5 ? `rgba(255,${Math.round(214 * k)},${Math.round(150 * k)},${k})` : `rgba(${Math.round(210 * k)},${Math.round(232 * k)},255,${k})`;
      g.fillRect(i * cw + cw * inset * 0.5, j * rh + rh * inset, cw * (1 - inset), rh * (1 - inset * 2));
    }
  };
}

function makeTextures(T) {
  const X = {};
  // Tours Duo : verre en mosaïque — panneaux argentés, gris-bleu et sombres en désordre, nez de dalle clairs
  X.duo = facade(T, 512, 512, 1801, (c, W, H, r) => {
    const cols = 16, rows = 8, cw = W / cols, rh = H / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const q = r();
      const base = q < 0.34 ? [206, 216, 224] : q < 0.62 ? [150, 168, 184] : q < 0.86 ? [104, 124, 142] : [70, 86, 102];
      const k = 0.92 + r() * 0.16;
      c.fillStyle = `rgb(${base.map((v) => Math.min(255, Math.round(v * k))).join(',')})`;
      c.fillRect(i * cw, j * rh, cw, rh);
      // reflet en biais
      c.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`;
      c.beginPath(); c.moveTo(i * cw, j * rh + rh); c.lineTo(i * cw + cw * 0.5, j * rh); c.lineTo(i * cw + cw, j * rh); c.lineTo(i * cw + cw * 0.4, j * rh + rh); c.fill();
    }
    c.fillStyle = 'rgba(235,240,244,0.9)';
    for (let j = 0; j < rows; j++) c.fillRect(0, j * rh, W, 3);
    c.fillStyle = 'rgba(60,70,80,0.5)';
    for (let i = 0; i < cols; i++) c.fillRect(i * cw, 0, 1.5, H);
  }, litGrid(16, 8, 0.24));
  // couronnement en résille métallique (Duo 1)
  X.mesh = facade(T, 256, 256, 77, (c, W, H) => {
    c.fillStyle = '#c3ccd3'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(80,92,104,0.75)'; c.lineWidth = 2;
    for (let k = -W; k < W * 2; k += 12) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + H, H); c.stroke(); c.beginPath(); c.moveTo(k, 0); c.lineTo(k - H, H); c.stroke(); }
  }, litGrid(8, 2, 0.5, 0.4));
  // Tour Triangle : verre clair à trame en losanges (triangles)
  X.tri = facade(T, 512, 512, 2026, (c, W, H, r) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#b9cad6'); g.addColorStop(1, '#9fb3c3');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`; c.fillRect(r() * W, r() * H, 20 + r() * 60, 6 + r() * 20); }
    c.strokeStyle = 'rgba(70,84,98,0.85)'; c.lineWidth = 3;
    const s = 64;
    for (let k = -W; k <= W * 2; k += s) {
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k + H / 2, H); c.stroke();
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k - H / 2, H); c.stroke();
    }
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(70,84,98,0.6)';
    for (let y = 0; y < H; y += s) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  }, litGrid(16, 16, 0.3));
  // verre clair à cadres blancs et brise-soleil (Tribunal)
  X.trib = facade(T, 512, 512, 2018, (c, W, H, r) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#a9c2d6'); g.addColorStop(1, '#8eaac2');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 20; i++) { c.fillStyle = `rgba(255,255,255,${0.06 + r() * 0.1})`; c.fillRect(r() * W, 0, 8 + r() * 30, H); }
    const rows = 8, rh = H / rows;
    for (let j = 0; j < rows; j++) {
      c.fillStyle = '#eef1f3'; c.fillRect(0, j * rh, W, 7);            // nez de dalle blanc
      c.fillStyle = 'rgba(240,243,245,0.55)'; c.fillRect(0, j * rh + rh * 0.5, W, 3); // lame
    }
    c.fillStyle = 'rgba(235,239,242,0.9)';
    for (let x = 0; x < W; x += 32) c.fillRect(x, 0, 3, H);
  }, litGrid(16, 8, 0.32));
  // bandeaux verticaux serrés (Mercuriales : sombre / Hyatt : gris clair)
  const stripes = (bg, fin, win, seed) => facade(T, 256, 512, seed, (c, W, H, r) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`; c.fillRect(r() * W, 0, 6 + r() * 26, H); }
    c.fillStyle = win;
    for (let y = 0; y < H; y += 32) c.fillRect(0, y + 22, W, 3);
    c.fillStyle = fin;
    for (let x = 0; x < W; x += 16) c.fillRect(x, 0, 6, H);
  }, litGrid(16, 16, 0.42, 0.3));
  X.merc = stripes('#2d3237', '#9aa2a8', 'rgba(20,24,28,0.8)', 1975);
  X.hyatt = stripes('#5c6168', '#d4d0c6', 'rgba(40,40,44,0.7)', 1974);
  // Montparnasse : bandeaux horizontaux bronze sombre
  X.montp = facade(T, 256, 256, 1973, (c, W, H, r) => {
    c.fillStyle = '#2a2b2c'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 32) {
      c.fillStyle = '#4a4741'; c.fillRect(0, y, W, 11);
      c.fillStyle = 'rgba(120,128,136,0.35)'; c.fillRect(0, y + 13, W, 17);
    }
    c.fillStyle = 'rgba(20,20,20,0.6)';
    for (let x = 0; x < W; x += 16) c.fillRect(x, 0, 2, H);
    for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; c.fillRect(r() * W, 0, 10 + r() * 30, H); }
  }, litGrid(16, 8, 0.35, 0.4));
  // Philharmonie : pavage d'« oiseaux » en aluminium (trois gris + noir), motif original
  X.phil = facade(T, 512, 512, 2015, (c, W, H, r) => {
    c.fillStyle = '#5a6066'; c.fillRect(0, 0, W, H);
    const s = 64;
    const shades = ['#d3d8dc', '#b9bfc4', '#9aa1a7', '#eceef0', '#4a4f55'];
    for (let y = 0; y < H; y += s / 2) for (let x = 0; x < W; x += s) {
      const ox = ((y / (s / 2)) % 2) * (s / 2);
      c.fillStyle = shades[Math.floor(r() * (r() < 0.12 ? 5 : 4))];
      c.beginPath();               // « oiseau » : chevron à ailes déployées
      c.moveTo(x + ox, y + s * 0.25);
      c.lineTo(x + ox + s * 0.5, y);
      c.lineTo(x + ox + s, y + s * 0.25);
      c.lineTo(x + ox + s * 0.5, y + s * 0.48);
      c.closePath(); c.fill();
    }
  }, null);
  // Jean-Bouin : résille de béton blanc à mailles triangulaires irrégulières
  X.bouin = facade(T, 512, 512, 2013, (c, W, H, r) => {
    c.fillStyle = '#eceae4'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1e2124';
    const n = 7, cw = W / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cw, y = j * cw, j0 = () => (r() - 0.5) * cw * 0.18;
      c.beginPath(); c.moveTo(x + cw * 0.14 + j0(), y + cw * 0.12); c.lineTo(x + cw * 0.86 + j0(), y + cw * 0.12 + j0()); c.lineTo(x + cw * 0.18 + j0(), y + cw * 0.86); c.fill();
      c.beginPath(); c.moveTo(x + cw * 0.9 + j0(), y + cw * 0.24); c.lineTo(x + cw * 0.88, y + cw * 0.9 + j0()); c.lineTo(x + cw * 0.3 + j0(), y + cw * 0.9); c.fill();
    }
  }, litGrid(7, 7, 0.0));
  // bardage bois à lames verticales (Adidas Arena)
  X.wood = facade(T, 256, 256, 2024, (c, W, H, r) => {
    for (let x = 0; x < W; x += 8) {
      const k = 0.85 + r() * 0.25;
      c.fillStyle = `rgb(${Math.round(176 * k)},${Math.round(138 * k)},${Math.round(98 * k)})`;
      c.fillRect(x, 0, 6, H);
      c.fillStyle = '#4a3a2c'; c.fillRect(x + 6, 0, 2, H);
    }
  }, null);
  // verres de La Défense (bleu, vert d'eau, sombre) avec trame d'étages
  const dglass = (top, bot, line, seed) => facade(T, 256, 256, seed, (c, W, H, r) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) { c.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.08})`; c.fillRect(r() * W, 0, 6 + r() * 30, H); }
    c.fillStyle = line;
    for (let y = 0; y < H; y += 32) c.fillRect(0, y, W, 4);
    for (let x = 0; x < W; x += 16) c.fillRect(x, 0, 1.5, H);
  }, litGrid(16, 8, 0.4));
  X.dBlue = dglass('#87a9c6', '#5f86a8', 'rgba(40,55,70,0.8)', 31);
  X.dGreen = dglass('#9fbcb8', '#6f948f', 'rgba(40,60,58,0.8)', 32);
  X.dDark = dglass('#4c5866', '#2e3742', 'rgba(15,20,26,0.8)', 33);
  X.dSilver = dglass('#c4cdd4', '#99a6b0', 'rgba(70,80,90,0.7)', 34);
  // marbre blanc de Carrare à caissons (Grande Arche)
  X.arche = facade(T, 256, 256, 1989, (c, W, H) => {
    c.fillStyle = '#e9e9e5'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(150,152,150,0.8)'; c.lineWidth = 2;
    for (let x = 0; x <= W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = 'rgba(70,90,110,0.55)';
    for (let y = 8; y < H; y += 32) for (let x = 8; x < W; x += 32) c.fillRect(x, y, 16, 16);
  }, litGrid(8, 8, 0.25, 0.5));
  return X;
}

// ---------------------------------------------------------------- géométrie
// loft : anneaux de même nombre de sommets (fermés), faces à plat ; uv en mètres / (tw, th)
function loft(B, rings, col, tw, th, smooth = false) {
  const n = rings[0].pts.length;
  // périmètre cumulé de l'anneau de base (u stable sur la hauteur)
  const per = [0];
  for (let i = 0; i < n; i++) { const [x0, z0] = rings[0].pts[i], [x1, z1] = rings[0].pts[(i + 1) % n]; per.push(per[i] + Math.hypot(x1 - x0, z1 - z0)); }
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], Bq = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [ax, az] = A.pts[i], [bx, bz] = A.pts[j], [cx, cz] = Bq.pts[j], [dx, dz] = Bq.pts[i];
      const ang = Math.atan2(bz - az, bx - ax);
      const c = smooth ? col : shade(col, 0.88 + 0.12 * Math.abs(Math.cos(ang + 0.6)));
      const u0 = per[i] / tw, u1 = per[i + 1] / tw;
      B.quad(B.v(ax, A.y, az, u0, A.y / th, c), B.v(bx, A.y, bz, u1, A.y / th, c), B.v(cx, Bq.y, cz, u1, Bq.y / th, c), B.v(dx, Bq.y, dz, u0, Bq.y / th, c));
    }
  }
}
function capPoly(T, B, pts, y, col) {
  const tris = T.ShapeUtils.triangulateShape(pts.map(([x, z]) => new T.Vector2(x, z)), []);
  const ids = pts.map(([x, z]) => B.v(x, y, z, x / 8, z / 8, col));
  for (const [a, b, c] of tris) { B.tri(ids[a], ids[c], ids[b]); B.tri(ids[a], ids[b], ids[c]); }
}
const prism = (B, pts, y0, y1, col, tw, th) => loft(B, [{ y: y0, pts }, { y: y1, pts }], col, tw, th);
const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
const frame = (cx, cz, ang) => { const ca = Math.cos(ang), sa = Math.sin(ang); return (u, v) => [cx + u * ca - v * sa, cz + u * sa + v * ca]; };
const rect = (W, w, d, u0 = 0, v0 = 0) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => W(u + u0, v + v0));
function roundRect(W, w, d, rad, seg = 5) {
  const pts = [], hw = w / 2 - rad, hd = d / 2 - rad;
  for (const [ox, oz, a0] of [[hw, hd, 0], [-hw, hd, Math.PI / 2], [-hw, -hd, Math.PI], [hw, -hd, Math.PI * 1.5]])
    for (let k = 0; k <= seg; k++) { const a = a0 + (k / seg) * (Math.PI / 2); pts.push(W(ox + Math.cos(a) * rad, oz + Math.sin(a) * rad)); }
  return pts;
}
// nettoyage d'un polygone OSM : retire les sommets quasi confondus, sens anti-horaire
function cleanPoly(flat) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) {
    const p = [flat[i], flat[i + 1]];
    if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 2.5) pts.push(p);
  }
  if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 2.5) pts.pop();
  return pts;
}
function tree(B, x, y, z, s, col = 0x4f7a3a) {
  const c = rgb(col), t = rgb(0x5a4632);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    B.quad(B.v(x + Math.cos(a0) * s * 0.12, y, z + Math.sin(a0) * s * 0.12, 0, 0, t), B.v(x + Math.cos(a1) * s * 0.12, y, z + Math.sin(a1) * s * 0.12, 0, 0, t),
      B.v(x + Math.cos(a1) * s * 0.1, y + s * 0.6, z + Math.sin(a1) * s * 0.1, 0, 0, t), B.v(x + Math.cos(a0) * s * 0.1, y + s * 0.6, z + Math.sin(a0) * s * 0.1, 0, 0, t));
    const top = B.v(x, y + s * 1.6, z, 0, 0, shade(c, 1.15));
    B.tri(B.v(x + Math.cos(a0) * s * 0.55, y + s * 0.6, z + Math.sin(a0) * s * 0.55, 0, 0, c), B.v(x + Math.cos(a1) * s * 0.55, y + s * 0.6, z + Math.sin(a1) * s * 0.55, 0, 0, c), top);
  }
}
function mast(B, x, y, z, h, r, col = 0xb9bec2) {
  const c = rgb(col), n = 6;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    B.quad(B.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, 0, 0, c), B.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, 0, 0, c),
      B.v(x + Math.cos(a1) * r * 0.3, y + h, z + Math.sin(a1) * r * 0.3, 0, 0, c), B.v(x + Math.cos(a0) * r * 0.3, y + h, z + Math.sin(a0) * r * 0.3, 0, 0, c));
  }
}
// anneaux d'une tour qui se déporte (inclinaison) et s'évase avec la hauteur
function leanRings(base, y0, y1, steps, lean, grow = () => 1) {
  const [cx, cz] = centroid(base), rings = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, y = y0 + (y1 - y0) * t, [ox, oz] = lean(t), g = grow(t);
    rings.push({ y, pts: base.map(([x, z]) => [cx + (x - cx) * g + ox, cz + (z - cz) * g + oz]) });
  }
  return rings;
}

// ---------------------------------------------------------------- bâtiments
// Tours Duo — emprises OSM ; Duo 1 (180 m) au bord du périphérique, Duo 2 (122 m) au nord-ouest
function toursDuo(T, M) {
  const duo2 = cleanPoly([3139, 3763.5, 3139.5, 3762, 3137, 3759.5, 3138, 3758.5, 3083.5, 3725.5, 3064, 3735, 3104, 3775, 3104, 3777, 3111.5, 3783, 3139.5, 3765]);
  const duo1 = cleanPoly([3201.5, 3810.5, 3176, 3789.5, 3171, 3792, 3153, 3780.5, 3152.5, 3779, 3147.5, 3777, 3113.5, 3791, 3164, 3842, 3172, 3834, 3174, 3836]);
  const c1 = centroid(duo1), c2 = centroid(duo2);
  const dl = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]), dx = (c1[0] - c2[0]) / dl, dz = (c1[1] - c2[1]) / dl;
  const glass = rgb(0xffffff);
  // Duo 1 : s'écarte de Duo 2 en montant (V), s'évase dans sa partie haute
  const r1 = leanRings(duo1, 0, 166, 8, (t) => [dx * 15 * Math.pow(t, 1.35), dz * 15 * Math.pow(t, 1.35)], (t) => 0.86 + 0.2 * Math.pow(t, 0.8));
  loft(M.duo, r1, glass, 24, 36);
  const top1 = r1[r1.length - 1];
  const crown = leanRings(top1.pts, 166, 180, 1, (t) => [dx * 2 * t, dz * 2 * t]);
  loft(M.mesh, crown, glass, 12, 14);
  capPoly(T, M.solid, crown[1].pts, 180, rgb(0x8d969d));
  capPoly(T, M.solid, top1.pts.map(([x, z]) => [x, z]), 166.2, rgb(0x6e777e));
  // Duo 2 : penche dans l'autre sens, terrasse panoramique coiffée d'un auvent
  const r2 = leanRings(duo2, 0, 112, 6, (t) => [-dx * 9 * Math.pow(t, 1.3), -dz * 9 * Math.pow(t, 1.3)], (t) => 0.9 + 0.12 * t);
  loft(M.duo, r2, glass, 24, 36);
  const top2 = r2[r2.length - 1].pts;
  const [tx, tz] = centroid(top2);
  capPoly(T, M.solid, top2, 112, rgb(0x7b8a73));
  const inner = top2.map(([x, z]) => [tx + (x - tx) * 0.72, tz + (z - tz) * 0.72]);
  prism(M.duo, inner, 112, 118, glass, 24, 36);                         // restaurant vitré
  const roof = top2.map(([x, z]) => [tx + (x - tx) * 1.04, tz + (z - tz) * 1.04]);
  prism(M.solid, roof, 121, 122, rgb(0xd8dcdf), 30, 30);
  capPoly(T, M.solid, roof, 122, rgb(0xd8dcdf));
  capPoly(T, M.solid, roof, 121, rgb(0xa9b0b5));
  for (let i = 0; i < top2.length; i += 2) { const [x, z] = roof[i]; mast(M.solid, x + (tx - x) * 0.06, 112, z + (tz - z) * 0.06, 9, 0.5, 0xc9ced2); }
  const rr = rng(12);
  for (let i = 0; i < 9; i++) { const a = rr() * Math.PI * 2, d = 6 + rr() * 10; tree(M.solid, tx + Math.cos(a) * d * 1.6, 112, tz + Math.sin(a) * d, 1.6 + rr()); }
  // socle commun : passerelle vitrée basse entre les deux tours
  const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
  const Wm = frame(mid[0], mid[1], Math.atan2(dz, dx));
  prism(M.duo, rect(Wm, dl * 0.7, 20), 0, 9, glass, 24, 36);
  capPoly(T, M.solid, rect(Wm, dl * 0.7, 20), 9, rgb(0x6f8a5c));
}

// Tour Triangle — emprise OSM (trapèze allongé) ; les faces convergent vers une arête sommitale courte
function tourTriangle(T, M) {
  const base = [[-4044.5, 3101.5], [-3984.5, 3089], [-3873, 2979], [-3929.5, 2985]];
  const [cx, cz] = centroid(base);
  const ax = base[2][0] - base[1][0], az = base[2][1] - base[1][1], L = Math.hypot(ax, az), ux = ax / L, uz = az / L, vx = -uz, vz = ux;
  const top = [[-5, -2.5], [5, -2.5], [5, 2.5], [-5, 2.5]];
  // ordre des sommets du sommet calé sur la base (même sens de parcours)
  const proj = (p) => [(p[0] - cx) * ux + (p[1] - cz) * uz, (p[0] - cx) * vx + (p[1] - cz) * vz];
  const topPts = base.map((p) => { const [u, v] = proj(p); return [cx + ux * Math.sign(u) * 5 + vx * Math.sign(v) * 2.5, cz + uz * Math.sign(u) * 5 + vz * Math.sign(v) * 2.5]; });
  void top;
  const rings = [];
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    rings.push({ y: 172 * t, pts: base.map((p, i) => [p[0] + (topPts[i][0] - p[0]) * t, p[1] + (topPts[i][1] - p[1]) * t]) });
  }
  loft(M.tri, rings, rgb(0xffffff), 18, 18);
  capPoly(T, M.solid, topPts, 172, rgb(0x9aa6ae));
  mast(M.solid, cx, 172, cz, 9, 0.9, 0xd0d4d6);
  // pied : hall vitré en retrait
  prism(M.trib, base.map(([x, z]) => [cx + (x - cx) * 0.97, cz + (z - cz) * 0.97]), 0, 1, rgb(0xffffff), 18, 18);
}

// Tribunal de Paris — socle long + trois volumes vitrés en gradins, terrasses plantées, aileron des ascenseurs
function tribunal(T, M) {
  const [cx, cz] = G(48.8973, 2.3121);
  const W = frame(cx, cz, -0.5);                      // grand axe ≈ ENE, parallèle au périphérique
  const glass = rgb(0xffffff);
  const pod = rect(W, 160, 70);
  prism(M.trib, pod, 0, 28, glass, 32, 32);
  capPoly(T, M.solid, pod, 28, rgb(0x8a9a7c));
  // volumes : 35 m d'épaisseur, de plus en plus courts, alignés côté ouest (aileron)
  const tiers = [[0, 28, 70, 112], [1, 70, 112, 86], [2, 112, 155, 60]];
  const x0 = -56;
  for (const [i, y0, y1, len] of tiers) {
    const p = rect(W, len, 35, x0 + len / 2, 0);
    prism(M.trib, p, y0 + 1.2, y1, glass, 32, 32);
    capPoly(T, M.solid, p, y1, rgb(0x7d9168));
    // garde-corps vitré + arbres sur la terrasse du volume suivant (partie découverte)
    const next = tiers[i + 1];
    const free0 = next ? next[3] : 0;
    const rr = rng(40 + i);
    for (let k = 0; k < 7; k++) {
      const u = x0 + free0 + 4 + rr() * Math.max(4, len - free0 - 8), v = (rr() - 0.5) * 26;
      const [tx, tz] = W(u, v); tree(M.solid, tx, y1, tz, 2.2 + rr() * 1.4, 0x5d8a44);
    }
    // dalle épaisse (plancher technique sombre entre deux volumes)
    prism(M.solid, p, y0, y0 + 1.2, rgb(0x3a3f44), 30, 30);
  }
  // aileron vertical avec les deux ascenseurs vitrés (pignon ouest)
  const fin = rect(W, 5, 14, x0 - 2.5, 0);
  prism(M.solid, fin, 0, 160, rgb(0xe6e9eb), 20, 20);
  capPoly(T, M.solid, fin, 160, rgb(0xd0d4d6));
  // panneaux solaires sur les flancs (bandes sombres verticales)
  for (const sgn of [1, -1]) {
    const s = rect(W, 0.6, 0.6, x0 + 30, sgn * 17.9);
    prism(M.solid, s, 30, 150, rgb(0x2a3440), 4, 4);
  }
}

// Hôtel Hyatt Regency Paris Étoile (137 m, antenne 190 m) et Palais des Congrès
function hyattPalais(T, M) {
  const [hx, hz] = G(48.88056, 2.28444);
  const W = frame(hx, hz, 0.45);
  // plan trilobé (trois ailes arrondies)
  const plan = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 15 + 6.5 * Math.cos(3 * a);
    plan.push(W(Math.cos(a) * r, Math.sin(a) * r));
  }
  loft(M.hyatt, [{ y: 0, pts: plan }, { y: 131, pts: plan }], rgb(0xffffff), 16, 32, true);
  const crown = plan.map(([x, z]) => [hx + (x - hx) * 0.96, hz + (z - hz) * 0.96]);
  loft(M.dDark, [{ y: 131, pts: crown }, { y: 137, pts: crown }], rgb(0xffffff), 16, 16, true);
  capPoly(T, M.solid, crown, 137, rgb(0x6c7176));
  mast(M.solid, hx, 137, hz, 53, 1.2, 0xc8ccd0);
  // Palais des Congrès : grand volume bas, façade principale inclinée vers la place (est)
  const [px, pz] = G(48.8787, 2.2832);
  const P = frame(px, pz, 0.2);
  const pal = rect(P, 150, 100);
  prism(M.dSilver, pal, 0, 30, rgb(0xffffff), 16, 16);
  capPoly(T, M.solid, pal, 30, rgb(0x8c9296));
  // pan incliné (de 0 m à 42 m, débordant de 22 m)
  const a = P(75, -50), b = P(75, 50), c = P(97, 50), d = P(97, -50);
  const g = rgb(0xffffff);
  M.dSilver.quad(M.dSilver.v(c[0], 0, c[1], 0, 0, g), M.dSilver.v(d[0], 0, d[1], 6, 0, g), M.dSilver.v(a[0], 42, a[1], 6, 2.6, g), M.dSilver.v(b[0], 42, b[1], 0, 2.6, g));
  M.solid.quad(M.solid.v(a[0], 42, a[1], 0, 0, rgb(0x8c9296)), M.solid.v(b[0], 42, b[1], 0, 0, rgb(0x8c9296)), M.solid.v(b[0], 30, b[1], 0, 0, rgb(0x8c9296)), M.solid.v(a[0], 30, a[1], 0, 0, rgb(0x8c9296)));
  for (const [e, f] of [[b, c], [d, a]]) M.solid.tri(M.solid.v(e[0], e === b ? 42 : 0, e[1], 0, 0, rgb(0x9aa0a4)), M.solid.v(f[0], f === c ? 0 : 42, f[1], 0, 0, rgb(0x9aa0a4)), M.solid.v(e === b ? b[0] : a[0], 0, e === b ? b[1] : a[1], 0, 0, rgb(0x9aa0a4)));
}

// Les Mercuriales : deux tours jumelles carrées, sombres à fines nervures argentées
function mercuriales(T, M) {
  const [px, pz] = G(48.86769, 2.41478);
  for (const [ox, oz, ant] of [[0, 0, 50], [64, 30, 26]]) {
    const W = frame(px + ox, pz + oz, 0.18);
    const p = rect(W, 33, 33);
    prism(M.merc, p, 0, 122, rgb(0xffffff), 16, 32);
    const top = rect(W, 31, 31);
    prism(M.solid, top, 122, 124, rgb(0x3b4045), 8, 8);
    capPoly(T, M.solid, top, 124, rgb(0x55595d));
    const [cx, cz] = W(0, 0);
    mast(M.solid, cx + 4, 124, cz, ant, 0.8, 0xc9ced2);
    mast(M.solid, cx - 5, 124, cz + 3, ant * 0.5, 0.5, 0xc9ced2);
  }
  // galerie commerciale basse qui les relie
  const W = frame(px + 32, pz + 15, 0.18 + Math.atan2(30, 64));
  const gal = rect(W, 60, 26);
  prism(M.dDark, gal, 0, 12, rgb(0xffffff), 16, 16);
  capPoly(T, M.solid, gal, 12, rgb(0x6c7176));
}

// Philharmonie de Paris : « colline » d'aluminium (emprise OSM), lame inclinée en surplomb
function philharmonie(T, M) {
  const base = cleanPoly([3912, -3680, 3924, -3600, 3932, -3569, 3951, -3573, 4026, -3601, 4017, -3604, 4017, -3630, 4014, -3675, 4011, -3692, 4008, -3686, 4004, -3713, 4009, -3717, 4002, -3746, 3974, -3729]);
  const [cx, cz] = centroid(base);
  const rings = [{ y: 0, pts: base }];
  for (const [y, k, ox] of [[14, 0.95, 0], [26, 0.78, 4], [34, 0.5, 8]]) rings.push({ y, pts: base.map(([x, z]) => [cx + (x - cx) * k + ox, cz + (z - cz) * k]) });
  loft(M.phil, rings, rgb(0xffffff), 34, 34);
  capPoly(T, M.solid, rings[rings.length - 1].pts, 34, rgb(0x9aa0a5));
  // lame inclinée (belvédère) : plaque épaisse inclinée qui surplombe le côté du périphérique
  const W = frame(cx + 6, cz - 12, -1.2);
  const p = [W(-34, -6), W(34, -6), W(34, 6), W(-34, 6)];
  const up = [W(-30, -14), W(38, -14), W(38, -2), W(-30, -2)];
  loft(M.phil, [{ y: 30, pts: p }, { y: 52, pts: up }], rgb(0xffffff), 34, 34);
  capPoly(T, M.solid, up, 52, rgb(0xd5d9dc));
  // rampe d'accès au toit
  const rp = [W(-46, 18), W(-10, 18), W(-10, 22), W(-46, 22)];
  prism(M.solid, rp, 0, 1, rgb(0x6f757a), 8, 8);
}

// Stade Jean-Bouin : boîte aux angles arrondis entièrement enveloppée d'une résille blanche
function jeanBouin(T, M) {
  const [cx, cz] = G(48.84306, 2.25278);
  const W = frame(cx, cz, 0.3 + Math.PI / 2);
  const outer = roundRect(W, 150, 112, 24, 6);
  const rings = [{ y: 0, pts: outer }, { y: 22, pts: outer }, { y: 27, pts: outer.map(([x, z]) => [cx + (x - cx) * 0.93, cz + (z - cz) * 0.93]) }];
  loft(M.bouin, rings, rgb(0xffffff), 20, 20, true);
  // toit en anneau (résille) et pelouse au centre
  const hole = roundRect(W, 104, 72, 10, 4);
  const ring = rings[2].pts;
  // anneau de toit : quads entre la couronne et l'ouverture (même nombre de sommets)
  const n = ring.length, m = hole.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, hi = Math.floor((i / n) * m), hj = Math.floor((((i + 1) % n) / n) * m) % m;
    const c = rgb(0xe9e7e1);
    M.bouin.quad(M.bouin.v(ring[i][0], 27, ring[i][1], i / 4, 0, c), M.bouin.v(ring[j][0], 27, ring[j][1], (i + 1) / 4, 0, c), M.bouin.v(hole[hj][0], 25, hole[hj][1], (i + 1) / 4, 1, c), M.bouin.v(hole[hi][0], 25, hole[hi][1], i / 4, 1, c));
  }
  capPoly(T, M.solid, roundRect(W, 112, 80, 10, 4), 0.4, rgb(0x3f7d34));
}

// Adidas Arena (Porte de la Chapelle) : bardage bois, toit courbe en berceau
function adidasArena(T, M) {
  const [cx, cz] = G(48.8995, 2.3613);
  const W = frame(cx, cz, Math.PI);
  const w = 120, d = 100, n = 14;
  prism(M.wood, rect(W, w, d), 0, 17, rgb(0xffffff), 12, 12);
  prism(M.dDark, rect(W, w + 0.4, d + 0.4), 0, 4.5, rgb(0xffffff), 16, 16);
  // berceau : 17 m aux rives, 27 m au faîte
  const ys = (t) => 17 + 10 * Math.sin(Math.PI * t);
  const c = rgb(0x8a9177);
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const a0 = W(-w / 2, -d / 2 + d * t0), b0 = W(w / 2, -d / 2 + d * t0), a1 = W(-w / 2, -d / 2 + d * t1), b1 = W(w / 2, -d / 2 + d * t1);
    M.solid.quad(M.solid.v(a0[0], ys(t0), a0[1], 0, 0, c), M.solid.v(b0[0], ys(t0), b0[1], 0, 0, c), M.solid.v(b1[0], ys(t1), b1[1], 0, 0, c), M.solid.v(a1[0], ys(t1), a1[1], 0, 0, c));
    for (const [p0, p1, x] of [[a0, a1, -1], [b0, b1, 1]]) {   // pignons en bois
      void x;
      M.wood.quad(M.wood.v(p0[0], 17, p0[1], t0 * 8, 17 / 12, rgb(0xffffff)), M.wood.v(p1[0], 17, p1[1], t1 * 8, 17 / 12, rgb(0xffffff)), M.wood.v(p1[0], ys(t1), p1[1], t1 * 8, ys(t1) / 12, rgb(0xffffff)), M.wood.v(p0[0], ys(t0), p0[1], t0 * 8, ys(t0) / 12, rgb(0xffffff)));
    }
  }
}

// Tour Montparnasse : plan en lentille (faces longues bombées), bandeaux sombres
function montparnasse(T, M) {
  const [cx, cz] = G(48.8421, 2.3219);
  const W = frame(cx, cz, 0.75);
  const plan = [];
  const n = 16;
  for (let i = 0; i <= n; i++) { const t = i / n, u = -25 + 50 * t; plan.push(W(u, -10 - 6 * Math.sin(Math.PI * t))); }
  for (let i = 0; i <= n; i++) { const t = i / n, u = 25 - 50 * t; plan.push(W(u, 10 + 6 * Math.sin(Math.PI * t))); }
  loft(M.montp, [{ y: 0, pts: plan }, { y: 200, pts: plan }], rgb(0xffffff), 16, 16, true);
  const top = plan.map(([x, z]) => [cx + (x - cx) * 0.97, cz + (z - cz) * 0.97]);
  loft(M.dDark, [{ y: 200, pts: top }, { y: 210, pts: top }], rgb(0xffffff), 16, 16, true);
  capPoly(T, M.solid, top, 210, rgb(0x45484b));
  mast(M.solid, cx, 210, cz, 18, 1.0, 0xc9ced2);
  // socle (centre commercial)
  const pod = rect(W, 110, 70, 0, 20);
  prism(M.dDark, pod, 0, 18, rgb(0xffffff), 16, 16);
  capPoly(T, M.solid, pod, 18, rgb(0x6c7176));
}

// La Défense : Grande Arche évidée et principales tours (formes distinctives)
function laDefense(T, M) {
  // Grande Arche : cube évidé de 110 m, tourné de 6,33° par rapport à l'axe historique
  {
    const [ax, az] = G(48.89262, 2.23598);
    const W = frame(ax, az, 0.45 + 0.11);
    const e = 19;                                  // épaisseur des parois
    const wall = (u0, u1, y0, y1) => { const p = [W(u0, -56), W(u1, -56), W(u1, 56), W(u0, 56)]; prism(M.arche, p, y0, y1, rgb(0xffffff), 20, 20); capPoly(T, M.arche, p, y1, rgb(0xf2f2ee)); capPoly(T, M.arche, p, y0, rgb(0xdcdcd6)); };
    wall(-55, -55 + e, 0, 93);
    wall(55 - e, 55, 0, 93);
    wall(-55, 55, 93, 110);
    wall(-55, 55, 0, 4);
    // « nuage » (toile tendue) dans l'ouverture
    const c = rgb(0xf6f6f2);
    const q = [W(-26, -18), W(26, -18), W(26, 18), W(-26, 18)];
    M.solid.quad(M.solid.v(q[0][0], 22, q[0][1], 0, 0, c), M.solid.v(q[1][0], 25, q[1][1], 0, 0, c), M.solid.v(q[2][0], 22, q[2][1], 0, 0, c), M.solid.v(q[3][0], 25, q[3][1], 0, 0, c));
  }
  // tours : [lat, lon, h, forme, dimensions, matériau, angle]
  const TOWERS = [
    [48.8898, 2.2410, 231, 'first', 46, 'dSilver', 0.3],    // Tour First
    [48.8936, 2.2307, 220, 'hekla', 40, 'dBlue', 0.2],      // Tour Hekla
    [48.8904, 2.2434, 194, 'majunga', 40, 'dSilver', 0.5],  // Tour Majunga
    [48.8916, 2.2380, 187, 'box', [52, 30], 'dDark', 0.4],   // Tour Coupole
    [48.8949, 2.2391, 184, 'box', [56, 26], 'dBlue', 0.5],   // Tour Granite
    [48.8899, 2.2446, 179, 'round', 34, 'dGreen', 0],       // CB21
    [48.8913, 2.2463, 178, 'box', [44, 28], 'dDark', 0.9],   // Tour Areva
    [48.8893, 2.2478, 171, 'd2', 34, 'dSilver', 0.6],        // Tour D2
    [48.8885, 2.2392, 167, 'box', [40, 30], 'dBlue', 0.1],   // Trinity
    [48.8925, 2.2506, 166, 'facet', 36, 'dBlue', 0.3],      // Carpe Diem
    [48.8907, 2.2489, 165, 'round', 30, 'dBlue', 0],        // Tour EDF
    [48.8955, 2.2432, 160, 'alto', 30, 'dGreen', 0.2],      // Tour Alto
    [48.8878, 2.2449, 155, 'box', [36, 36], 'dGreen', 0.7],  // Tour Égée
    [48.8920, 2.2435, 152, 'box', [44, 30], 'dDark', 0.2],   // Tour Ariane
    [48.8943, 2.2468, 140, 'box', [34, 28], 'dSilver', 0.6],
    [48.8889, 2.2509, 132, 'box', [30, 30], 'dBlue', 0.3],
  ];
  for (const [la, lo, h, kind, dim, mat, ang] of TOWERS) {
    const [cx, cz] = G(la, lo), W = frame(cx, cz, ang), B = M[mat], col = rgb(0xffffff);
    if (kind === 'box') {
      const p = rect(W, dim[0], dim[1]);
      prism(B, p, 0, h, col, 16, 16); capPoly(T, M.solid, p, h, rgb(0x5d646a));
      prism(M.solid, rect(W, dim[0] * 0.6, dim[1] * 0.6), h, h + 5, rgb(0x5d646a), 8, 8);
    } else if (kind === 'round') {
      const p = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; p.push(W(Math.cos(a) * dim / 2, Math.sin(a) * dim / 2)); }
      loft(B, [{ y: 0, pts: p }, { y: h, pts: p }], col, 16, 16, true); capPoly(T, M.solid, p, h, rgb(0x5d646a));
    } else if (kind === 'first') {
      // plan en losange aux angles coupés ; sommet en biais (couronne vitrée)
      const p = [W(-dim / 2, 0), W(-dim / 4, -dim * 0.36), W(dim / 2, -dim * 0.3), W(dim / 2, 0), W(dim / 4, dim * 0.36), W(-dim / 2, dim * 0.3)];
      loft(B, [{ y: 0, pts: p }, { y: h - 20, pts: p }], col, 16, 16);
      const tp = p.map(([x, z], i) => [x, z, h - 20 + (i < 3 ? 20 : 8)]);
      for (let i = 0; i < 6; i++) { const a = tp[i], b = tp[(i + 1) % 6]; B.quad(B.v(a[0], h - 20, a[1], 0, 0, col), B.v(b[0], h - 20, b[1], 1, 0, col), B.v(b[0], b[2], b[1], 1, 1, col), B.v(a[0], a[2], a[1], 0, 1, col)); }
      capPoly(T, M.solid, p, h - 6, rgb(0x6c737a));
    } else if (kind === 'hekla') {
      // facettes vrillées qui se terminent en pointe
      const p0 = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p0.push([Math.cos(a) * dim / 2, Math.sin(a) * dim / 2 * 0.8]); }
      const rings = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6, s = t < 0.75 ? 1 : 1 - (t - 0.75) * 3.6, tw = t * 0.5;
        rings.push({ y: h * t, pts: p0.map(([u, v]) => W(u * s * Math.cos(tw) - v * s * Math.sin(tw), u * s * Math.sin(tw) + v * s * Math.cos(tw))) });
      }
      loft(B, rings, col, 16, 16);
    } else if (kind === 'majunga') {
      // trois volumes décalés en hauteur (loggias)
      for (const [u, v, hh] of [[-8, 0, h], [8, -6, h * 0.88], [6, 9, h * 0.76]]) { const p = rect(W, dim * 0.55, dim * 0.5, u, v); prism(B, p, 0, hh, col, 16, 16); capPoly(T, M.solid, p, hh, rgb(0x6c737a)); }
    } else if (kind === 'd2') {
      // fuseau à résille (ventre bombé)
      const rings = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, s = 0.75 + 0.35 * Math.sin(Math.PI * t * 0.9); const p = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push(W(Math.cos(a) * dim / 2 * s, Math.sin(a) * dim / 2.6 * s)); } rings.push({ y: h * t, pts: p }); }
      loft(B, rings, col, 16, 16, true); capPoly(T, M.solid, rings[6].pts, h, rgb(0x6c737a));
    } else if (kind === 'facet') {
      const p = [W(-dim / 2, -dim / 3), W(dim / 2, -dim / 2), W(dim / 2, dim / 3), W(-dim / 3, dim / 2)];
      const tp = [W(-dim / 3, -dim / 3), W(dim / 2, -dim / 3), W(dim / 3, dim / 3), W(-dim / 2, dim / 3)];
      loft(B, [{ y: 0, pts: p }, { y: h, pts: tp }], col, 16, 16); capPoly(T, M.solid, tp, h, rgb(0x6c737a));
    } else if (kind === 'alto') {
      // s'évase en montant (emprise au sol réduite)
      const pr = (s) => { const p = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push(W(Math.cos(a) * dim / 2 * s, Math.sin(a) * dim / 2 * s * 0.75)); } return p; };
      loft(B, [{ y: 0, pts: pr(0.7) }, { y: h * 0.5, pts: pr(1) }, { y: h, pts: pr(1.15) }], col, 16, 16, true); capPoly(T, M.solid, pr(1.15), h, rgb(0x6c737a));
    }
  }
}

// ---------------------------------------------------------------- assemblage
function haze(mat, k) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>',
      `#ifdef USE_FOG\n  float fogFactor = smoothstep( fogNear, fogFar * ${k.toFixed(2)}, vFogDepth ) * 0.85;\n  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif`);
  };
  mat.customProgramCacheKey = () => 'sky-haze' + k;
  return mat;
}

export function buildSkyline(T, scene) {
  const X = makeTextures(T);
  const keys = ['duo', 'mesh', 'tri', 'trib', 'merc', 'hyatt', 'montp', 'phil', 'bouin', 'wood', 'dBlue', 'dGreen', 'dDark', 'dSilver', 'arche'];
  const M = { solid: new Batch() };
  for (const k of keys) M[k] = new Batch();
  toursDuo(T, M);
  tourTriangle(T, M);
  tribunal(T, M);
  hyattPalais(T, M);
  mercuriales(T, M);
  philharmonie(T, M);
  jeanBouin(T, M);
  adidasArena(T, M);
  montparnasse(T, M);
  laDefense(T, M);
  const group = new T.Group();
  const nightMats = [];
  const DS = T.DoubleSide;
  const shiny = new Set(['duo', 'tri', 'trib', 'dBlue', 'dGreen', 'dDark', 'dSilver', 'merc', 'mesh']);
  for (const k of keys) {
    const g = M[k].build(T);
    if (!g) continue;
    const opt = { map: X[k].map, vertexColors: true, side: DS, emissiveMap: X[k].glow, emissive: 0xffe2b0, emissiveIntensity: 0, fog: true };
    const mat = haze(shiny.has(k) ? new T.MeshPhongMaterial({ ...opt, shininess: 70, specular: 0x6f7f8f }) : new T.MeshLambertMaterial(opt), 4.2);
    nightMats.push(mat);
    const mesh = new T.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const gs = M.solid.build(T);
  if (gs) {
    const mesh = new T.Mesh(gs, haze(new T.MeshLambertMaterial({ vertexColors: true, side: DS, fog: true }), 4.2));
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  // feux d'obstacle rouges au sommet des tours (clignotent la nuit)
  const beacons = [];
  const bMat = new T.MeshBasicMaterial({ color: 0xff2a1a, fog: false, transparent: true, opacity: 0 });
  const bGeo = new T.SphereGeometry(1.6, 6, 4);
  const addBeacon = (lat, lon, y, dx = 0, dz = 0) => { const [x, z] = G(lat, lon); const m = new T.Mesh(bGeo, bMat); m.position.set(x + dx, y, z + dz); group.add(m); beacons.push(m); };
  addBeacon(48.88056, 2.28444, 190);
  addBeacon(48.86769, 2.41478, 174);
  addBeacon(48.8421, 2.3219, 228);
  addBeacon(48.89262, 2.23598, 112);
  { const p = [-3958, 3039]; const m = new T.Mesh(bGeo, bMat); m.position.set(p[0], 181, p[1]); group.add(m); beacons.push(m); }
  { const m = new T.Mesh(bGeo, bMat); m.position.set(3170, 181, 3810); group.add(m); beacons.push(m); }
  scene.add(group);
  let t = 0;
  return {
    group,
    // night : 0 (jour) → 1 (nuit)
    tick(dt, night) {
      t += dt;
      for (const m of nightMats) m.emissiveIntensity = night * 0.75;
      bMat.opacity = night > 0.15 ? (Math.sin(t * 3.2) > 0 ? 0.95 : 0.15) : 0;
    },
  };
}

// ============================================================
// v26 : enseignes lumineuses sur les toits des immeubles proches du
// périphérique (mots génériques, aucune marque) — éteintes le jour,
// néons allumés la nuit, quelques-unes clignotent
// ============================================================
const SIGNS = [
  ['HÔTEL', '#ff3b30'], ['HÔTEL ★★★', '#ffffff'], ['PHARMACIE', '#26d65a'], ['BRASSERIE', '#ffb020'],
  ['PARKING', '#3a8bff'], ['GARAGE', '#ff3b30'], ['CINÉMA', '#ff4fd8'], ['BUREAUX À LOUER', '#ffffff'],
  ['HÔPITAL', '#3a8bff'], ['RÉSIDENCE', '#ffb020'], ['CLINIQUE', '#26d65a'], ['DANCING', '#ff4fd8'],
];
function signAtlas(T) {
  const W = 1024, H = 64 * SIGNS.length, cv = canvas(W, H), c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  SIGNS.forEach(([txt, col], i) => {
    const y = i * 64;
    c.font = '900 46px "Arial Black", Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = col; c.shadowBlur = 14;
    c.fillStyle = col; c.fillText(txt, W / 2, y + 34);
    c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillText(txt, W / 2, y + 34);
    if (txt === 'PHARMACIE') { c.fillStyle = col; c.fillRect(70, y + 22, 36, 12); c.fillRect(82, y + 10, 12, 36); }
  });
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function buildRooftopSigns(T, scene, scenery, track) {
  const B = new Batch(), BF = new Batch(), p = {};
  const frameC = rgb(0x2a2d31);
  let n = 0;
  for (const list of scenery.byChunk.values()) for (const b of list) {
    if (b.kind !== 'box' || b.custom || !(b.dist < 95) || b.h < 14 || b.h > 45 || b.w * b.d < 260) continue;
    const hsh = (Math.imul(Math.round(b.cx * 7 + b.cz * 13), 2654435761) >>> 0);
    if (hsh % 100 >= 4) continue;
    const pr = scenery.index.project(b.cx, b.cz);
    if (!pr) continue;
    track.pointAt(pr.s, p);
    // panneau dressé au centre du toit, face au périphérique
    const k = (hsh >>> 8) % SIGNS.length, len = Math.min(16, Math.max(8, Math.max(b.w, b.d) * 0.6)), hh = len * 0.16;
    const side = pr.lat > 0 ? 1 : -1;
    const ux = p.tx, uz = p.tz;                       // le long de la route
    const y0 = (b.y0 || 0) + b.h + 0.6, cx = b.cx, cz = b.cz;
    const a = [cx - ux * len / 2, cz - uz * len / 2], c2 = [cx + ux * len / 2, cz + uz * len / 2];
    const v0 = 1 - (k + 1) / SIGNS.length, v1 = 1 - k / SIGNS.length;
    // lecture correcte depuis la chaussée (côté route = -side * r)
    const [l, r] = side > 0 ? [c2, a] : [a, c2];
    const w = rgb(0xffffff);
    B.quad(B.v(l[0], y0, l[1], 0.02, v0, w), B.v(r[0], y0, r[1], 0.98, v0, w), B.v(r[0], y0 + hh, r[1], 0.98, v1, w), B.v(l[0], y0 + hh, l[1], 0.02, v1, w));
    // structure métallique (deux pieds + traverse)
    for (const q of [a, c2]) for (const dd of [0.12, -0.12]) {
      const o = [q[0] + p.rx * dd * side, q[1] + p.rz * dd * side];
      BF.quad(BF.v(q[0], y0 - 0.6, q[1], 0, 0, frameC), BF.v(o[0], y0 - 0.6, o[1], 0, 0, frameC), BF.v(o[0], y0 + hh, o[1], 0, 0, frameC), BF.v(q[0], y0 + hh, q[1], 0, 0, frameC));
    }
    n++;
  }
  const group = new T.Group();
  const tex = signAtlas(T);
  const mat = new T.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: T.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, depthWrite: false });
  const g = B.build(T);
  if (g) { const m = new T.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 2; group.add(m); }
  const gf = BF.build(T);
  if (gf) { const m = new T.Mesh(gf, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); m.frustumCulled = false; group.add(m); }
  scene.add(group);
  let t = 0;
  return { group, count: n, tick(dt, night) { t += dt; mat.emissiveIntensity = night * (1.25 + 0.25 * Math.sin(t * 9) * (Math.sin(t * 0.7) > 0.6 ? 1 : 0)); } };
}
