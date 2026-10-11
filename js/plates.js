// ============================================================
// Périph' Rush — plaques d'immatriculation fictives (format SIV réel)
// Fond blanc réfléchissant, caractères bâtons noirs AB-123-CD,
// bande euro « F » à gauche (couronne d'étoiles), identifiant
// territorial à droite : logo de région EN HAUT, département EN BAS.
// Pondération Île-de-France + plaques étrangères occasionnelles.
// ============================================================

import { pick, pickWeighted } from './utils.js';

// I, O et U sont exclus du SIV ; on reste simple
const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

const DEPTS = ['75', '92', '93', '94', '77', '78', '91', '95', '69', '13', '59', '01', '74', '60', '44', '33', '31', '34', '06', '84', '76', '38', '67', '35'];
const DEPT_W = [20, 16, 14, 14, 9, 9, 8, 8, 3, 3, 2, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

// région (couleurs du petit logo) par département — évocation stylisée,
// aucune reproduction exacte de logo déposé
const REGION = {
  idf: { depts: ['75', '77', '78', '91', '92', '93', '94', '95'], draw: 'star' },       // pétales rouge/bleu
  ara: { depts: ['69', '01', '74', '38'], draw: 'bands' },                              // bandes bleu/vert/rouge
  occ: { depts: ['31', '34'], draw: 'cross' },                                          // croix rouge
  paca: { depts: ['13', '84', '06'], draw: 'sun' },                                     // soleil rouge/or
  hdf: { depts: ['59', '60', '80'], draw: 'heart' },                                    // cœur-carte vert
  na: { depts: ['33'], draw: 'lion' },                                                  // rouge/or
  pdl: { depts: ['44'], draw: 'map' },
  nor: { depts: ['76'], draw: 'lion' },
  ge: { depts: ['67'], draw: 'map' },
  bre: { depts: ['35'], draw: 'bzh' },                                                  // hermines
};
function regionOf(dept) {
  for (const k of Object.keys(REGION)) if (REGION[k].depts.includes(dept)) return REGION[k].draw;
  return 'map';
}

// pays étrangers : [code bande, fond, texte, format]
const FOREIGN = [
  { c: 'D',  bg: '#f4f6f8', fg: '#101418', fmt: (r) => `${L(r)}${L(r)} ${L(r)}${L(r)} ${D(r)}${D(r)}${D(r)}` },
  { c: 'NL', bg: '#f7b500', fg: '#101418', fmt: (r) => `${L(r)}${L(r)}-${D(r)}${D(r)}${D(r)}-${L(r)}` },
  { c: 'B',  bg: '#f4f6f8', fg: '#a03030', fmt: (r) => `${D(r)}-${L(r)}${L(r)}${L(r)}-${D(r)}${D(r)}${D(r)}` },
  { c: 'CH', bg: '#f4f6f8', fg: '#101418', fmt: (r) => `${pick(r, ['GE', 'VD', 'ZH', 'BE'])} ${D(r)}${D(r)}${D(r)} ${D(r)}${D(r)}${D(r)}`, noBand: true },
  { c: 'L',  bg: '#f7b500', fg: '#101418', fmt: (r) => `${L(r)}${L(r)} ${D(r)}${D(r)}${D(r)}${D(r)}` },
  { c: 'E',  bg: '#f4f6f8', fg: '#101418', fmt: (r) => `${D(r)}${D(r)}${D(r)}${D(r)} ${L(r)}${L(r)}${L(r)}` },
  { c: 'GB', bg: '#f7b500', fg: '#101418', fmt: (r) => `${L(r)}${L(r)}${D(r)}${D(r)} ${L(r)}${L(r)}${L(r)}`, noBand: true },
];

function L(rand) { return LETTERS[(rand() * LETTERS.length) | 0]; }
function D(rand) { return String((rand() * 10) | 0); }

export function plateText(rand) {
  return `${L(rand)}${L(rand)}-${D(rand)}${D(rand)}${D(rand)}-${L(rand)}${L(rand)}`;
}

// petit logo régional stylisé dans le cartouche droit (au-dessus du n° de dept)
function drawRegionLogo(ctx, cx, cy, w, h, kind) {
  // fond blanc arrondi du sticker
  ctx.fillStyle = '#f6f8fa';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 3);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  if (kind !== 'star') ctx.scale(1.35, 1.35);
  switch (kind) {
    case 'star': { // étoile rouge à 8 branches (esprit Île-de-France, sans texte)
      ctx.fillStyle = '#e2231a';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 8, r = i % 2 ? 4 : 11;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r - 2);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1f5fb8'; ctx.fillRect(-12, 11, 24, 2.2);
      break;
    }
    case 'bands': {
      const cols = ['#0055a4', '#3aaa35', '#c8102e'];
      cols.forEach((c2, i) => {
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(-6 + i * 3, 8, 10, -Math.PI * 0.75, -Math.PI * 0.25);
        ctx.stroke();
      });
      break;
    }
    case 'cross': {
      ctx.fillStyle = '#c8102e';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
      for (const [px, py] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
        ctx.beginPath(); ctx.arc(px * 0.9, py * 0.9, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'sun': {
      ctx.fillStyle = '#e8b400';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c8102e';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 8.5, Math.sin(a) * 8.5);
        ctx.stroke();
      }
      break;
    }
    case 'heart': { // cœur-carte vert (esprit HdF, cf. référence)
      ctx.strokeStyle = '#3aaa35';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.quadraticCurveTo(-7, -7, -2.5, -6);
      ctx.quadraticCurveTo(0, -5, 0, -2.5);
      ctx.quadraticCurveTo(0, -5, 2.5, -6);
      ctx.quadraticCurveTo(7, -7, 5, -3);
      ctx.quadraticCurveTo(3.5, 1, 0, 6);
      ctx.quadraticCurveTo(-3.5, 1, -5, -3);
      ctx.stroke();
      break;
    }
    case 'lion': {
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.roundRect(-6, -6, 12, 12, 2);
      ctx.fill();
      ctx.fillStyle = '#e8b400';
      ctx.fillRect(-4, -1, 8, 2);
      ctx.fillRect(-1, -4, 2, 8);
      break;
    }
    case 'bzh': {
      ctx.fillStyle = '#14171a';
      for (const [px, py] of [[-4, -4], [4, -4], [0, 0], [-4, 4], [4, 4]]) {
        ctx.beginPath();
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 2.4, py + 2.4);
        ctx.lineTo(px - 2.4, py + 2.4);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    default: { // carte de France simplifiée bleue
      ctx.fillStyle = '#0055a4';
      ctx.beginPath();
      ctx.moveTo(-4, -6); ctx.lineTo(4, -5); ctx.lineTo(6, 0);
      ctx.lineTo(2, 6); ctx.lineTo(-3, 5); ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------
// Police « bâton » des plaques SIV, dessinée au trait (indépendante des
// polices de l'appareil) : chasse étroite, fût constant, panses arrondies.
// Coordonnées normalisées : a ∈ [0,1] (largeur), b ∈ [0,1] (hauteur)
// de la ligne médiane du trait. M/L = segments, Q = courbe quadratique,
// O = ovale (stade) plein, E = ellipse.
// ---------------------------------------------------------------
const OVAL = [['O', 0, 0, 1, 1]];
const GLYPHS = {
  A: [['M', 0, 1], ['L', 0.42, 0], ['L', 0.58, 0], ['L', 1, 1], ['M', 0.17, 0.68], ['L', 0.83, 0.68]],
  B: [['M', 0, 0], ['L', 0, 1], ['L', 0.52, 1], ['Q', 1, 1, 1, 0.735], ['Q', 1, 0.47, 0.5, 0.47], ['L', 0, 0.47], ['M', 0, 0], ['L', 0.5, 0], ['Q', 0.93, 0, 0.93, 0.235], ['Q', 0.93, 0.47, 0.5, 0.47]],
  C: [['M', 0.98, 0.2], ['Q', 0.9, 0, 0.5, 0], ['Q', 0, 0, 0, 0.3], ['L', 0, 0.7], ['Q', 0, 1, 0.5, 1], ['Q', 0.9, 1, 0.98, 0.8]],
  D: [['M', 0, 0], ['L', 0, 1], ['L', 0.45, 1], ['Q', 1, 1, 1, 0.7], ['L', 1, 0.3], ['Q', 1, 0, 0.45, 0], ['L', 0, 0]],
  E: [['M', 1, 0], ['L', 0, 0], ['L', 0, 1], ['L', 1, 1], ['M', 0, 0.48], ['L', 0.82, 0.48]],
  F: [['M', 1, 0], ['L', 0, 0], ['L', 0, 1], ['M', 0, 0.48], ['L', 0.82, 0.48]],
  G: [['M', 0.98, 0.2], ['Q', 0.9, 0, 0.5, 0], ['Q', 0, 0, 0, 0.3], ['L', 0, 0.7], ['Q', 0, 1, 0.5, 1], ['Q', 1, 1, 1, 0.7], ['L', 1, 0.52], ['L', 0.55, 0.52]],
  H: [['M', 0, 0], ['L', 0, 1], ['M', 1, 0], ['L', 1, 1], ['M', 0, 0.48], ['L', 1, 0.48]],
  I: [['M', 0.5, 0], ['L', 0.5, 1]],
  J: [['M', 1, 0], ['L', 1, 0.7], ['Q', 1, 1, 0.5, 1], ['Q', 0, 1, 0, 0.72]],
  K: [['M', 0, 0], ['L', 0, 1], ['M', 1, 0], ['L', 0.04, 0.64], ['M', 0.33, 0.42], ['L', 1, 1]],
  L: [['M', 0, 0], ['L', 0, 1], ['L', 1, 1]],
  M: [['M', 0, 1], ['L', 0, 0], ['L', 0.5, 0.62], ['L', 1, 0], ['L', 1, 1]],
  N: [['M', 0, 1], ['L', 0, 0], ['L', 1, 1], ['L', 1, 0]],
  O: OVAL,
  P: [['M', 0, 1], ['L', 0, 0], ['L', 0.5, 0], ['Q', 1, 0, 1, 0.27], ['Q', 1, 0.54, 0.5, 0.54], ['L', 0, 0.54]],
  Q: [...OVAL, ['M', 0.6, 0.76], ['L', 1, 1.04]],
  R: [['M', 0, 1], ['L', 0, 0], ['L', 0.5, 0], ['Q', 1, 0, 1, 0.27], ['Q', 1, 0.54, 0.5, 0.54], ['L', 0, 0.54], ['M', 0.45, 0.54], ['L', 1, 1]],
  S: [['M', 0.96, 0.15], ['Q', 0.85, 0, 0.5, 0], ['Q', 0.02, 0, 0.02, 0.26], ['Q', 0.02, 0.47, 0.5, 0.5], ['Q', 1, 0.53, 1, 0.75], ['Q', 1, 1, 0.5, 1], ['Q', 0.13, 1, 0.03, 0.85]],
  T: [['M', 0, 0], ['L', 1, 0], ['M', 0.5, 0], ['L', 0.5, 1]],
  U: [['M', 0, 0], ['L', 0, 0.72], ['Q', 0, 1, 0.5, 1], ['Q', 1, 1, 1, 0.72], ['L', 1, 0]],
  V: [['M', 0, 0], ['L', 0.5, 1], ['L', 1, 0]],
  W: [['M', 0, 0], ['L', 0.22, 1], ['L', 0.5, 0.32], ['L', 0.78, 1], ['L', 1, 0]],
  X: [['M', 0, 0], ['L', 1, 1], ['M', 1, 0], ['L', 0, 1]],
  Y: [['M', 0, 0], ['L', 0.5, 0.5], ['L', 1, 0], ['M', 0.5, 0.5], ['L', 0.5, 1]],
  Z: [['M', 0, 0], ['L', 1, 0], ['L', 0, 1], ['L', 1, 1]],
  0: OVAL,
  1: [['M', 0.12, 0.22], ['L', 0.64, 0], ['L', 0.64, 1]],
  2: [['M', 0.02, 0.2], ['Q', 0.1, 0, 0.5, 0], ['Q', 1, 0, 1, 0.28], ['Q', 1, 0.45, 0.75, 0.6], ['L', 0, 1], ['L', 1, 1]],
  3: [['M', 0.03, 0.14], ['Q', 0.15, 0, 0.5, 0], ['Q', 0.97, 0, 0.97, 0.24], ['Q', 0.97, 0.46, 0.42, 0.47], ['Q', 1, 0.48, 1, 0.74], ['Q', 1, 1, 0.5, 1], ['Q', 0.12, 1, 0.02, 0.85]],
  4: [['M', 0.72, 1], ['L', 0.72, 0], ['L', 0, 0.72], ['L', 1, 0.72]],
  5: [['M', 0.95, 0], ['L', 0.08, 0], ['L', 0.03, 0.46], ['Q', 0.25, 0.38, 0.52, 0.38], ['Q', 1, 0.38, 1, 0.68], ['Q', 1, 1, 0.5, 1], ['Q', 0.12, 1, 0.02, 0.86]],
  6: [['M', 0.92, 0.1], ['Q', 0.78, 0, 0.5, 0], ['Q', 0, 0, 0, 0.5], ['L', 0, 0.7], ['Q', 0, 1, 0.5, 1], ['Q', 1, 1, 1, 0.7], ['Q', 1, 0.41, 0.5, 0.41], ['Q', 0.08, 0.41, 0, 0.62]],
  7: [['M', 0, 0], ['L', 1, 0], ['L', 0.3, 1]],
  8: [['E', 0.5, 0.235, 0.44, 0.235], ['E', 0.5, 0.735, 0.5, 0.265]],
  9: null, // 6 retourné
};
GLYPHS[9] = GLYPHS[6].map((c) => {
  const o = [c[0]];
  for (let i = 1; i < c.length; i += 2) o.push(1 - c[i], 1 - c[i + 1]);
  return o;
});

// dessine un caractère dans la boîte (x, y, w, h), trait de largeur sw
function glyph(ctx, ch, x, y, w, h, sw) {
  const g = GLYPHS[ch];
  if (!g) return;
  const ix = x + sw / 2, iy = y + sw / 2, iw = w - sw, ih = h - sw;
  const X = (a) => ix + a * iw, Y = (b) => iy + b * ih;
  ctx.lineWidth = sw;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2.2;
  ctx.beginPath();
  for (const c of g) {
    if (c[0] === 'M') ctx.moveTo(X(c[1]), Y(c[2]));
    else if (c[0] === 'L') ctx.lineTo(X(c[1]), Y(c[2]));
    else if (c[0] === 'Q') ctx.quadraticCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]));
    else if (c[0] === 'O') { // stade : panses demi-cercles
      const r = iw / 2, cx = X(0.5), t = Y(0) + r, bo = Y(1) - r;
      ctx.moveTo(X(0), bo); ctx.lineTo(X(0), t);
      ctx.arc(cx, t, r, Math.PI, 0); ctx.lineTo(X(1), bo); ctx.arc(cx, bo, r, 0, Math.PI); ctx.closePath();
    } else if (c[0] === 'E') {
      ctx.moveTo(X(c[1] + c[3]), Y(c[2]));
      ctx.ellipse(X(c[1]), Y(c[2]), c[3] * iw, c[4] * ih, 0, 0, Math.PI * 2);
    }
  }
  ctx.stroke();
}

// texte complet centré dans [x0, x1], hauteur de caractère ch (mm à l'échelle du canvas)
function plateString(ctx, txt, x0, x1, yc, ch, cw, sw, gap, dashW) {
  let total = 0;
  for (const c of txt) total += c === '-' ? dashW + 2 * gap : c === ' ' ? cw * 0.6 : cw + gap;
  total -= gap;
  let x = (x0 + x1) / 2 - total / 2;
  const y = yc - ch / 2;
  for (const c of txt) {
    if (c === '-') { x += gap; ctx.fillRect(x, yc - sw * 0.62, dashW, sw * 1.24); x += dashW + gap; }
    else if (c === ' ') x += cw * 0.6;
    else { glyph(ctx, c, x, y, cw, ch, sw); x += cw + gap; }
  }
}

// étoile européenne à 5 branches
function star5(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// Plaque SIV aux proportions réglementaires : 520 × 110 mm, rendue à 1 px/mm.
// Caractères bâtons noirs de 75 mm de haut, bandes bleues de 44 mm.
function drawPlate(rand) {
  const W = 520, H = 110;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const foreign = rand() < 0.05 ? pick(rand, FOREIGN) : null;

  // fond blanc rétroréfléchissant + liseré noir fin + reflets
  const bg = foreign ? foreign.bg : '#f3f4f6';
  ctx.fillStyle = '#c9ccd0';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 9); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, foreign ? bg : '#fbfbfc'); g.addColorStop(1, foreign ? bg : '#e6e8eb');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(2, 2, W - 4, H - 4, 8); ctx.fill();
  if (!foreign) { // « TPMR » en filigrane du film réfléchissant
    ctx.fillStyle = 'rgba(160,165,172,0.10)';
    ctx.font = '700 9px Arial, sans-serif';
    for (let y = 14; y < H; y += 18) for (let x = (y / 18) % 2 ? 60 : 90; x < W - 50; x += 70) ctx.fillText('TPMR', x, y);
  }
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0.22, 'rgba(255,255,255,0)'); sheen.addColorStop(0.36, 'rgba(255,255,255,0.45)'); sheen.addColorStop(0.46, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H);

  const BAND = 44, PAD = 6;
  let x0 = 10, x1 = W - 10;
  if (!foreign || !foreign.noBand) {
    // bande euro : 12 étoiles jaunes + lettre du pays (blanche, police bâton)
    ctx.fillStyle = '#1f5fb8';
    ctx.beginPath(); ctx.roundRect(PAD, PAD, BAND, H - 2 * PAD, [5, 0, 0, 5]); ctx.fill();
    ctx.fillStyle = '#ffd400';
    const ecx = PAD + BAND / 2, ecy = 33, er = 14;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; star5(ctx, ecx + Math.cos(a) * er, ecy + Math.sin(a) * er, 3.1); }
    ctx.strokeStyle = '#ffffff';
    const code = foreign ? foreign.c : 'F';
    const gw = code.length > 1 ? 15 : 20;
    for (let i = 0; i < code.length; i++) glyph(ctx, code[i], ecx - (code.length * (gw + 3) - 3) / 2 + i * (gw + 3), 58, gw, 36, 6.5);
    x0 = PAD + BAND + 6;
  }
  let dept = null;
  if (!foreign) {
    // identifiant territorial : logo régional (en haut) + n° de département (en bas)
    dept = pickWeighted(rand, DEPTS, DEPT_W);
    const bx = W - PAD - BAND;
    ctx.fillStyle = '#1f5fb8';
    ctx.beginPath(); ctx.roundRect(bx, PAD, BAND, H - 2 * PAD, [0, 5, 5, 0]); ctx.fill();
    drawRegionLogo(ctx, bx + BAND / 2, 30, 36, 38, regionOf(dept));
    ctx.strokeStyle = '#ffffff';
    glyph(ctx, dept[0], bx + 4, 56, 17, 40, 6);
    glyph(ctx, dept[1], bx + 23, 56, 17, 40, 6);
    x1 = bx - 6;
    // numéro d'homologation TPPR (petit, gris)
    ctx.fillStyle = 'rgba(60,64,70,0.55)';
    ctx.font = '600 7px Arial, sans-serif';
    ctx.fillText('TPPR ' + (10000 + ((rand() * 89999) | 0)), bx - 62, H - 9);
  }

  // caractères : 75 mm de haut, ~45 mm de chasse, fût 11 mm
  const txt = foreign ? foreign.fmt(rand) : plateText(rand);
  ctx.strokeStyle = foreign ? foreign.fg : '#121316';
  ctx.fillStyle = foreign ? foreign.fg : '#121316';
  const n = [...txt].filter((c) => c !== '-' && c !== ' ').length;
  const avail = x1 - x0;
  const ch = 76, sw = 11, gap = 5.5, dashW = 13;
  let cw = (avail - (n - 1) * gap - [...txt].filter((c) => c === '-').length * (dashW + 2 * gap) - [...txt].filter((c) => c === ' ').length * 26) / n;
  cw = Math.min(cw, 46);
  plateString(ctx, txt, x0, x1, H / 2, ch, cw, sw, gap, dashW);
  return { canvas: cv, text: txt, dept };
}

// Pool de textures partagées (évite 1 canvas par véhicule)
export class PlatePool {
  constructor(THREE, rand, size = 36) {
    this.THREE = THREE;
    this.items = [];
    for (let i = 0; i < size; i++) {
      const { canvas, text } = drawPlate(rand);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      this.items.push({ mat, text });
    }
    this.rand = rand;
  }
  get() { return this.items[(this.rand() * this.items.length) | 0]; }
}
export const drawPlateForTest = (rand) => drawPlate(rand);
