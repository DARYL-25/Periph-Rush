// ============================================================
// Périph' Rush — plaques d'immatriculation fictives
// Format SIV français AA-123-AA, bande euro « F » à gauche,
// carré bleu département à droite. Pond. Île-de-France + étrangères.
// ============================================================

import { pick, pickWeighted } from './utils.js';

// I, O et U sont exclus du SIV ; SS interdit — on reste simple
const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

const DEPTS = ['75', '92', '93', '94', '77', '78', '91', '95', '69', '13', '59', '01', '74', '60', '44', '33', '31', '34', '06', '84', '76', '38', '67', '35'];
const DEPT_W = [20, 16, 14, 14, 9, 9, 8, 8, 3, 3, 2, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

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

// Dessine une plaque sur un canvas 256×56 → texture nette et légère
function drawPlate(rand) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 56;
  const ctx = cv.getContext('2d');
  const foreign = rand() < 0.055 ? pick(rand, FOREIGN) : null;

  const bg = foreign ? foreign.bg : '#f4f6f8';
  const fg = foreign ? foreign.fg : '#14181c';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 56);
  // cadre
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 253, 53);

  let x0 = 8, x1 = 248;
  if (!foreign || !foreign.noBand) {
    // bande euro gauche
    ctx.fillStyle = '#003399';
    ctx.fillRect(2, 2, 26, 52);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    // cercle d'étoiles simplifié
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(15 + Math.cos(a) * 7 - 1, 16 + Math.sin(a) * 7 - 1, 2, 2);
    }
    ctx.fillText(foreign ? foreign.c : 'F', 15, 46);
    x0 = 32;
  }
  let dept = null;
  if (!foreign) {
    // carré département droit
    dept = pickWeighted(rand, DEPTS, DEPT_W);
    ctx.fillStyle = '#003399';
    ctx.fillRect(228, 2, 26, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dept, 241, 34);
    x1 = 224;
  }
  const txt = foreign ? foreign.fmt(rand) : plateText(rand);
  ctx.fillStyle = fg;
  ctx.font = `bold ${foreign ? 27 : 30}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, (x0 + x1) / 2, 30);
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
      tex.anisotropy = 2;
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      this.items.push({ mat, text });
    }
    this.rand = rand;
  }
  get() { return this.items[(this.rand() * this.items.length) | 0]; }
}
