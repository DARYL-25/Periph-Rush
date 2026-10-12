// ============================================================
// Périph' Rush — v17 : monuments emblématiques modélisés en détail
// (au bord du périphérique, visibles de près, positions réelles)
//  • Parc des Princes (R. Taillibert, 1972) : 50 consoles de béton
//    précontraint dont la crête ondule, auvent en porte-à-faux,
//    coursives, tribunes et pelouse ; le BP passe dessous (couverture).
//  • Tour TF1 (quai du Point du Jour, Boulogne) : tour cylindrique de
//    verre bleuté couronnée d'un bandeau, immeubles de verre en gradins
//    et proue vitrée au bord de la Seine (aucun logo reproduit).
//  • Pavillon Habib-Bourguiba (Maison de la Tunisie, Cité U, 2020) :
//    volume aux angles arrondis enveloppé d'une résille d'aluminium
//    évoquant la calligraphie (motif procédural, pas l'œuvre originale).
// Tout est construit une fois, en coordonnées monde (X est, Z sud).
// ============================================================

import { Batch, rgb, shade } from './geo.js';
import { rng } from './utils.js';

// même projection que scenery.js (évite un import circulaire)
const LAT0 = 48.8590, LON0 = 2.3400, M_LAT = 111132, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const geoToLocal = (lat, lon) => ({ x: (lon - LON0) * M_LON, z: -(lat - LAT0) * M_LAT });

// zones où les bâtiments OSM génériques sont retirés (remplacés par les modèles)
export const LANDMARK_ZONES = [
  { lat: 48.84144, lon: 2.25305, r: 128, name: 'Parc des Princes' },
  { lat: 48.83385, lon: 2.26050, r: 48, name: 'Tour TF1' },
  { lat: 48.81917, lon: 2.33186, r: 24, name: 'Pavillon Habib-Bourguiba' },
];

// --- textures ---
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(T, cv, repeat = true) {
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
// verre bleuté : trames d'étages + meneaux, reflets de ciel en dégradé
function glassTexture(T) {
  const W = 256, H = 256, cv = canvas(W, H), c = cv.getContext('2d'), r = rng(717);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7fa6c4'); g.addColorStop(0.5, '#6a93b6'); g.addColorStop(1, '#5d86a8');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.08})`; c.fillRect(r() * W, 0, 6 + r() * 30, H); }
  c.fillStyle = 'rgba(30,45,60,0.85)';
  for (let y = 0; y < H; y += 64) c.fillRect(0, y, W, 5);       // nez de dalle (1 étage = 1/4 de tuile)
  c.fillStyle = 'rgba(200,215,225,0.55)';
  for (let x = 0; x < W; x += 32) c.fillRect(x, 0, 2, H);        // meneaux
  return texOf(T, cv);
}
// résille « calligraphique » : traits blancs larges, pleins et déliés, sur fond gris anthracite
function calligraphyTexture(T) {
  const S = 1024, cv = canvas(S, S), c = cv.getContext('2d'), r = rng(2020);
  c.fillStyle = '#3d4246'; c.fillRect(0, 0, S, S);
  // fenêtres sombres derrière la résille
  c.fillStyle = '#23272b';
  for (let y = 40; y < S; y += 128) for (let x = 24; x < S; x += 96) c.fillRect(x, y, 56, 70);
  const stroke = (x, y, len, ang, w) => {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath();
    c.moveTo(-len / 2, -w * 0.15);
    c.quadraticCurveTo(0, -w * (0.9 + r() * 0.6), len / 2, -w * 0.5);
    c.lineTo(len / 2 - w * 0.4, w * 0.25);
    c.quadraticCurveTo(0, w * (0.1 + r() * 0.3), -len / 2 + w * 0.3, w * 0.45);
    c.closePath();
    c.fill();
    c.restore();
  };
  for (let i = 0; i < 520; i++) {
    const v = 0.78 + r() * 0.2;
    c.fillStyle = `rgb(${Math.round(222 * v + 30)},${Math.round(222 * v + 30)},${Math.round(218 * v + 30)})`;
    const x = r() * S, y = r() * S, len = 40 + r() * 110, w = 9 + r() * 16, ang = (r() - 0.5) * 2.2;
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) stroke(x + dx, y + dy, len, ang, w);
    if (r() < 0.25) { // points diacritiques
      c.beginPath(); c.ellipse(x + 30, y - 26, 7, 5, ang, 0, Math.PI * 2); c.fill();
    }
  }
  return texOf(T, cv);
}
// bandeau de couronnement de la tour TF1 (couleurs, sans logo)
function crownTexture(T) {
  const W = 512, H = 64, cv = canvas(W, H), c = cv.getContext('2d');
  c.fillStyle = '#e9edf0'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const x = i * 128;
    c.fillStyle = '#c8102e'; c.fillRect(x + 14, 14, 40, 36);
    c.fillStyle = '#1d4f9c'; c.fillRect(x + 58, 14, 56, 36);
  }
  c.fillStyle = '#9aa3aa'; c.fillRect(0, 0, W, 5); c.fillRect(0, H - 5, W, 5);
  return texOf(T, cv);
}

// --- primitives (Batch à couleur de sommet ; uv pour les textures répétées) ---
function prism(B, pts2, y0, y1, col, uvScale = null) {
  // pts2 : polygone [x,z] (sens quelconque) extrudé verticalement
  const n = pts2.length;
  let per = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts2[i], [x1, z1] = pts2[(i + 1) % n];
    const L = Math.hypot(x1 - x0, z1 - z0);
    const u0 = uvScale ? per / uvScale[0] : 0, u1 = uvScale ? (per + L) / uvScale[0] : 1;
    const v0 = uvScale ? y0 / uvScale[1] : 0, v1 = uvScale ? y1 / uvScale[1] : 1;
    const c = shade(col, 0.9 + 0.1 * Math.abs(Math.cos(Math.atan2(z1 - z0, x1 - x0) + 0.6)));
    B.quad(B.v(x0, y0, z0, u0, v0, c), B.v(x1, y0, z1, u1, v0, c), B.v(x1, y1, z1, u1, v1, c), B.v(x0, y1, z0, u0, v1, c));
    per += L;
  }
}
function cap(T, B, pts2, y, col) {
  const tris = T.ShapeUtils.triangulateShape(pts2.map(([x, z]) => new T.Vector2(x, z)), []);
  const ids = pts2.map(([x, z]) => B.v(x, y, z, x / 8, z / 8, col));
  for (const [a, b, c] of tris) B.tri(ids[a], ids[c], ids[b]);
  for (const [a, b, c] of tris) B.tri(ids[a], ids[b], ids[c]);
}
function roundedRect(cx, cz, w, d, rad, ang, seg = 6) {
  const pts = [], hw = w / 2 - rad, hd = d / 2 - rad;
  const corners = [[hw, hd, 0], [-hw, hd, Math.PI / 2], [-hw, -hd, Math.PI], [hw, -hd, Math.PI * 1.5]];
  for (const [ox, oz, a0] of corners) for (let k = 0; k <= seg; k++) {
    const a = a0 + (k / seg) * (Math.PI / 2);
    pts.push([ox + Math.cos(a) * rad, oz + Math.sin(a) * rad]);
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return pts.map(([u, v]) => [cx + u * ca - v * sa, cz + u * sa + v * ca]);
}

// ============================================================
// Parc des Princes
// ============================================================
function parcDesPrinces(T, B) {
  const { x: X, z: Z } = geoToLocal(48.84144, 2.25305);
  const A = 116, Bv = 88;                 // demi-axes de l'anneau des consoles (m)
  const rot = 0.30;                       // axe long ≈ NNE-SSO
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const W = (u, v) => [X + u * ca - v * sa, Z + u * sa + v * ca];
  const concrete = rgb(0xd5d2ca), concreteD = rgb(0xb5b1a8), dark = rgb(0x2a2d31), roofC = rgb(0xe4e5e2);
  const N = 50;
  const ribs = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const pu = A * Math.cos(th), pv = Bv * Math.sin(th);
    // normale extérieure de l'ellipse
    let nu = Math.cos(th) / A, nv = Math.sin(th) / Bv; const nl = Math.hypot(nu, nv); nu /= nl; nv /= nl;
    // hauteur ondulante : hautes au milieu des grands côtés, plus basses derrière les buts
    const H = 24 + 14 * Math.pow(Math.abs(Math.sin(th)), 1.6);
    const Lc = 30 + 10 * Math.abs(Math.sin(th));   // porte-à-faux de l'auvent
    ribs.push({ th, pu, pv, nu, nv, H, Lc });
  }
  // profil d'une console dans son plan radial (r > 0 vers l'extérieur, y vers le haut)
  const profile = (H, Lc) => [
    [0, 0], [2.6, H * 0.42], [2.0, H * 0.8], [0.6, H], [-1.2, H + 0.9],
    [-Lc, H - 1.8], [-Lc, H - 3.2], [-16, H - 8.5], [-10.5, H * 0.5], [-9, 0],
  ];
  const tris0 = (pr) => T.ShapeUtils.triangulateShape(pr.map(([a, b]) => new T.Vector2(a, b)), []);
  for (const rb of ribs) {
    const pr = profile(rb.H, rb.Lc);
    const tu = -rb.nv, tv = rb.nu;          // tangente
    const half = 0.85;
    const P3 = (r, y, side) => { const [x, z] = W(rb.pu + rb.nu * r + tu * half * side, rb.pv + rb.nv * r + tv * half * side); return [x, y, z]; };
    const tris = tris0(pr);
    for (const side of [-1, 1]) {
      const ids = pr.map(([r, y]) => { const p = P3(r, y, side); return B.v(p[0], p[1], p[2], 0, 0, shade(concrete, side > 0 ? 1.0 : 0.93)); });
      for (const [a, b, c] of tris) { if (side > 0) B.tri(ids[a], ids[b], ids[c]); else B.tri(ids[a], ids[c], ids[b]); }
    }
    for (let k = 0; k < pr.length; k++) {
      const [r0, y0] = pr[k], [r1, y1] = pr[(k + 1) % pr.length];
      const a = P3(r0, y0, -1), b = P3(r1, y1, -1), c = P3(r1, y1, 1), d = P3(r0, y0, 1);
      const col = shade(concrete, k < 3 ? 1.04 : 0.88);
      B.quad(B.v(...a, 0, 0, col), B.v(...b, 0, 0, col), B.v(...c, 0, 0, col), B.v(...d, 0, 0, col));
    }
  }
  // auvent (couverture translucide) entre consoles : suit la crête intérieure
  for (let i = 0; i < N; i++) {
    const a = ribs[i], b = ribs[(i + 1) % N];
    const pts = [];
    for (const [rb, fr] of [[a, 0], [b, 0], [b, 1], [a, 1]]) {
      const r = fr ? -rb.Lc + 0.6 : -1.0, y = fr ? rb.H - 2.0 : rb.H + 0.4;
      const [x, z] = W(rb.pu + rb.nu * r, rb.pv + rb.nv * r);
      pts.push([x, y, z]);
    }
    const col = shade(roofC, 0.95 + (i % 2) * 0.04);
    B.quad(B.v(...pts[0], 0, 0, col), B.v(...pts[1], 0, 0, col), B.v(...pts[2], 0, 0, col), B.v(...pts[3], 0, 0, col));
    B.quad(B.v(...pts[3], 0, 0, col), B.v(...pts[2], 0, 0, col), B.v(...pts[1], 0, 0, col), B.v(...pts[0], 0, 0, col));
    // sous-face sombre de l'auvent
    const under = pts.map((p) => [p[0], p[1] - 0.7, p[2]]);
    const cu = rgb(0x6f6c66);
    B.quad(B.v(...under[3], 0, 0, cu), B.v(...under[2], 0, 0, cu), B.v(...under[1], 0, 0, cu), B.v(...under[0], 0, 0, cu));
  }
  // façade entre consoles : coursives horizontales et remplissages sombres (retrait de 3 m)
  for (let i = 0; i < N; i++) {
    const a = ribs[i], b = ribs[(i + 1) % N];
    const at = (rb, r) => W(rb.pu + rb.nu * r, rb.pv + rb.nv * r);
    const [ax, az] = at(a, -3), [bx, bz] = at(b, -3);
    const top = Math.min(a.H, b.H) * 0.86;
    B.quad(B.v(ax, 0, az, 0, 0, dark), B.v(bx, 0, bz, 0, 0, dark), B.v(bx, top, bz, 0, 0, dark), B.v(ax, top, az, 0, 0, dark));
    for (const y of [4.2, 11.5, 18.5, 25.5]) {
      if (y > top - 1) break;
      const [a2x, a2z] = at(a, -1.6), [b2x, b2z] = at(b, -1.6);
      const c = concreteD;
      B.quad(B.v(a2x, y, a2z, 0, 0, c), B.v(b2x, y, b2z, 0, 0, c), B.v(b2x, y + 1.1, b2z, 0, 0, c), B.v(a2x, y + 1.1, a2z, 0, 0, c));
      B.quad(B.v(a2x, y + 1.1, a2z, 0, 0, c), B.v(b2x, y + 1.1, b2z, 0, 0, c), B.v(bx, y + 1.1, bz, 0, 0, c), B.v(ax, y + 1.1, az, 0, 0, c));
    }
  }
  // tribunes (gradins en béton) et pelouse
  const ring = (k, n = 64) => { const out = []; for (let i = 0; i < n; i++) { const th = (i / n) * Math.PI * 2; out.push(W(A * k * Math.cos(th), Bv * k * Math.sin(th))); } return out; };
  const outerR = ring(0.92), innerR = ring(0.56);
  for (let i = 0; i < outerR.length; i++) {
    const j = (i + 1) % outerR.length;
    const [o0x, o0z] = outerR[i], [o1x, o1z] = outerR[j], [i0x, i0z] = innerR[i], [i1x, i1z] = innerR[j];
    const c = shade(rgb(0x8f8f92), 0.9 + (i % 3) * 0.04);
    B.quad(B.v(i0x, 1.2, i0z, 0, 0, c), B.v(i1x, 1.2, i1z, 0, 0, c), B.v(o1x, 26, o1z, 0, 0, c), B.v(o0x, 26, o0z, 0, 0, c));
  }
  cap(T, B, ring(0.56, 48), 0.6, rgb(0x3f7a35));
}

// ============================================================
// Tour TF1 et immeubles de verre du quai du Point du Jour
// ============================================================
function tourTF1(T, BG, BC, BS) {
  const { x: X, z: Z } = geoToLocal(48.83385, 2.26050);
  const ang = -0.72;                          // le long du quai (Seine)
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const W = (u, v) => [X + u * ca - v * sa, Z + u * sa + v * ca];
  const glass = rgb(0xffffff), frame = rgb(0x9aa4ab);
  // tour cylindrique (légèrement ovale) — 68 m
  const [tx, tz] = W(26, -6);
  const cyl = [];
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; cyl.push([tx + Math.cos(a) * 15.5, tz + Math.sin(a) * 13]); }
  prism(BG, cyl, 0, 62, glass, [16, 16]);
  prism(BC, cyl.map(([x, z]) => [x + (x - tx) * 0.04, z + (z - tz) * 0.04]), 62, 68, glass, [97 / 4, 6]);
  cap(T, BS, cyl, 68, rgb(0xb7bec4));
  // immeuble principal en gradins (verre)
  const block = (u, v, w, d, h) => { const p = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => W(u + a, v + b)); prism(BG, p, 0, h, glass, [16, 16]); cap(T, BS, p, h, rgb(0x8e979e)); return p; };
  block(-8, 0, 46, 30, 38);
  block(-38, 2, 22, 26, 30);
  block(4, 14, 26, 18, 44);
  // proue vitrée inclinée (côté amont)
  {
    const p0 = W(-66, -14), p1 = W(-48, -14), p2 = W(-48, 14), p3 = W(-66, 14);
    const c = glass;
    const top0 = W(-56, -14), top3 = W(-56, 14);
    BG.quad(BG.v(p0[0], 0, p0[1], 0, 0, c), BG.v(p3[0], 0, p3[1], 28 / 16, 0, c), BG.v(top3[0], 34, top3[1], 28 / 16, 34 / 16, c), BG.v(top0[0], 34, top0[1], 0, 34 / 16, c));
    BG.quad(BG.v(p1[0], 0, p1[1], 0, 0, c), BG.v(p0[0], 0, p0[1], 1, 0, c), BG.v(top0[0], 34, top0[1], 1, 2, c), BG.v(p1[0], 34, p1[1], 0, 2, c));
    BG.quad(BG.v(p3[0], 0, p3[1], 0, 0, c), BG.v(p2[0], 0, p2[1], 1, 0, c), BG.v(p2[0], 34, p2[1], 1, 2, c), BG.v(top3[0], 34, top3[1], 0, 2, c));
    BG.quad(BG.v(p2[0], 0, p2[1], 0, 0, c), BG.v(p1[0], 0, p1[1], 2, 0, c), BG.v(p1[0], 34, p1[1], 2, 2, c), BG.v(p2[0], 34, p2[1], 0, 2, c));
    cap(T, BS, [top0, p1, p2, top3], 34, rgb(0x8e979e));
  }
  // paraboles et mâts techniques sur les toits
  for (const [u, v, s] of [[-14, -6, 2.6], [-6, 8, 3.2], [2, -8, 2.2]]) {
    const [x, z] = W(u, v);
    const dish = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; dish.push([x + Math.cos(a) * s, z + Math.sin(a) * s * 0.4]); }
    prism(BS, dish, 38.2, 38.2 + s * 1.6, rgb(0xf0f1f2));
  }
  void frame;
}

// ============================================================
// Pavillon Habib-Bourguiba (Maison de la Tunisie)
// ============================================================
function pavillonBourguiba(T, BK, BG, BS, track) {
  const { x: X, z: Z } = geoToLocal(48.81917, 2.33186);
  // orientation : parallèle au périphérique tout proche
  let ang = 0;
  if (track) {
    let best = 1e18, bs = 0; const p = {};
    for (let s = 0; s < track.length; s += 20) { track.pointAt(s, p); const d = (p.x - X) ** 2 + (p.z - Z) ** 2; if (d < best) { best = d; bs = s; } }
    track.pointAt(bs, p); ang = Math.atan2(p.tz, p.tx);
  }
  const plan = roundedRect(X, Z, 38, 19, 7.5, ang, 6);
  prism(BG, plan.map(([x, z]) => [X + (x - X) * 0.97, Z + (z - Z) * 0.97]), 0, 3.8, rgb(0xffffff), [6, 8]);   // rez-de-chaussée vitré
  prism(BK, plan, 3.8, 28.5, rgb(0xffffff), [26, 26]);                                                    // résille calligraphique
  cap(T, BS, plan, 28.5, rgb(0x5b6065));
  cap(T, BS, plan, 3.8, rgb(0x4a4e52));
  // acrotère
  const inner = plan.map(([x, z]) => [X + (x - X) * 0.96, Z + (z - Z) * 0.96]);
  prism(BS, inner, 28.5, 29.4, rgb(0x6b7075));
}

// ============================================================
export function buildDetailedLandmarks(T, scene, track, opts = {}) {
  const group = new T.Group();
  const B = new Batch(), BS = new Batch(), BG = new Batch(), BC = new Batch(), BK = new Batch();
  if (opts.parc !== false) parcDesPrinces(T, B);
  tourTF1(T, BG, BC, BS);
  pavillonBourguiba(T, BK, BG, BS, track);
  const add = (batch, mat) => { const g = batch.build(T); if (!g) return; const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; group.add(m); };
  const DS = T.DoubleSide;
  add(B, new T.MeshLambertMaterial({ vertexColors: true, side: DS }));
  add(BS, new T.MeshLambertMaterial({ vertexColors: true, side: DS }));
  add(BG, new T.MeshPhongMaterial({ map: glassTexture(T), vertexColors: true, shininess: 90, specular: 0x8899aa, side: DS }));
  add(BC, new T.MeshLambertMaterial({ map: crownTexture(T), vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.15, side: DS }));
  add(BK, new T.MeshLambertMaterial({ map: calligraphyTexture(T), vertexColors: true, side: DS }));
  scene.add(group);
  return group;
}
