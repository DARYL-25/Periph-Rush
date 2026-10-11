// ============================================================
// Périph' Rush — plaques d'immatriculation (v15)
// France : format SIV réel AB-123-CD, TOUS les départements
// (01→95, 2A/2B, DOM 971→976) avec pondération réaliste : forte
// présence Île-de-France, puis 69, 13, 59, 33, 45, 60, 74, 06.
// Étranger (≈8 %) pondéré : D ≫ B > NL > CH > E > GB > MA, chacun
// avec sa mise en page et une police au trait qui reprend le dessin
// réglementaire du pays (FE-Schrift anguleuse, Kenteken carrée et
// grasse, Charles Wright large et ronde, DIN pour CH/E/MA…).
// ============================================================

import { pick, pickWeighted } from './utils.js';

// I, O et U sont exclus du SIV
const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

// ---------------------------------------------------------------
// Départements & régions
// ---------------------------------------------------------------
const REGIONS = {
  idf: ['75', '77', '78', '91', '92', '93', '94', '95'],
  ara: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  bfc: ['21', '25', '39', '58', '70', '71', '89', '90'],
  bre: ['22', '29', '35', '56'],
  cvl: ['18', '28', '36', '37', '41', '45'],
  cor: ['2A', '2B'],
  ge: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  hdf: ['02', '59', '60', '62', '80'],
  nor: ['14', '27', '50', '61', '76'],
  na: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  occ: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  pdl: ['44', '49', '53', '72', '85'],
  paca: ['04', '05', '06', '13', '83', '84'],
  dom: ['971', '972', '973', '974', '976'],
};
const REGION_OF = {};
for (const [k, list] of Object.entries(REGIONS)) for (const d of list) REGION_OF[d] = k;

// poids : Île-de-France très majoritaire sur le périphérique,
// grandes métropoles / départements frontaliers d'IDF ensuite
const IDF_W = { 75: 20, 92: 16, 93: 14, 94: 14, 77: 9, 78: 9, 91: 8, 95: 8 };
const HOT = ['69', '13', '59', '33', '45', '60', '74', '06'];
const WARM = ['27', '28', '51', '02', '10', '89', '76', '44', '31', '67', '35', '38', '34', '62', '37', '57'];
export const DEPTS = Object.keys(REGION_OF).sort();
export const DEPT_W = DEPTS.map((d) =>
  IDF_W[d] ?? (HOT.includes(d) ? 2.1 : WARM.includes(d) ? 0.75 : d.length === 3 ? 0.07 : 0.3));

// ---------------------------------------------------------------
// Pays étrangers et pondération (part totale FOREIGN_RATE)
// ---------------------------------------------------------------
const FOREIGN_RATE = 0.08;
const COUNTRIES = ['D', 'B', 'NL', 'CH', 'E', 'GB', 'MA'];
const COUNTRY_W = [32, 19, 16, 11, 10, 8, 4];

function L(rand, set = LETTERS) { return set[(rand() * set.length) | 0]; }
function D(rand, min = 0) { return String(min + ((rand() * (10 - min)) | 0)); }
function Ln(rand, n, set) { let s = ''; for (let i = 0; i < n; i++) s += L(rand, set); return s; }
function Dn(rand, n, first0 = true) { let s = first0 ? '' : D(rand, 1); for (let i = s.length; i < n; i++) s += D(rand); return s; }

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
    case 'bfc': { // damier bleu / or
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 3 ? '#e8b400' : '#1f3f8f';
        ctx.fillRect(-6 + (i % 2) * 6, -6 + (i >> 1) * 6, 6, 6);
      }
      break;
    }
    case 'cvl': { // vagues bleu / ocre
      ctx.lineWidth = 2.4;
      ['#1f5fb8', '#d8902a'].forEach((c2, i) => {
        ctx.strokeStyle = c2;
        ctx.beginPath();
        ctx.moveTo(-8, -2 + i * 5);
        ctx.quadraticCurveTo(-4, -6 + i * 5, 0, -2 + i * 5);
        ctx.quadraticCurveTo(4, 2 + i * 5, 8, -2 + i * 5);
        ctx.stroke();
      });
      break;
    }
    case 'cor': { // disque noir, bandeau blanc
      ctx.fillStyle = '#16181b';
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6f8fa';
      ctx.fillRect(-6.5, -2.6, 13, 2.2);
      break;
    }
    case 'ge': { // chevron rouge
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.moveTo(-7, 5); ctx.lineTo(0, -6); ctx.lineTo(7, 5); ctx.lineTo(3.5, 5); ctx.lineTo(0, -0.5); ctx.lineTo(-3.5, 5);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'dom': { // soleil sur la mer
      ctx.fillStyle = '#e8b400';
      ctx.beginPath(); ctx.arc(0, -1, 4.5, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#1f8fb8'; ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath(); ctx.moveTo(-7, 2 + i * 3.5);
        ctx.quadraticCurveTo(-3.5, 0 + i * 3.5, 0, 2 + i * 3.5);
        ctx.quadraticCurveTo(3.5, 4 + i * 3.5, 7, 2 + i * 3.5);
        ctx.stroke();
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
// Police « bâton » (base commune), coordonnées normalisées a,b ∈ [0,1]
// M/L = segments, Q = courbe quadratique, O = ovale plein, E = ellipse.
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


// ---------------------------------------------------------------
// Moteur de police au trait. Chaque pays applique un « style » qui
// transforme les panses du dessin de base :
//  fr  : panses rondes, O en stade (police SIV)
//  din : idem, un peu plus ouvert (CH, E, MA)
//  gb  : large et rond, fût épais (Charles Wright)
//  fe  : panses chanfreinées, O octogonal (FE-Schrift, D et B)
//  nl  : carré à coins arrondis, fût gras (Kenteken)
// ---------------------------------------------------------------
// Dessins propres à chaque police (remplacent la base SIV caractère par caractère).
// B = contour fermé (x0,y0,x1,y1) selon le style, EL = ellipse vraie.
const FE_OVR = { // FE-Schrift (D, B) : étroite, fûts droits, panses à petits rayons
  0: [['B', 0, 0, 1, 1]],
  O: [['EL', 0.5, 0.5, 0.5, 0.5]],
  Q: [['EL', 0.5, 0.5, 0.5, 0.5], ['M', 0.62, 0.72], ['L', 1, 1.04]],
  1: [['M', 0.1, 0.24], ['L', 0.7, 0], ['L', 0.7, 1]],
  3: [['M', 0.04, 0], ['L', 0.96, 0], ['L', 0.42, 0.42], ['Q', 1, 0.42, 1, 0.71], ['Q', 1, 1, 0.5, 1], ['Q', 0.1, 1, 0.02, 0.84]],
  6: [['M', 0.84, 0], ['L', 0, 0.7], ['B', 0, 0.42, 1, 1]],
  9: [['B', 0, 0, 1, 0.58], ['M', 1, 0.3], ['L', 0.16, 1]],
  8: [['B', 0.07, 0, 0.93, 0.47], ['B', 0, 0.47, 1, 1]],
  2: [['M', 0.02, 0.2], ['Q', 0.06, 0, 0.5, 0], ['Q', 1, 0, 1, 0.28], ['Q', 1, 0.44, 0.72, 0.6], ['L', 0, 1], ['L', 1, 1]],
  5: [['M', 0.94, 0], ['L', 0.1, 0], ['L', 0.06, 0.44], ['L', 0.5, 0.4], ['Q', 1, 0.4, 1, 0.7], ['Q', 1, 1, 0.5, 1], ['Q', 0.1, 1, 0.02, 0.85]],
  M: [['M', 0, 1], ['L', 0, 0], ['L', 0.5, 0.56], ['L', 1, 0], ['L', 1, 1]],
  W: [['M', 0, 0], ['L', 0.2, 1], ['L', 0.5, 0.4], ['L', 0.8, 1], ['L', 1, 0]],
  G: [['M', 0.98, 0.18], ['Q', 0.92, 0, 0.5, 0], ['Q', 0, 0, 0, 0.32], ['L', 0, 0.68], ['Q', 0, 1, 0.5, 1], ['Q', 1, 1, 1, 0.68], ['L', 1, 0.5], ['L', 0.52, 0.5]],
  J: [['M', 1, 0], ['L', 1, 0.7], ['Q', 1, 1, 0.5, 1], ['Q', 0.04, 1, 0, 0.74]],
};
const NL_OVR = { // Kenteken (NL) : grasse, carrée à coins arrondis
  0: [['B', 0, 0, 1, 1]],
  8: [['B', 0.05, 0, 0.95, 0.48], ['B', 0, 0.48, 1, 1]],
  6: [['M', 0.95, 0.02], ['L', 0.35, 0.02], ['Q', 0, 0.02, 0, 0.35], ['L', 0, 0.75], ['B', 0, 0.45, 1, 1]],
  9: [['B', 0, 0, 1, 0.55], ['M', 1, 0.25], ['L', 1, 0.65], ['Q', 1, 0.98, 0.65, 0.98], ['L', 0.05, 0.98]],
  3: [['M', 0.02, 0], ['L', 0.68, 0], ['Q', 1, 0, 1, 0.25], ['Q', 1, 0.48, 0.68, 0.48], ['L', 0.3, 0.48], ['M', 0.68, 0.48], ['Q', 1, 0.48, 1, 0.74], ['Q', 1, 1, 0.68, 1], ['L', 0.02, 1]],
  2: [['M', 0.02, 0], ['L', 0.68, 0], ['Q', 1, 0, 1, 0.26], ['Q', 1, 0.5, 0.68, 0.5], ['L', 0.3, 0.5], ['Q', 0, 0.5, 0, 0.74], ['L', 0, 1], ['L', 1, 1]],
  5: [['M', 0.98, 0], ['L', 0.02, 0], ['L', 0.02, 0.48], ['L', 0.68, 0.48], ['Q', 1, 0.48, 1, 0.74], ['Q', 1, 1, 0.68, 1], ['L', 0.02, 1]],
  S: [['M', 0.98, 0], ['L', 0.32, 0], ['Q', 0, 0, 0, 0.25], ['Q', 0, 0.49, 0.32, 0.49], ['L', 0.68, 0.49], ['Q', 1, 0.49, 1, 0.75], ['Q', 1, 1, 0.68, 1], ['L', 0.02, 1]],
  1: [['M', 0.12, 0.18], ['L', 0.62, 0], ['L', 0.62, 1]],
  4: [['M', 0.75, 1], ['L', 0.75, 0], ['L', 0.05, 0.68], ['L', 1, 0.68]],
  7: [['M', 0, 0], ['L', 1, 0], ['L', 0.38, 1]],
  G: [['M', 1, 0.02], ['L', 0.35, 0.02], ['Q', 0, 0.02, 0, 0.35], ['L', 0, 0.66], ['Q', 0, 0.98, 0.35, 0.98], ['L', 1, 0.98], ['L', 1, 0.5], ['L', 0.55, 0.5]],
  J: [['M', 1, 0], ['L', 1, 0.66], ['Q', 1, 0.98, 0.66, 0.98], ['L', 0, 0.98]],
};
const STYLES = {
  fr: { o: 'stadium', q: 'curve' },
  din: { o: 'stadium', q: 'curve' },
  gb: { o: 'stadium', q: 'curve' },
  fe: { o: 'rrect', r: 0.42, q: 'round', k: 0.45, ovr: FE_OVR },
  nl: { o: 'rrect', r: 0.3, q: 'round', k: 0.62, ovr: NL_OVR, cap: 'square' },
};

// lettres arabes (forme isolée) des plaques marocaines, au trait.
// P = point plein.
const AR = {
  A: [['M', 0.5, 0.3], ['L', 0.5, 1], ['M', 0.66, 0.1], ['Q', 0.42, -0.02, 0.4, 0.1], ['Q', 0.42, 0.2, 0.7, 0.16]],
  B: [['M', 0.97, 0.45], ['Q', 0.97, 0.78, 0.5, 0.78], ['Q', 0.03, 0.78, 0.03, 0.45], ['P', 0.5, 0.97]],
  D: [['M', 0.28, 0.25], ['Q', 0.78, 0.42, 0.78, 0.82], ['L', 0.18, 0.82]],
  H: [['E', 0.5, 0.6, 0.32, 0.27]],
  E: [['E', 0.62, 0.42, 0.17, 0.16], ['M', 0.79, 0.45], ['Q', 0.82, 0.9, 0.2, 0.98]],
  T: [['M', 0.06, 0.82], ['L', 0.88, 0.82], ['Q', 0.98, 0.52, 0.62, 0.52], ['Q', 0.36, 0.55, 0.32, 0.82], ['M', 0.32, 0.05], ['L', 0.32, 0.8]],
  Y: [['M', 0.78, 0.2], ['Q', 0.42, 0.24, 0.52, 0.44], ['Q', 0.98, 0.56, 0.78, 0.7], ['Q', 0.5, 0.82, 0.08, 0.62], ['P', 0.38, 0.95], ['P', 0.62, 0.95]],
  K: [['M', 0.92, 0.05], ['L', 0.92, 0.82], ['L', 0.08, 0.82], ['Q', 0.02, 0.66, 0.14, 0.6], ['M', 0.42, 0.34], ['Q', 0.62, 0.26, 0.64, 0.5]],
  L: [['M', 0.78, 0.02], ['L', 0.78, 0.62], ['Q', 0.78, 0.95, 0.44, 0.95], ['Q', 0.12, 0.95, 0.12, 0.62]],
  M: [['E', 0.62, 0.42, 0.18, 0.15], ['M', 0.46, 0.5], ['Q', 0.3, 0.58, 0.3, 1]],
  C: [['M', 0.45, 0.72], ['Q', 0.6, 0.36, 0.86, 0.46], ['Q', 1, 0.64, 0.76, 0.72], ['L', 0.45, 0.72], ['M', 0.45, 0.62], ['Q', 0.45, 0.9, 0.25, 0.9], ['Q', 0.03, 0.9, 0.03, 0.62]],
  F: [['M', 0.94, 0.48], ['L', 0.94, 0.66], ['Q', 0.94, 0.82, 0.5, 0.82], ['Q', 0.08, 0.82, 0.06, 0.6], ['E', 0.76, 0.46, 0.13, 0.11], ['P', 0.76, 0.12]],
  R: [['M', 0.68, 0.36], ['Q', 0.76, 0.8, 0.2, 0.98]],
  S: [['M', 0.97, 0.4], ['L', 0.97, 0.62], ['Q', 0.88, 0.7, 0.8, 0.62], ['L', 0.8, 0.46], ['M', 0.8, 0.62], ['Q', 0.72, 0.7, 0.64, 0.62], ['L', 0.64, 0.46], ['M', 0.64, 0.62], ['Q', 0.64, 0.9, 0.35, 0.9], ['Q', 0.05, 0.9, 0.05, 0.62]],
};
const AR_LATIN = Object.keys(AR);

// dessine un caractère dans la boîte (x, y, w, h), trait de largeur sw
function glyph(ctx, ch, x, y, w, h, sw, st = 'fr', table = GLYPHS) {
  const S = STYLES[st] || STYLES.fr;
  const g = (table === GLYPHS && S.ovr && S.ovr[ch]) || table[ch];
  if (!g) return;
  const ix = x + sw / 2, iy = y + sw / 2, iw = w - sw, ih = h - sw;
  const X = (a) => ix + a * iw, Y = (b) => iy + b * ih;
  ctx.lineWidth = sw;
  ctx.lineCap = table === AR ? 'round' : (S.cap || 'butt');
  ctx.lineJoin = S.q === 'chamfer' ? 'miter' : table === AR ? 'round' : 'miter';
  ctx.miterLimit = 2.2;
  const dots = [];
  let px = 0, py = 0;
  ctx.beginPath();
  const box = (x0, y0, x1, y1) => { // contour fermé selon le style
    const bw = X(x1) - X(x0), bh = Y(y1) - Y(y0);
    if (S.o === 'oct') {
      const c = Math.min(bw, bh) * 0.3;
      ctx.moveTo(X(x0) + c, Y(y0)); ctx.lineTo(X(x1) - c, Y(y0)); ctx.lineTo(X(x1), Y(y0) + c);
      ctx.lineTo(X(x1), Y(y1) - c); ctx.lineTo(X(x1) - c, Y(y1)); ctx.lineTo(X(x0) + c, Y(y1));
      ctx.lineTo(X(x0), Y(y1) - c); ctx.lineTo(X(x0), Y(y0) + c); ctx.closePath();
    } else if (S.o === 'rrect') {
      const rr = Math.min(bw, bh) * (S.r ?? 0.34);
      ctx.moveTo(X(x0), Y(y0) + rr);
      ctx.roundRect(X(x0), Y(y0), bw, bh, rr);
    } else {
      const r = bw / 2, cx = (X(x0) + X(x1)) / 2, t = Y(y0) + Math.min(r, bh / 2), bo = Y(y1) - Math.min(r, bh / 2);
      if (bh <= bw * 1.05) { ctx.moveTo(cx + bw / 2, (Y(y0) + Y(y1)) / 2); ctx.ellipse(cx, (Y(y0) + Y(y1)) / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2); return; }
      ctx.moveTo(X(x0), bo); ctx.lineTo(X(x0), t);
      ctx.arc(cx, t, r, Math.PI, 0); ctx.lineTo(X(x1), bo); ctx.arc(cx, bo, r, 0, Math.PI); ctx.closePath();
    }
  };
  for (const c of g) {
    const op = c[0];
    if (op === 'M') { ctx.moveTo(X(c[1]), Y(c[2])); px = c[1]; py = c[2]; }
    else if (op === 'L') { ctx.lineTo(X(c[1]), Y(c[2])); px = c[1]; py = c[2]; }
    else if (op === 'Q') {
      const [, cx, cy, ex, ey] = c;
      if (S.q === 'curve' || table === AR) ctx.quadraticCurveTo(X(cx), Y(cy), X(ex), Y(ey));
      else {
        const k = S.k;
        const ax = px + (cx - px) * k, ay = py + (cy - py) * k;
        const bx = ex + (cx - ex) * k, by = ey + (cy - ey) * k;
        ctx.lineTo(X(ax), Y(ay));
        if (S.q === 'chamfer') ctx.lineTo(X(bx), Y(by));
        else ctx.quadraticCurveTo(X(cx), Y(cy), X(bx), Y(by));
        ctx.lineTo(X(ex), Y(ey));
      }
      px = ex; py = ey;
    } else if (op === 'O') box(0, 0, 1, 1);
    else if (op === 'E') {
      if (table === AR || S.o === 'stadium') {
        ctx.moveTo(X(c[1] + c[3]), Y(c[2]));
        ctx.ellipse(X(c[1]), Y(c[2]), c[3] * iw, c[4] * ih, 0, 0, Math.PI * 2);
      } else box(c[1] - c[3], c[2] - c[4], c[1] + c[3], c[2] + c[4]);
    } else if (op === 'P') dots.push([X(c[1]), Y(c[2])]);
    else if (op === 'B') box(c[1], c[2], c[3], c[4]);
    else if (op === 'EL') { ctx.moveTo(X(c[1] + c[3]), Y(c[2])); ctx.ellipse(X(c[1]), Y(c[2]), c[3] * iw, c[4] * ih, 0, 0, Math.PI * 2); }
  }
  ctx.stroke();
  if (dots.length) {
    ctx.beginPath();
    for (const [dx, dy] of dots) { ctx.moveTo(dx + sw * 0.75, dy); ctx.arc(dx, dy, sw * 0.75, 0, Math.PI * 2); }
    ctx.fill();
  }
}

// Texte centré dans [x0, x1] autour de yc. Caractères spéciaux :
//  '-' tiret, ' ' espace, '·' point médian, '#' emplacement réservé (o.slot)
function drawText(ctx, txt, x0, x1, yc, o) {
  const { ch, sw, gap, st = 'fr' } = o;
  const dashW = o.dashW ?? 13, space = o.space ?? 24, dW = o.digitW ?? 1;
  const chars = [...txt];
  const widthOf = (c, cw) => (c === '-' ? dashW + gap : c === ' ' ? space : c === '·' ? sw * 1.8 + gap
    : c === '#' ? o.slotW + gap : (/[0-9]/.test(c) ? cw * dW : cw) + gap);
  let cw = o.cw;
  let total = chars.reduce((a, c) => a + widthOf(c, cw), 0) - gap;
  const avail = x1 - x0;
  if (total > avail) { // resserre la chasse (pas le fût) pour tenir dans la plaque
    const fixed = total - chars.reduce((a, c) => a + (/[A-Z0-9]/.test(c) ? (/[0-9]/.test(c) ? cw * dW : cw) : 0), 0);
    cw *= Math.max(0.6, (avail - fixed) / (total - fixed));
    total = chars.reduce((a, c) => a + widthOf(c, cw), 0) - gap;
  }
  let x = (x0 + x1) / 2 - total / 2;
  const y = yc - ch / 2;
  for (const c of chars) {
    const w = widthOf(c, cw);
    if (c === '-') ctx.fillRect(x, yc - sw * 0.6, dashW, sw * 1.2);
    else if (c === '·') { ctx.beginPath(); ctx.arc(x + sw * 0.9, yc, sw * 0.62, 0, Math.PI * 2); ctx.fill(); }
    else if (c === '#') o.slot(x, yc, o.slotW);
    else if (c !== ' ') glyph(ctx, c, x, y, w - gap, ch, sw, st);
    x += w;
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

const W = 520, H = 110, PAD = 6, BAND = 44;

function newCanvas() {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  return cv;
}

// support : tranche grise, fond (dégradé léger), liseré optionnel
function base(ctx, bg, bg2, border) {
  ctx.fillStyle = '#c3c6ca';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 9); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, bg); g.addColorStop(1, bg2 || bg);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(2, 2, W - 4, H - 4, 8); ctx.fill();
  if (border) {
    ctx.strokeStyle = border.c; ctx.lineWidth = border.w;
    ctx.beginPath(); ctx.roundRect(border.i, border.i, W - 2 * border.i, H - 2 * border.i, 6); ctx.stroke();
  }
}
function sheen(ctx) {
  const s = ctx.createLinearGradient(0, 0, W, H);
  s.addColorStop(0.2, 'rgba(255,255,255,0)'); s.addColorStop(0.34, 'rgba(255,255,255,0.28)'); s.addColorStop(0.44, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
}

// bande européenne : 12 étoiles + code pays blanc
function euroBand(ctx, code, st = 'fr', x = PAD) {
  ctx.fillStyle = '#1f4fb0';
  ctx.beginPath(); ctx.roundRect(x, PAD, BAND, H - 2 * PAD, [5, 0, 0, 5]); ctx.fill();
  ctx.fillStyle = '#ffd400';
  const ecx = x + BAND / 2, ecy = 32, er = 13.5;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; star5(ctx, ecx + Math.cos(a) * er, ecy + Math.sin(a) * er, 3); }
  ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff';
  const gw = code.length > 1 ? 15 : 19, gh = 34;
  for (let i = 0; i < code.length; i++) glyph(ctx, code[i], ecx - (code.length * (gw + 3) - 3) / 2 + i * (gw + 3), 58, gw, gh, 6, st);
  return x + BAND;
}

// ---------------------------------------------------------------
// FRANCE (SIV)
// ---------------------------------------------------------------
const KIND = { idf: 'star', ara: 'bands', bfc: 'bfc', bre: 'bzh', cvl: 'cvl', cor: 'cor', ge: 'ge', hdf: 'heart', nor: 'lion', na: 'lion', occ: 'cross', pdl: 'map', paca: 'sun', dom: 'dom' };

function drawFR(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#fbfbfc', '#e6e8eb');
  ctx.fillStyle = 'rgba(160,165,172,0.10)'; // filigrane du film rétroréfléchissant
  ctx.font = '700 9px Arial, sans-serif';
  for (let y = 14; y < H; y += 18) for (let x = (y / 18) % 2 ? 60 : 90; x < W - 50; x += 70) ctx.fillText('TPMR', x, y);
  const x0 = euroBand(ctx, 'F') + 6;
  const dept = pickWeighted(rand, DEPTS, DEPT_W);
  const bx = W - PAD - BAND;
  ctx.fillStyle = '#1f4fb0';
  ctx.beginPath(); ctx.roundRect(bx, PAD, BAND, H - 2 * PAD, [0, 5, 5, 0]); ctx.fill();
  drawRegionLogo(ctx, bx + BAND / 2, 30, 36, 38, KIND[REGION_OF[dept]] || 'map');
  ctx.strokeStyle = '#ffffff';
  if (dept.length === 2) {
    glyph(ctx, dept[0], bx + 4, 56, 17, 40, 6);
    glyph(ctx, dept[1], bx + 23, 56, 17, 40, 6);
  } else for (let i = 0; i < 3; i++) glyph(ctx, dept[i], bx + 3 + i * 13, 60, 11.5, 34, 4.6);
  ctx.fillStyle = 'rgba(60,64,70,0.55)';
  ctx.font = '600 7px Arial, sans-serif';
  ctx.fillText('TPPR ' + (10000 + ((rand() * 89999) | 0)), bx - 62, H - 9);
  const txt = plateText(rand);
  ctx.strokeStyle = ctx.fillStyle = '#121316';
  drawText(ctx, txt, x0, bx - 6, H / 2, { ch: 76, cw: 46, sw: 11, gap: 5.5, dashW: 13, st: 'fr' });
  sheen(ctx);
  return { canvas: cv, text: txt, country: 'F', dept };
}

// ---------------------------------------------------------------
// ALLEMAGNE — FE-Schrift, vignettes HU + sceau du Land entre
// l'indicatif de district et les lettres d'identification
// ---------------------------------------------------------------
const DE_DISTRICTS = ['B', 'M', 'HH', 'K', 'F', 'S', 'D', 'KA', 'SB', 'AC', 'DA', 'MZ', 'HD', 'FR', 'KL', 'TR', 'WI', 'N', 'HB', 'H', 'DO', 'BN', 'LU', 'MA', 'OG', 'GI', 'E', 'DU', 'RT', 'LB', 'ES', 'BB', 'PF', 'KO', 'NE', 'GL', 'HN', 'UL', 'A'];
const DE_W = DE_DISTRICTS.map((d, i) => (i < 7 ? 4 : i < 14 ? 2.5 : 1));
const HU_COL = ['#ef8db0', '#3aa548', '#f19a2a', '#2f6fd0', '#f0d22c', '#9a6a3a'];
const LAND_COL = [['#d81e2a', '#f5f5f5'], ['#1f5fb8', '#f5f5f5'], ['#2a8a3a', '#f5f5f5'], ['#d81e2a', '#e8b400'], ['#111', '#e8b400'], ['#1f5fb8', '#e8b400']];

function deStickers(ctx, rand) {
  return (x, yc, w) => {
    ctx.save();
    const cx = x + w / 2;
    // vignette contrôle technique (HU) : disque coloré segmenté
    const r1 = 14.5, y1 = yc - 17;
    ctx.fillStyle = pick(rand, HU_COL);
    ctx.beginPath(); ctx.arc(cx, y1, r1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1 * 0.62, y1 + Math.sin(a) * r1 * 0.62);
      ctx.lineTo(cx + Math.cos(a) * r1, y1 + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(cx, y1, r1 * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(cx - 4, y1 - 1.2, 8, 2.4);
    const a0 = rand() * Math.PI * 2; // repère du mois (encoche noire)
    ctx.beginPath(); ctx.moveTo(cx, y1); ctx.arc(cx, y1, r1, a0, a0 + 0.35); ctx.closePath(); ctx.fill();
    // sceau du Land : disque argent + écu bicolore stylisé
    const r2 = 13, y2 = yc + 19;
    const rg = ctx.createRadialGradient(cx - 3, y2 - 4, 2, cx, y2, r2);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#b9bec4');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, y2, r2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8b9096'; ctx.lineWidth = 1; ctx.stroke();
    const [c1, c2] = pick(rand, LAND_COL);
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(cx - 6, y2 - 7); ctx.lineTo(cx + 6, y2 - 7); ctx.lineTo(cx + 6, y2 + 1);
    ctx.quadraticCurveTo(cx + 6, y2 + 6, cx, y2 + 8); ctx.quadraticCurveTo(cx - 6, y2 + 6, cx - 6, y2 + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.moveTo(cx - 6, y2 - 7); ctx.lineTo(cx, y2 - 7); ctx.lineTo(cx, y2 + 8);
    ctx.quadraticCurveTo(cx - 6, y2 + 6, cx - 6, y2 + 1); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
}

function drawDE(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f6f7f8', '#e3e5e8', { c: '#1a1c1f', w: 2.2, i: 3.2 });
  const x0 = euroBand(ctx, 'D', 'fe') + 4;
  const dist = pickWeighted(rand, DE_DISTRICTS, DE_W);
  const nl = rand() < 0.45 ? 1 : 2;
  const maxD = Math.min(4, 8 - dist.length - nl);
  const nd = 1 + ((rand() * maxD) | 0);
  const suffix = rand() < 0.04 && dist.length + nl + nd < 8 ? 'E' : ''; // véhicule électrique
  const txt = `${dist}#${Ln(rand, nl, LETTERS)} ${Dn(rand, nd, false)}${suffix}`;
  ctx.strokeStyle = ctx.fillStyle = '#121316';
  drawText(ctx, txt, x0, W - 10, H / 2, {
    ch: 75, cw: 47.5, digitW: 0.937, sw: 10.5, gap: 3, space: 18, st: 'fe',
    slotW: 34, slot: deStickers(ctx, rand),
  });
  sheen(ctx);
  return { canvas: cv, text: txt.replace('#', ' '), country: 'D' };
}

// ---------------------------------------------------------------
// PAYS-BAS — fond jaune, Kenteken grasse et carrée
// ---------------------------------------------------------------
const NL_L = 'BDFGHJKLNPRSTVXZ';
const NL_SIDE = ['XX-999-X', 'X-999-XX', 'XXX-99-X', 'XX-99-XX', '99-XXX-9', '9-XXX-99', 'X-99-XXX', 'XX-XX-99'];
function fromPattern(rand, p, set) {
  return [...p].map((c) => (c === 'X' ? L(rand, set) : c === '9' ? D(rand) : c)).join('');
}
function drawNL(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f8c51c', '#ecb000', { c: '#1a1c1f', w: 2.4, i: 3.2 });
  const x0 = euroBand(ctx, 'NL', 'nl') + 4;
  const txt = fromPattern(rand, pick(rand, NL_SIDE), NL_L);
  ctx.strokeStyle = ctx.fillStyle = '#111214';
  drawText(ctx, txt, x0, W - 10, H / 2, { ch: 74, cw: 50, sw: 13.5, gap: 5, dashW: 15, st: 'nl' });
  sheen(ctx);
  return { canvas: cv, text: txt, country: 'NL' };
}

// ---------------------------------------------------------------
// BELGIQUE — caractères et liseré rouges, FE-Schrift
// ---------------------------------------------------------------
function drawB(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f7f8f9', '#e6e8ea', { c: '#b4151d', w: 2.6, i: 4 });
  const x0 = euroBand(ctx, 'B', 'fe') + 6;
  const txt = `${rand() < 0.75 ? '1' : '2'}-${Ln(rand, 3, LETTERS)}-${Dn(rand, 3)}`;
  ctx.strokeStyle = ctx.fillStyle = '#b4151d';
  drawText(ctx, txt, x0, W - 12, H / 2, { ch: 76, cw: 45, digitW: 0.95, sw: 10, gap: 4.5, dashW: 14, st: 'fe' });
  sheen(ctx);
  return { canvas: cv, text: txt, country: 'B' };
}

// ---------------------------------------------------------------
// SUISSE — pas de bande UE : écu suisse à gauche, écu cantonal à droite
// ---------------------------------------------------------------
const CANTONS = ['GE', 'VD', 'ZH', 'BE', 'VS', 'NE', 'FR', 'BS', 'TI', 'AG', 'LU', 'SG'];
const CANTON_W = [26, 20, 14, 9, 7, 7, 5, 4, 3, 3, 2, 2];
// écus cantonaux STYLISÉS (partitions de couleurs simplifiées)
const CANTON_ARMS = {
  GE: ['v', '#f2c200', '#c8102e'], VD: ['h', '#f5f5f5', '#2a8a3a'], ZH: ['d', '#f5f5f5', '#1f6fd0'],
  BE: ['d', '#c8102e', '#f2c200'], VS: ['v', '#f5f5f5', '#c8102e'], NE: ['v3', '#2a8a3a', '#f5f5f5', '#c8102e'],
  FR: ['h', '#151515', '#f5f5f5'], BS: ['h', '#f5f5f5', '#151515'], TI: ['v', '#c8102e', '#1f5fb8'],
  AG: ['v', '#151515', '#1f8fd0'], LU: ['h', '#1f8fd0', '#f5f5f5'], SG: ['h', '#2a8a3a', '#f5f5f5'],
};
function shieldPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.55);
  ctx.quadraticCurveTo(x + w, y + h * 0.9, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.55); ctx.closePath();
}
function swissShield(ctx, x, y, w, h) {
  shieldPath(ctx, x, y, w, h); ctx.fillStyle = '#d52b1e'; ctx.fill();
  ctx.fillStyle = '#ffffff';
  const cx = x + w / 2, cy = y + h * 0.46, a = w * 0.13, b = w * 0.38;
  ctx.fillRect(cx - a, cy - b, 2 * a, 2 * b); ctx.fillRect(cx - b, cy - a, 2 * b, 2 * a);
}
function cantonShield(ctx, x, y, w, h, canton) {
  const [kind, c1, c2, c3] = CANTON_ARMS[canton];
  ctx.save();
  shieldPath(ctx, x, y, w, h); ctx.clip();
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  if (kind === 'v') ctx.fillRect(x + w / 2, y, w / 2, h);
  else if (kind === 'h') ctx.fillRect(x, y + h / 2, w, h / 2);
  else if (kind === 'v3') { ctx.fillRect(x + w / 3, y, w / 3, h); ctx.fillStyle = c3; ctx.fillRect(x + (2 * w) / 3, y, w / 3, h); }
  else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  shieldPath(ctx, x, y, w, h); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.stroke();
}
function drawCH(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f8f9fa', '#e8eaec', { c: '#1a1c1f', w: 2, i: 3.2 });
  swissShield(ctx, 14, 30, 34, 42);
  const canton = pickWeighted(rand, CANTONS, CANTON_W);
  cantonShield(ctx, W - 48, 30, 34, 42, canton);
  const txt = `${canton}·${Dn(rand, 2 + ((rand() * 5) | 0), false)}`;
  ctx.strokeStyle = ctx.fillStyle = '#121316';
  drawText(ctx, txt, 58, W - 58, H / 2, { ch: 74, cw: 44, digitW: 0.95, sw: 10, gap: 5, st: 'din' });
  sheen(ctx);
  return { canvas: cv, text: txt, country: 'CH' };
}

// ---------------------------------------------------------------
// ESPAGNE — 4 chiffres + 3 consonnes
// ---------------------------------------------------------------
const ES_L = 'BCDFGHJKLMNPRSTVWXYZ';
function drawE(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f7f8f9', '#e6e8ea', { c: '#1a1c1f', w: 2, i: 3.2 });
  const x0 = euroBand(ctx, 'E', 'din') + 6;
  const txt = `${Dn(rand, 4)} ${Ln(rand, 3, ES_L)}`;
  ctx.strokeStyle = ctx.fillStyle = '#121316';
  drawText(ctx, txt, x0, W - 12, H / 2, { ch: 77, cw: 46, sw: 10, gap: 6, space: 30, st: 'din' });
  sheen(ctx);
  return { canvas: cv, text: txt, country: 'E' };
}

// ---------------------------------------------------------------
// ROYAUME-UNI — plaque arrière jaune, Charles Wright, bande « UK »
// ---------------------------------------------------------------
const GB_AREA = 'ABCDEFGHKLMNOPRSVWY';
const GB_L = 'ABCDEFGHJKLMNOPRSTUVWXYZ';
function unionFlag(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#012169'; ctx.fillRect(x, y, w, h);
  const diag = (lw, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
  };
  diag(h * 0.2, '#ffffff'); diag(h * 0.07, '#c8102e');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h); ctx.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34);
  ctx.fillStyle = '#c8102e'; ctx.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h); ctx.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2);
  ctx.restore();
}
function drawGB(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f9c80e', '#eeb800');
  // bande d'identification nationale : drapeau + UK
  ctx.fillStyle = '#1d3f94';
  ctx.beginPath(); ctx.roundRect(PAD, PAD, BAND, H - 2 * PAD, [5, 0, 0, 5]); ctx.fill();
  unionFlag(ctx, PAD + 5, 16, BAND - 10, 22);
  ctx.strokeStyle = ctx.fillStyle = '#ffffff';
  glyph(ctx, 'U', PAD + 5, 56, 16, 32, 5.5, 'gb');
  glyph(ctx, 'K', PAD + 24, 56, 16, 32, 5.5, 'gb');
  const year = rand() < 0.5 ? 51 + ((rand() * 24) | 0) : 2 + ((rand() * 23) | 0);
  const txt = `${L(rand, GB_AREA)}${L(rand, GB_L)}${String(year).padStart(2, '0')} ${Ln(rand, 3, 'ABCDEFGHJKLMNOPRSTUVWXYZ')}`;
  ctx.strokeStyle = ctx.fillStyle = '#111214';
  drawText(ctx, txt, PAD + BAND + 6, W - 10, H / 2, { ch: 79, cw: 50, sw: 13, gap: 9, space: 30, st: 'gb' });
  sheen(ctx);
  return { canvas: cv, text: txt, country: 'GB' };
}

// ---------------------------------------------------------------
// MAROC — modèle unifié : MA | n° de série | lettre arabe / latine | préfecture
// ---------------------------------------------------------------
function drawMA(rand) {
  const cv = newCanvas(), ctx = cv.getContext('2d');
  base(ctx, '#f8f9fa', '#e7e9eb', { c: '#1a1c1f', w: 2.4, i: 3.2 });
  ctx.strokeStyle = ctx.fillStyle = '#121316';
  const bar = (x) => ctx.fillRect(x - 2, 15, 4, H - 30);
  // MA (identifiant national)
  drawText(ctx, 'MA', 12, 70, H / 2, { ch: 40, cw: 22, sw: 6, gap: 4, st: 'din' });
  bar(78);
  const serie = Dn(rand, 1 + ((rand() * 5) | 0), false);
  drawText(ctx, serie, 86, 314, H / 2, { ch: 70, cw: 38, sw: 9.5, gap: 6, st: 'din' });
  bar(322);
  const lat = pick(rand, AR_LATIN);
  ctx.lineWidth = 5;
  glyph(ctx, lat, 336, 12, 36, 44, 5.5, 'din', AR);
  glyph(ctx, lat, 342, 62, 24, 36, 5.5, 'din');
  bar(386);
  const pref = String(1 + ((rand() * 89) | 0));
  drawText(ctx, pref, 394, W - 12, H / 2, { ch: 70, cw: 38, sw: 9.5, gap: 6, st: 'din' });
  sheen(ctx);
  return { canvas: cv, text: `${serie} ${lat} ${pref}`, country: 'MA' };
}

const DRAW = { F: drawFR, D: drawDE, NL: drawNL, B: drawB, CH: drawCH, E: drawE, GB: drawGB, MA: drawMA };

function drawPlate(rand, country) {
  const c = country || (rand() < FOREIGN_RATE ? pickWeighted(rand, COUNTRIES, COUNTRY_W) : 'F');
  return DRAW[c](rand);
}

// Pool de plaques partagées. Un petit lot par pays ; le tirage pondéré
// se fait à chaque attribution. Les plaques sont aussi regroupées dans
// un atlas (une seule texture) pour le rendu instancié du trafic.
const POOL_N = { F: 44, D: 6, B: 4, NL: 4, CH: 3, E: 3, GB: 3, MA: 2 };
const ACOLS = 4, CW = 528, CH = 118;
export class PlatePool {
  constructor(THREE, rand, scale = 1) {
    this.rand = rand;
    this.by = {};
    this.all = [];
    for (const [c, n] of Object.entries(POOL_N)) {
      this.by[c] = [];
      const k = Math.max(c === 'F' ? 12 : 1, Math.round(n * Math.min(1, scale)));
      for (let i = 0; i < k; i++) {
        const { canvas, text } = DRAW[c](rand);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const item = { mat: new THREE.MeshBasicMaterial({ map: tex }), text, country: c, canvas, index: this.all.length };
        this.by[c].push(item);
        this.all.push(item);
      }
    }
  }
  get() {
    const r = this.rand;
    const c = r() < FOREIGN_RATE ? pickWeighted(r, COUNTRIES, COUNTRY_W) : 'F';
    const list = this.by[c];
    return list[(r() * list.length) | 0];
  }
  atlasTexture(THREE) {
    if (this._atlas) return this._atlas;
    const rows = Math.ceil(this.all.length / ACOLS);
    const cv = document.createElement('canvas');
    cv.width = ACOLS * CW; cv.height = rows * CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#c3c6ca'; ctx.fillRect(0, 0, cv.width, cv.height);
    this.all.forEach((it, i) => ctx.drawImage(it.canvas, (i % ACOLS) * CW + 4, Math.floor(i / ACOLS) * CH + 4));
    this.atlasSize = [cv.width, cv.height];
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this._atlas = tex;
    return tex;
  }
  // [offsetU, offsetV, scaleU, scaleV] (V vers le haut, texture non retournée = flipY)
  uvOf(i) {
    const [aw, ah] = this.atlasSize;
    const col = i % ACOLS, row = Math.floor(i / ACOLS);
    return [((col * CW) + 4) / aw, 1 - ((row * CH) + 4 + 110) / ah, 520 / aw, 110 / ah];
  }
}
export const drawPlateForTest = (rand, country) => drawPlate(rand, country);
export const glyphForTest = (...a) => glyph(...a);
