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
  switch (kind) {
    case 'star': { // pétales alternés rouge/bleu (esprit IdF)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? '#c8102e' : '#0055a4';
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 3.4, 1.8, a, 0, Math.PI * 2);
        ctx.fill();
      }
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

// Dessine une plaque SIV sur un canvas 384×80 → nette en jeu, légère en mémoire
function drawPlate(rand) {
  const W = 384, H = 80;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const foreign = rand() < 0.055 ? pick(rand, FOREIGN) : null;

  // — fond réfléchissant (léger dégradé + reflet diagonal) —
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  const bg = foreign ? foreign.bg : '#f6f7f9';
  bgGrad.addColorStop(0, bg);
  bgGrad.addColorStop(0.55, foreign ? bg : '#eceef1');
  bgGrad.addColorStop(1, foreign ? bg : '#dfe2e6');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 8);
  ctx.fill();
  // reflet diagonal doux
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0.28, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.35)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  // liseré
  ctx.strokeStyle = 'rgba(40,44,50,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, W - 3, H - 3, 7);
  ctx.stroke();

  const BAND = 40;
  let x0 = 14, x1 = W - 14;
  if (!foreign || !foreign.noBand) {
    // — bande euro gauche : couronne de 12 étoiles + F —
    ctx.fillStyle = '#003399';
    ctx.beginPath();
    ctx.roundRect(2, 2, BAND, H - 4, [7, 0, 0, 7]);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    const ecx = 2 + BAND / 2, ecy = 24, er = 11;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const sx = ecx + Math.cos(a) * er, sy = ecy + Math.sin(a) * er;
      // petite étoile à 5 branches (2 triangles suffisent à cette taille)
      ctx.beginPath();
      ctx.moveTo(sx, sy - 2); ctx.lineTo(sx + 1.9, sy + 1.4); ctx.lineTo(sx - 1.9, sy + 1.4);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx, sy + 2); ctx.lineTo(sx + 1.9, sy - 1.4); ctx.lineTo(sx - 1.9, sy - 1.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(foreign ? foreign.c : 'F', ecx, 60);
    x0 = 2 + BAND + 10;
  }
  let dept = null;
  if (!foreign) {
    // — identifiant territorial droit : logo région EN HAUT, département EN BAS —
    dept = pickWeighted(rand, DEPTS, DEPT_W);
    ctx.fillStyle = '#003399';
    ctx.beginPath();
    ctx.roundRect(W - 2 - BAND, 2, BAND, H - 4, [0, 7, 7, 0]);
    ctx.fill();
    drawRegionLogo(ctx, W - 2 - BAND / 2, 22, 30, 26, regionOf(dept));
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 27px "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dept, W - 2 - BAND / 2, 60);
    x1 = W - 2 - BAND - 10;
  }

  // — caractères bâtons noirs —
  const txt = foreign ? foreign.fmt(rand) : plateText(rand);
  ctx.fillStyle = foreign ? foreign.fg : '#14161a';
  ctx.font = `700 ${foreign ? 40 : 46}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '2px';
  ctx.fillText(txt, (x0 + x1) / 2, H / 2 + 2);
  return { canvas: cv, text: txt, dept };
}

// Pool de textures partagées (évite 1 canvas par véhicule)
export class PlatePool {
  constructor(THREE, rand, size = 48) {
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
