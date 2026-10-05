// ============================================================
// Périph' Rush — signalisation du périphérique (réglementation française)
// Textures canvas générées à la volée et mises en cache :
//  • panneaux directionnels : fond BLANC / texte noir pour les portes
//    (pôles locaux), fond BLEU pour les autoroutes, VERT pour les
//    itinéraires principaux ; cartouches A/N rouges, D jaunes, E verts ;
//    flèches de sortie obliques à tête pleine
//  • limitation 50, radar, voie réservée (losange), signaux d'affectation
//    de voies (tunnels), borne SOS, plaques PR (soulignées de rouge),
//    PMV à LED ambre (temps de parcours), panneaux de chantier
// Police : Barlow Semi Condensed (OFL), proche des « Caractères » L1/L2.
// ============================================================

import { drawSignText, signTextWidth, drawRich, richWidth, porteSegments, L1, L2 } from './signfont.js';

const texCache = new Map();
const FONT = '"PR Sign", "Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const PPM = 128; // pixels de texture par mètre de panneau

export async function loadSignFont() {
  if (typeof FontFace === 'undefined') return;
  try {
    const f500 = new FontFace('PR Sign', 'url(fonts/barlow-semi-condensed-latin-500-normal.woff2)', { weight: '500' });
    const f600 = new FontFace('PR Sign', 'url(fonts/barlow-semi-condensed-latin-600-normal.woff2)', { weight: '600' });
    await Promise.all([f500.load(), f600.load()]);
    document.fonts.add(f500); document.fonts.add(f600);
  } catch (e) { /* repli sur les polices système */ }
}

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(8, Math.round(w)); cv.height = Math.max(8, Math.round(h));
  return cv;
}
function finish(THREE, cv, key, meta = {}) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const out = { tex, w: cv.width / PPM, h: cv.height / PPM, ...meta };
  if (key) texCache.set(key, out);
  return out;
}
function font(px, weight = 600) { return `${weight} ${px}px ${FONT}`; }
// lettrage réglementaire : capitales façon « Caractères » (L1 sur fond clair, L2 sur fond foncé)
const CAP = 0.72;
const isLight = (c) => /^#(f|e)/i.test(c);
function textW(ctx, txt, px, weight, color = '#111') { return signTextWidth(txt, px * CAP, isLight(color) ? L2 : L1); }
function text(ctx, txt, x, y, px, color, align = 'left', weight = 600) {
  drawSignText(ctx, txt, x, y, px * CAP, color, align, isLight(color) ? L2 : L1);
}
function textSys(ctx, txt, x, y, px, color, align = 'left', weight = 600) {
  ctx.font = font(px, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, x, y + px * 0.04);
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// patine : léger dégradé de rétroréflexion + salissures
function weather(ctx, w, h, k = 1) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `rgba(255,255,255,${0.05 * k})`);
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.07 * k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60 * k; i++) {
    ctx.fillStyle = `rgba(60,55,45,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, h * (0.6 + Math.random() * 0.4), 2 + Math.random() * 10, 1 + Math.random() * 6);
  }
}

// --- couleurs réglementaires ---
const COL = {
  white: { bg: '#f6f7f4', fg: '#111111', border: '#111111' },
  blue: { bg: '#1d4f9c', fg: '#ffffff', border: '#ffffff' },
  green: { bg: '#127548', fg: '#ffffff', border: '#ffffff' },
  yellow: { bg: '#f5c400', fg: '#111111', border: '#111111' },
  brown: { bg: '#6b4426', fg: '#ffffff', border: '#ffffff' },
};

// cartouche d'identification de route
function drawRef(ctx, ref, x, yMid, px) {
  const kind = ref[0];
  const bg = kind === 'D' ? '#f5c400' : kind === 'E' ? '#127548' : '#c8102e';
  const fg = kind === 'D' ? '#111' : '#fff';
  const w = textW(ctx, ref, px, 600, fg) + px * 0.6, h = px * 1.15;
  ctx.fillStyle = bg; rrect(ctx, x, yMid - h / 2, w, h, px * 0.14); ctx.fill();
  ctx.strokeStyle = fg; ctx.lineWidth = px * 0.06;
  rrect(ctx, x + px * 0.08, yMid - h / 2 + px * 0.08, w - px * 0.16, h - px * 0.16, px * 0.1); ctx.stroke();
  text(ctx, ref, x + w / 2, yMid, px, fg, 'center', 600);
  return w;
}
function refW(ctx, ref, px) { return textW(ctx, ref, px, 600, ref[0] === 'D' ? '#111' : '#fff') + px * 0.6; }

// flèche directionnelle française (fût + tête triangulaire pleine)
// angle : 0 = tout droit (haut), PI/4 = sortie à droite, PI/2 = droite, PI = bas
export function drawArrow(ctx, x, y, size, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  const sw = size * 0.17, hw = size * 0.42, hh = size * 0.42;
  ctx.fillRect(-sw / 2, -size / 2 + hh * 0.9, sw, size - hh * 0.9);
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(hw, -size / 2 + hh);
  ctx.lineTo(-hw, -size / 2 + hh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
// flèche d'affectation de voie « vers le bas » (portiques)
function drawDownArrow(ctx, x, y, size, color) { drawArrow(ctx, x, y, size, Math.PI, color); }

// ============================================================
// Panneau directionnel multi-lignes
// rows : [{ text, color:'white'|'blue'|'green', refs:['A 6'], arrow? }]
// opts : { arrow: 'up'|'exit'|'down'|null, header: '400 m' | 'Sortie', minW }
// Retourne { tex, w, h } (dimensions en mètres)
// ============================================================
export function directionPanel(THREE, rows, opts = {}) {
  const key = 'dir:' + JSON.stringify(rows) + JSON.stringify(opts);
  if (texCache.has(key)) return texCache.get(key);
  const px = 64;                     // hauteur de capitale ≈ 0,32 m (taille L1 courante)
  const rowH = px * 1.75, pad = px * 0.5;
  const meas = makeCanvas(4, 4).getContext('2d');
  const arrowZone = opts.arrow ? px * 1.9 : 0;
  let inner = opts.minW ? opts.minW * PPM : 0;
  for (const r of rows) {
    let w = textW(meas, r.text, px, 600, (COL[r.color] || COL.white).fg);
    for (const ref of r.refs || []) w += refW(meas, ref, px * 0.78) + px * 0.35;
    inner = Math.max(inner, w + pad * 2 + arrowZone);
  }
  const headerH = opts.header ? px * 1.25 : 0;
  const W = inner + px * 0.3, H = rows.length * rowH + headerH + px * 0.3;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  // fond du support (bordure générale suivant la 1re couleur)
  const base = COL[rows[0]?.color || 'white'];
  ctx.fillStyle = base.bg; rrect(ctx, 0, 0, W, H, px * 0.22); ctx.fill();
  let y = px * 0.15;
  if (opts.header) {
    ctx.fillStyle = base.bg; ctx.fillRect(px * 0.15, y, W - px * 0.3, headerH);
    text(ctx, opts.header, W - pad, y + headerH / 2, px * 0.82, base.fg, 'right', 600);
    y += headerH;
  }
  rows.forEach((r) => {
    const c = COL[r.color] || COL.white;
    ctx.fillStyle = c.bg; ctx.fillRect(px * 0.15, y, W - px * 0.3, rowH);
    let x = px * 0.15 + pad + arrowZone;
    text(ctx, r.text, x, y + rowH / 2, px, c.fg, 'left', 600);
    x += textW(ctx, r.text, px, 600, c.fg) + px * 0.35;
    for (const ref of r.refs || []) x += drawRef(ctx, ref, x, y + rowH / 2, px * 0.78) + px * 0.35;
    y += rowH;
  });
  // liseré
  ctx.strokeStyle = base.border; ctx.lineWidth = px * 0.07;
  rrect(ctx, px * 0.11, px * 0.11, W - px * 0.22, H - px * 0.22, px * 0.16); ctx.stroke();
  if (opts.arrow) {
    const ang = opts.arrow === 'exit' ? Math.PI / 4 : opts.arrow === 'down' ? Math.PI : opts.arrow === 'right' ? Math.PI / 2 : 0;
    drawArrow(ctx, px * 0.15 + pad + arrowZone * 0.42, headerH + (H - headerH) / 2, px * 1.5, ang, base.fg);
  }
  weather(ctx, W, H, 0.8);
  return finish(THREE, cv, key);
}

// Panneau de portique d'affectation : plusieurs colonnes au-dessus des voies
// cols : [{ rows:[...], arrow:'down'|'exit' }], largeur totale en mètres
export function gantryPanel(THREE, cols, totalW) {
  const key = 'gantry:' + JSON.stringify(cols) + totalW;
  if (texCache.has(key)) return texCache.get(key);
  const px = 64, rowH = px * 1.7;
  const maxRows = Math.max(...cols.map((c) => c.rows.length));
  const H = maxRows * rowH + px * 2.2;
  const W = totalW * PPM;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const colW = W / cols.length;
  cols.forEach((col, ci) => {
    if (!col.rows.length) return;
    const x0 = ci * colW + px * 0.12, w = colW - px * 0.24;
    const base = COL[col.rows[0].color] || COL.white;
    ctx.fillStyle = base.bg; rrect(ctx, x0, 0, w, H, px * 0.2); ctx.fill();
    let y = px * 0.25;
    for (const r of col.rows) {
      const c = COL[r.color] || COL.white;
      ctx.fillStyle = c.bg; ctx.fillRect(x0 + px * 0.12, y, w - px * 0.24, rowH);
      let tw = textW(ctx, r.text, px, 600, c.fg);
      let sz = px;
      const refsW = (r.refs || []).reduce((a, ref) => a + refW(ctx, ref, px * 0.78) + px * 0.3, 0);
      if (tw + refsW > w - px * 0.8) { sz = px * (w - px * 0.8 - refsW) / tw; tw = textW(ctx, r.text, sz, 600, c.fg); }
      let x = x0 + (w - tw - refsW) / 2;
      text(ctx, r.text, x, y + rowH / 2, sz, c.fg, 'left', 600);
      x += tw + px * 0.3;
      for (const ref of r.refs || []) x += drawRef(ctx, ref, x, y + rowH / 2, px * 0.78) + px * 0.3;
      y += rowH;
    }
    // flèche(s) d'affectation
    if (col.arrow === 'exit') drawArrow(ctx, x0 + w / 2, H - px * 1.0, px * 1.5, Math.PI * 0.75, base.fg);
    else drawDownArrow(ctx, x0 + w / 2, H - px * 1.0, px * 1.5, base.fg);
    ctx.strokeStyle = base.border; ctx.lineWidth = px * 0.07;
    rrect(ctx, x0 + px * 0.08, px * 0.08, w - px * 0.16, H - px * 0.16, px * 0.15); ctx.stroke();
  });
  weather(ctx, W, H, 0.7);
  return finish(THREE, cv, key, { transparent: true });
}

// ============================================================
// Panneaux du Boulevard périphérique (graphie réelle)
// Chaque mention est une plaque : blanche à liseré noir (portes, distance),
// bleue « vers [autoroute] A 1 », verte (pôles, aéroports avec pictogramme),
// plaque blanche vide. Cartouche D jaune + distance en italique (« 600 m »).
// lines : [{kind:'ref', ref, dist} | {kind:'vers', ref} | {kind:'green', text, plane}
//          | {kind:'porte', name} | {kind:'blank'}]
// ============================================================
const BP_CAP = 48;                      // hauteur de capitale (px) ≈ 0,31 m
const BP_H = BP_CAP * 1.95;             // hauteur d'une plaque
const PLATE = { white: ['#f4f5f2', '#1b1b1b'], blue: ['#1f4e9a', '#f4f5f2'], green: ['#0f7448', '#f4f5f2'] };

function motorwayPicto(ctx, x, y, s) { // pictogramme autoroute : pont + 2 chaussées fuyantes
  ctx.fillStyle = '#f4f5f2'; rrect(ctx, x, y, s, s, s * 0.12); ctx.fill();
  ctx.fillStyle = '#1f4e9a';
  const m = s * 0.12, w = s - 2 * m, top = y + m, bot = y + s - m;
  ctx.fillRect(x + m, top, w, w * 0.16);                                 // tablier du pont
  ctx.fillRect(x + m, top, w * 0.12, w * 0.42); ctx.fillRect(x + m + w * 0.88, top, w * 0.12, w * 0.42); // culées
  const hy = top + w * 0.24, cx = x + s / 2;
  for (const sd of [-1, 1]) {                                            // chaussées convergentes
    ctx.beginPath();
    ctx.moveTo(cx + sd * w * 0.06, bot); ctx.lineTo(cx + sd * w * 0.44, bot);
    ctx.lineTo(cx + sd * w * 0.08, hy); ctx.lineTo(cx + sd * w * 0.03, hy); ctx.closePath(); ctx.fill();
  }
}
function planePicto(ctx, x, y, s) { // pictogramme aéroport
  ctx.fillStyle = '#f4f5f2'; rrect(ctx, x, y, s, s, s * 0.08); ctx.fill();
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#111';
  const u = s / 10;
  ctx.beginPath();
  ctx.moveTo(0, -4.2 * u); ctx.lineTo(0.5 * u, -3.4 * u); ctx.lineTo(0.5 * u, -1 * u); ctx.lineTo(4 * u, 0.8 * u); ctx.lineTo(4 * u, 1.6 * u);
  ctx.lineTo(0.5 * u, 0.6 * u); ctx.lineTo(0.5 * u, 2.8 * u); ctx.lineTo(1.6 * u, 3.6 * u); ctx.lineTo(1.6 * u, 4.2 * u); ctx.lineTo(0, 3.7 * u);
  ctx.lineTo(-1.6 * u, 4.2 * u); ctx.lineTo(-1.6 * u, 3.6 * u); ctx.lineTo(-0.5 * u, 2.8 * u); ctx.lineTo(-0.5 * u, 0.6 * u); ctx.lineTo(-4 * u, 1.6 * u);
  ctx.lineTo(-4 * u, 0.8 * u); ctx.lineTo(-0.5 * u, -1 * u); ctx.lineTo(-0.5 * u, -3.4 * u); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function lineSegs(ln) {
  if (ln.kind === 'porte') return porteSegments(ln.name);
  if (ln.kind === 'green') return [{ t: ln.text, k: 'big' }];
  return [];
}
function lineWidthPx(ctx, ln) {
  const c = BP_CAP;
  if (ln.kind === 'porte') return richWidth(lineSegs(ln), c, L1);
  if (ln.kind === 'green') return richWidth(lineSegs(ln), c, L2) + (ln.plane ? c * 1.6 : 0);
  if (ln.kind === 'vers') return signTextWidth('vers', c, L2, { raw: true }) + c * 1.75 + signTextWidth(ln.ref, c, L2) + c * 0.5;
  if (ln.kind === 'ref') return (ln.ref ? signTextWidth(ln.ref, c * 0.9, L1) + c * 0.9 : 0) + c * 2 + (ln.dist ? signTextWidth(ln.dist, c, L1, { raw: true }) : 0);
  return 0;
}
export function bpStack(THREE, lines, minW = 0) {
  const key = 'bp:' + JSON.stringify(lines) + minW;
  if (texCache.has(key)) return texCache.get(key);
  const meas = makeCanvas(4, 4).getContext('2d');
  const c = BP_CAP, padX = c * 1.0;
  let W = minW * PPM;
  for (const ln of lines) W = Math.max(W, lineWidthPx(meas, ln) + padX * 2);
  W = Math.ceil(W);
  const H = Math.ceil(lines.length * BP_H + 4);
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  lines.forEach((ln, i) => {
    const y0 = i * BP_H + 2, ym = y0 + BP_H / 2;
    const col = ln.kind === 'vers' ? 'blue' : ln.kind === 'green' ? 'green' : 'white';
    const [bg, fg] = PLATE[col];
    ctx.fillStyle = bg; rrect(ctx, 1, y0, W - 2, BP_H - 2, 5); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = col === 'white' ? 3 : 2.5;
    rrect(ctx, col === 'white' ? 2.5 : 6, y0 + (col === 'white' ? 1.5 : 5), W - (col === 'white' ? 5 : 12), BP_H - (col === 'white' ? 5 : 12), 4); ctx.stroke();
    if (ln.kind === 'porte') drawRich(ctx, lineSegs(ln), W / 2, ym, c, fg, 'center', L1, W - padX * 1.2);
    else if (ln.kind === 'green') {
      const tw = richWidth(lineSegs(ln), c, L2), tot = tw + (ln.plane ? c * 1.6 : 0);
      let x = (W - tot) / 2;
      if (ln.plane) { planePicto(ctx, x, ym - c * 0.62, c * 1.24); x += c * 1.6; }
      drawRich(ctx, lineSegs(ln), x, ym, c, fg, 'left', L2);
    } else if (ln.kind === 'vers') {
      const tot = lineWidthPx(meas, ln) - c * 0.5;
      let x = (W - tot) / 2;
      x += drawSignText(ctx, 'vers', x, ym + c * 0.12, c * 0.95, fg, 'left', L2, 0, { raw: true, italic: true }) + c * 0.45;
      motorwayPicto(ctx, x, ym - c * 0.62, c * 1.24); x += c * 1.6;
      drawSignText(ctx, ln.ref, x, ym, c, fg, 'left', L2);
    } else if (ln.kind === 'ref') {
      if (ln.ref) { // cartouche départementale jaune à gauche
        const rw = signTextWidth(ln.ref, c * 0.9, L1) + c * 0.8, rh = c * 1.45;
        ctx.fillStyle = '#f2b800'; ctx.fillRect(c * 0.35, ym - rh / 2, rw, rh);
        drawSignText(ctx, ln.ref, c * 0.35 + rw / 2, ym, c * 0.9, '#111', 'center', L1);
      }
      if (ln.dist) drawSignText(ctx, ln.dist, W - c * 0.7, ym, c, '#111', 'right', L1, 0, { raw: true, italic: true });
    }
  });
  weather(ctx, W, H, 0.6);
  return finish(THREE, cv, key);
}

// conversion des destinations OSM en plaques réelles
const abbrev = (t) => t.replace(/Charles de Gaulle/i, 'Ch. de Gaulle').replace(/^Saint-/i, 'St-');
export function exitLines(dests, dist) {
  const lines = [];
  const white = dests.filter((d) => d[1] === 'white');
  const ref = (white.find((d) => d[2] && /^[DN]/.test(d[2])) || [])[2] || null;
  if (dist || ref) lines.push({ kind: 'ref', ref, dist: dist || null });
  const seen = new Set();
  for (const [, color, r] of dests) if (color === 'blue' && r && /^A/.test(r) && !seen.has(r)) { seen.add(r); lines.push({ kind: 'vers', ref: r }); }
  for (const [t, color] of dests) {
    if (/Orly|Charles de Gaulle|Roissy/i.test(t)) { const nm = /Orly/i.test(t) ? 'ORLY' : 'CH. DE GAULLE'; if (!lines.some((l) => l.text === nm)) lines.push({ kind: 'green', text: nm, plane: true }); }
    else if (color === 'green') lines.push({ kind: 'green', text: abbrev(t).toUpperCase().replace(' - ', '-') });
  }
  for (const [t, color] of dests) if (color === 'white') lines.push({ kind: 'porte', name: abbrev(t) });
  return lines;
}

// --- Limitation de vitesse (B14) -------------------------------------
export function speedLimitTexture(THREE, kmh = 50) {
  const key = `limit:${kmh}`;
  if (texCache.has(key)) return texCache.get(key);
  const S = 256, cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  ctx.fillStyle = '#c8102e';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6f7f4';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); ctx.fill();
  text(ctx, String(kmh), S / 2 - 2, S / 2, S * 0.5, '#111', 'center', 600);
  weather(ctx, S, S, 0.4);
  return finish(THREE, cv, key, { round: true });
}

// --- Annonce de radar automatique (modèle 2017) -------------------
// bordure jaune ; bandeau gris avec la vitesse limite ; pictogrammes noirs
// (voiture, moto, ondes radar) sur fond blanc
export function radarTexture(THREE, kmh = 50) {
  const key = 'radar:' + kmh;
  if (texCache.has(key)) return texCache.get(key);
  const W = 320, H = 480, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#f2c500'; rrect(ctx, 0, 0, W, H, 18); ctx.fill();          // bordure jaune
  ctx.fillStyle = '#8e9397'; rrect(ctx, 18, 18, W - 36, 200, 8); ctx.fill();   // bandeau gris
  ctx.fillStyle = '#f6f7f4'; rrect(ctx, 18, 222, W - 36, H - 240, 8); ctx.fill(); // fond blanc
  // vitesse limite (B14)
  const cx = W / 2, cy = 118, R = 86;
  ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6f7f4'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.74, 0, Math.PI * 2); ctx.fill();
  text(ctx, String(kmh), cx - 2, cy, R * 0.95, '#111', 'center', 600);
  // pictogramme voiture (profil)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(40, 352); ctx.lineTo(48, 322); ctx.lineTo(78, 316); ctx.lineTo(102, 290); ctx.lineTo(160, 290);
  ctx.lineTo(186, 318); ctx.lineTo(206, 322); ctx.lineTo(210, 352); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f6f7f4'; ctx.fillRect(108, 297, 22, 18); ctx.fillRect(136, 297, 22, 18);
  ctx.fillStyle = '#111';
  for (const x of [80, 170]) { ctx.beginPath(); ctx.arc(x, 354, 17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f6f7f4'; ctx.beginPath(); ctx.arc(x, 354, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111'; }
  // pictogramme moto
  ctx.lineWidth = 7; ctx.strokeStyle = '#111';
  for (const x of [72, 160]) { ctx.beginPath(); ctx.arc(x, 432, 19, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(72, 432); ctx.lineTo(104, 404); ctx.lineTo(140, 404); ctx.lineTo(160, 432); ctx.stroke();
  ctx.beginPath(); ctx.arc(118, 388, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(104, 396, 28, 10);
  // ondes radar
  ctx.lineWidth = 8; ctx.lineCap = 'round';
  for (const r of [26, 46, 66]) { ctx.beginPath(); ctx.arc(232, 380, r, -0.75, 0.75); ctx.stroke(); }
  ctx.fillRect(220, 364, 18, 32);
  weather(ctx, W, H, 0.5);
  return finish(THREE, cv, key);
}

// --- Voie réservée covoiturage (losange) -------------------------------
export function hovTexture(THREE, active = true) {
  const key = `hov:${active}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 384, H = 448, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c0d0e'; rrect(ctx, 0, 0, W, H, 18); ctx.fill();
  ctx.strokeStyle = '#3c4044'; ctx.lineWidth = 8; rrect(ctx, 6, 6, W - 12, H - 12, 14); ctx.stroke();
  // losange lumineux (points LED blancs)
  const cx = W / 2, cy = 175, rx = 110, ry = 140;
  ctx.fillStyle = active ? '#f2f6ff' : '#2a2c2f';
  for (let t = 0; t < 1; t += 1 / 64) {
    const a = t * Math.PI * 2;
    const x = cx + rx * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 1, y = cy + ry * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 1;
    const k = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));
    ctx.beginPath(); ctx.arc(cx + (x - cx) / k, cy + (y - cy) / k, 7, 0, Math.PI * 2); ctx.fill();
  }
  text(ctx, 'COVOITURAGE', W / 2, 360, 42, active ? '#f2f6ff' : '#3a3d40', 'center', 600);
  text(ctx, '2+', W / 2, 408, 40, active ? '#f2f6ff' : '#3a3d40', 'center', 600);
  return finish(THREE, cv, key);
}

// --- Signal d'affectation de voie (tunnels) : flèche verte / croix rouge ----
export function laneSignalTexture(THREE, open = true) {
  const key = `lanesig:${open}`;
  if (texCache.has(key)) return texCache.get(key);
  const S = 128, cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  ctx.fillStyle = '#0b0c0d'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = open ? '#39ff7a' : '#ff2b2b';
  const dots = [];
  if (open) { // flèche vers le bas
    for (let y = 18; y < 82; y += 10) dots.push([64, y]);
    for (let i = 1; i < 5; i++) { dots.push([64 - i * 10, 82 - i * 10]); dots.push([64 + i * 10, 82 - i * 10]); }
    dots.push([64, 92]);
  } else {
    for (let i = -4; i <= 4; i++) { dots.push([64 + i * 10, 64 + i * 10]); dots.push([64 + i * 10, 64 - i * 10]); }
  }
  for (const [x, y] of dots) { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
  return finish(THREE, cv, key);
}

// --- Borne d'appel d'urgence : panneau SOS -------------------------------
export function sosTexture(THREE) {
  const key = 'sos';
  if (texCache.has(key)) return texCache.get(key);
  const W = 192, H = 256, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#1d4f9c'; rrect(ctx, 0, 0, W, H, 14); ctx.fill();
  ctx.fillStyle = '#f6f7f4'; rrect(ctx, 22, 22, W - 44, 150, 8); ctx.fill();
  // combiné téléphonique
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(W / 2, 97, 46, 20, -0.0, Math.PI, 0); ctx.fill();
  ctx.fillRect(W / 2 - 50, 92, 26, 30); ctx.fillRect(W / 2 + 24, 92, 26, 30);
  text(ctx, 'SOS', W / 2, 212, 54, '#f6f7f4', 'center', 600);
  return finish(THREE, cv, key);
}

// --- Plaque PR (point repère, soulignée rouge = sens intérieur) -----------
export function prPlateTexture(THREE, km) {
  const key = `pr:${km}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 128, H = 160, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#f6f7f4'; rrect(ctx, 0, 0, W, H, 10); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; rrect(ctx, 5, 5, W - 10, H - 10, 8); ctx.stroke();
  text(ctx, String(km), W / 2, 62, 48, '#111', 'center', 600);
  ctx.fillStyle = '#c8102e'; ctx.fillRect(18, 108, W - 36, 16);
  text(ctx, 'BP', W / 2, 140, 22, '#111', 'center', 600);
  return finish(THREE, cv, key);
}

// --- Hauteur limitée (entrées de couverture) ---------------------------
export function heightLimitTexture(THREE, h = '4,50 m') {
  const key = `hlim:${h}`;
  if (texCache.has(key)) return texCache.get(key);
  const S = 256, cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6f7f4'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  for (const dir of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(S / 2 - 22, S / 2 + dir * 60); ctx.lineTo(S / 2 + 22, S / 2 + dir * 60); ctx.lineTo(S / 2, S / 2 + dir * 38); ctx.fill();
  }
  text(ctx, h, S / 2, S / 2, 46, '#111', 'center', 600);
  return finish(THREE, cv, key, { round: true });
}

// --- Plaque de nom de couverture / tunnel (fond blanc) -------------------
export function namePlateTexture(THREE, name) {
  const key = `plate:${name}`;
  if (texCache.has(key)) return texCache.get(key);
  const px = 56;
  const meas = makeCanvas(4, 4).getContext('2d');
  const W = textW(meas, name, px, 600) + px * 1.4, H = px * 1.7;
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#f6f7f4'; rrect(ctx, 0, 0, W, H, 10); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; rrect(ctx, 6, 6, W - 12, H - 12, 8); ctx.stroke();
  text(ctx, name, W / 2, H / 2, px, '#111', 'center', 600);
  weather(ctx, W, H, 0.5);
  return finish(THREE, cv, key);
}

// --- Balise de musoir (divergent) : chevrons jaune/noir -------------------
export function goreTexture(THREE) {
  const key = 'gore';
  if (texCache.has(key)) return texCache.get(key);
  const W = 256, H = 128, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#f5c400'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  for (let x = -H; x < W + H; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 + H * 0.5, H / 2); ctx.lineTo(x + 32, H); ctx.lineTo(x, H); ctx.lineTo(x + H * 0.5, H / 2); ctx.fill();
  }
  return finish(THREE, cv, key);
}

// ============================================================
// PMV — panneau à messages variables (LED ambre, matrice de points)
// ============================================================
export class VMSPanel {
  constructor(THREE, cols = 18, rows = 3) {
    this.cols = cols; this.rows = rows;
    this.cv = makeCanvas(768, 256);
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    // masque texte → points
    this.mask = makeCanvas(this.cv.width / 4, this.cv.height / 4);
    this.mctx = this.mask.getContext('2d', { willReadFrequently: true });
    this.last = '';
    this.setText(['PERIPHERIQUE', 'FLUIDE', '']);
  }
  setText(lines) {
    const key = lines.join('|');
    if (key === this.last) return;
    this.last = key;
    const { ctx, cv, mctx, mask } = this;
    // rendu basse résolution du texte (1 pixel = 1 LED)
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mask.width, mask.height);
    mctx.fillStyle = '#fff';
    mctx.textBaseline = 'middle';
    const lh = mask.height / 3;
    lines.slice(0, 3).forEach((ln, i) => {
      if (!ln) return;
      const parts = ln.split('\t'); // gauche \t droite (ex. destination \t temps)
      let fs = Math.round(lh * 0.82);
      mctx.font = `600 ${fs}px ${FONT}`;
      const wmax = mask.width - 10;
      const tw = mctx.measureText(parts.join('   ')).width;
      if (tw > wmax) { fs = Math.max(10, Math.floor(fs * wmax / tw)); mctx.font = `600 ${fs}px ${FONT}`; }
      if (parts.length > 1) {
        mctx.textAlign = 'left'; mctx.fillText(parts[0], 6, lh * (i + 0.55));
        mctx.textAlign = 'right'; mctx.fillText(parts[1], mask.width - 6, lh * (i + 0.55));
      } else {
        mctx.textAlign = 'center'; mctx.fillText(ln, mask.width / 2, lh * (i + 0.55));
      }
    });
    const data = mctx.getImageData(0, 0, mask.width, mask.height).data;
    ctx.fillStyle = '#0a0b0c'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        const v = data[(y * mask.width + x) * 4];
        ctx.fillStyle = v > 110 ? '#ffb21e' : '#1b1a17';
        ctx.beginPath(); ctx.arc(x * 4 + 2, y * 4 + 2, v > 110 ? 1.7 : 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = '#2b2e31'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, cv.width - 10, cv.height - 10);
    this.tex.needsUpdate = true;
  }
}

// --- Panneau chantier temporaire (jaune) ------------------------------
export function worksPanelTexture(THREE, label = 'TRAVAUX') {
  const key = `works:${label}`;
  if (texCache.has(key)) return texCache.get(key).tex;
  const cv = makeCanvas(512, 160);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f5c400';
  rrect(ctx, 0, 0, 512, 160, 12); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 8;
  rrect(ctx, 8, 8, 496, 144, 8); ctx.stroke();
  text(ctx, label, 256, 84, 66, '#111', 'center', 600);
  return finish(THREE, cv, key).tex;
}
