// ============================================================
// Périph' Rush — catalogue & fabrique de véhicules procéduraux
// Chaque modèle est décrit par ses dimensions réelles et des
// paramètres de silhouette (capot, pare-brise, pavillon, hayon…)
// extrudés en 3D. Aucun logo ni badge de marque.
// Groupes de matériaux par carrosserie : 0=peinture, 1=vitrage,
// 2=détails mats (vertex colors : pneus, optiques, plastiques).
// ============================================================

import { mergeGeoms, colorize, xform } from './utils.js';

// ---------- palettes réalistes -------------------------------------
const P = {
  gris: 0x9aa0a6, grisF: 0x5c6166, noir: 0x1e2126, blanc: 0xe8eaed,
  argent: 0xc3c7cc, bleuF: 0x25344d, bleu: 0x3466a8, rouge: 0xa3282e,
  rougeVif: 0xc23531, bordeaux: 0x5e2430, vertF: 0x2e4638, beige: 0xcfc5ae,
  marron: 0x594636, orange: 0xc96a2e, jaune: 0xd9b430, blancVan: 0xdde0e2,
  bleuNuit: 0x1d2738, grisBleu: 0x6e7b8c, kaki: 0x6a6a52, taxiG: 0x8f969e,
  vertParis: 0x3d5f43, rougeSport: 0xb01e28, bleuSport: 0x2c4f8f,
  grisNardo: 0x84888b, vertMamba: 0x5fae3d, blancNacre: 0xe6e4dd,
};
const commonCols = [P.gris, P.grisF, P.blanc, P.noir, P.argent, P.bleuF, P.bleu, P.rouge];

// ---------- catalogue ------------------------------------------------
// dims: [longueur, largeur, hauteur] m · wb: empattement · wr: rayon roue
// prof: silhouette {nose, hood, hoodX, roofX, roofH, roofEndX, tail, tailH, mono?}
//   (fractions de longueur/hauteur) · glass: {belt, endX, hatch}
// perf (voitures jouables): vmax km/h, acc 0-1, man(iabilité) 0-1, frein 0-1
// w: poids d'apparition dans le trafic (0 = jamais)
export const CATALOG = {
  // ——— Renault ———
  clio2:  { name: 'Clio 2', kind: 'hatch', dims: [3.81, 1.64, 1.42], wb: 2.47, wr: 0.28,
    prof: { nose: 0.34, hood: 0.50, hoodX: 0.30, roofX: 0.46, roofH: 0.97, roofEndX: 0.78, tailH: 0.62 },
    glass: { belt: 0.56, endX: 0.94 }, lights: 'round', cols: [...commonCols, P.vertF, P.beige], w: 5,
    perf: { vmax: 150, acc: 0.38, man: 0.62, frein: 0.5 }, unlock: { km: 15 } },
  clio3:  { name: 'Clio 3', kind: 'hatch', dims: [3.99, 1.72, 1.49], wb: 2.58, wr: 0.30,
    prof: { nose: 0.33, hood: 0.47, hoodX: 0.27, roofX: 0.45, roofH: 0.98, roofEndX: 0.76, tailH: 0.64 },
    glass: { belt: 0.55, endX: 0.94 }, lights: 'oval', cols: [...commonCols, P.rougeVif, P.grisBleu], w: 8,
    perf: { vmax: 160, acc: 0.45, man: 0.66, frein: 0.55 }, unlock: { start: true } },
  clio4:  { name: 'Clio 4', kind: 'hatch', dims: [4.06, 1.73, 1.45], wb: 2.59, wr: 0.30,
    prof: { nose: 0.36, hood: 0.46, hoodX: 0.26, roofX: 0.44, roofH: 0.97, roofEndX: 0.74, tailH: 0.66 },
    glass: { belt: 0.60, endX: 0.93 }, lights: 'slim', cols: [...commonCols, P.rougeVif, P.jaune], w: 8,
    perf: { vmax: 168, acc: 0.52, man: 0.7, frein: 0.62 }, unlock: { km: 40 } },
  clio5:  { name: 'Clio 5', kind: 'hatch', dims: [4.05, 1.80, 1.44], wb: 2.58, wr: 0.30,
    prof: { nose: 0.37, hood: 0.46, hoodX: 0.25, roofX: 0.43, roofH: 0.97, roofEndX: 0.73, tailH: 0.66 },
    glass: { belt: 0.61, endX: 0.92 }, lights: 'slim', cols: [...commonCols, P.orange, P.rougeVif], w: 7,
    perf: { vmax: 172, acc: 0.56, man: 0.72, frein: 0.66 }, unlock: { km: 90 } },
  clio6:  { name: 'Clio 6', kind: 'hatch', dims: [4.12, 1.80, 1.45], wb: 2.59, wr: 0.31,
    prof: { nose: 0.40, hood: 0.47, hoodX: 0.24, roofX: 0.42, roofH: 0.96, roofEndX: 0.71, tailH: 0.68 },
    glass: { belt: 0.62, endX: 0.91 }, lights: 'blade', cols: [P.blancNacre, P.noir, P.grisNardo, P.rouge, P.bleuNuit], w: 2.5,
    perf: { vmax: 178, acc: 0.62, man: 0.75, frein: 0.7 }, unlock: { km: 160 } },
  megane: { name: 'Mégane', kind: 'hatch', dims: [4.36, 1.81, 1.45], wb: 2.67, wr: 0.31,
    prof: { nose: 0.35, hood: 0.45, hoodX: 0.27, roofX: 0.45, roofH: 0.96, roofEndX: 0.75, tailH: 0.62 },
    glass: { belt: 0.58, endX: 0.93 }, lights: 'slim', cols: [...commonCols, P.rougeVif], w: 6,
    perf: { vmax: 182, acc: 0.6, man: 0.68, frein: 0.68 }, unlock: { coins: 900 } },
  scenic: { name: 'Scénic', kind: 'mono', dims: [4.34, 1.84, 1.65], wb: 2.70, wr: 0.31,
    prof: { nose: 0.30, hood: 0.42, hoodX: 0.16, roofX: 0.36, roofH: 0.98, roofEndX: 0.82, tailH: 0.72, mono: true },
    glass: { belt: 0.50, endX: 0.95 }, lights: 'oval', cols: [...commonCols, P.beige], w: 4,
    perf: { vmax: 170, acc: 0.48, man: 0.55, frein: 0.58 }, unlock: { coins: 700 } },
  trafic: { name: 'Trafic', kind: 'van', dims: [5.08, 1.96, 1.97], wb: 3.10, wr: 0.33,
    prof: { nose: 0.30, hood: 0.42, hoodX: 0.13, roofX: 0.30, roofH: 0.99, roofEndX: 0.97, tailH: 0.95, mono: true },
    glass: { belt: 0.46, endX: 0.42, panel: true }, lights: 'oval', cols: [P.blancVan, P.blancVan, P.gris, P.bleu, P.rouge], w: 4.5,
    perf: { vmax: 155, acc: 0.35, man: 0.42, frein: 0.45 }, unlock: { coins: 1200 } },
  // ——— Peugeot ———
  p206:  { name: '206', kind: 'hatch', dims: [3.83, 1.65, 1.44], wb: 2.44, wr: 0.28,
    prof: { nose: 0.28, hood: 0.44, hoodX: 0.28, roofX: 0.46, roofH: 0.97, roofEndX: 0.77, tailH: 0.60 },
    glass: { belt: 0.55, endX: 0.94 }, lights: 'feline', cols: [...commonCols, P.rougeVif, P.jaune], w: 6,
    perf: { vmax: 152, acc: 0.4, man: 0.65, frein: 0.5 }, unlock: { km: 25 } },
  p207:  { name: '207', kind: 'hatch', dims: [4.03, 1.75, 1.47], wb: 2.54, wr: 0.29,
    prof: { nose: 0.30, hood: 0.44, hoodX: 0.28, roofX: 0.46, roofH: 0.97, roofEndX: 0.76, tailH: 0.62 },
    glass: { belt: 0.56, endX: 0.94 }, lights: 'feline', cols: [...commonCols], w: 6,
    perf: { vmax: 160, acc: 0.45, man: 0.64, frein: 0.55 }, unlock: { coins: 450 } },
  p208:  { name: '208', kind: 'hatch', dims: [4.06, 1.75, 1.43], wb: 2.54, wr: 0.30,
    prof: { nose: 0.37, hood: 0.46, hoodX: 0.25, roofX: 0.43, roofH: 0.96, roofEndX: 0.72, tailH: 0.66 },
    glass: { belt: 0.61, endX: 0.92 }, lights: 'blade', cols: [...commonCols, P.jaune, P.orange], w: 7,
    perf: { vmax: 170, acc: 0.55, man: 0.72, frein: 0.65 }, unlock: { coins: 800 } },
  p307:  { name: '307', kind: 'hatch', dims: [4.21, 1.76, 1.51], wb: 2.61, wr: 0.30,
    prof: { nose: 0.30, hood: 0.44, hoodX: 0.24, roofX: 0.42, roofH: 0.97, roofEndX: 0.78, tailH: 0.60 },
    glass: { belt: 0.54, endX: 0.94 }, lights: 'feline', cols: [...commonCols, P.beige], w: 5,
    perf: { vmax: 165, acc: 0.46, man: 0.6, frein: 0.55 }, unlock: { coins: 500 } },
  p308:  { name: '308', kind: 'hatch', dims: [4.37, 1.80, 1.44], wb: 2.68, wr: 0.31,
    prof: { nose: 0.36, hood: 0.45, hoodX: 0.26, roofX: 0.44, roofH: 0.96, roofEndX: 0.74, tailH: 0.64 },
    glass: { belt: 0.60, endX: 0.92 }, lights: 'blade', cols: [...commonCols, P.vertMamba], w: 6,
    perf: { vmax: 185, acc: 0.62, man: 0.7, frein: 0.7 }, unlock: { coins: 1100 } },
  p2008: { name: '2008', kind: 'suv', dims: [4.30, 1.77, 1.55], wb: 2.60, wr: 0.32,
    prof: { nose: 0.42, hood: 0.55, hoodX: 0.24, roofX: 0.42, roofH: 0.97, roofEndX: 0.76, tailH: 0.70 },
    glass: { belt: 0.62, endX: 0.92 }, lights: 'blade', cols: [...commonCols, P.orange], w: 5, clearance: 0.34,
    perf: { vmax: 172, acc: 0.52, man: 0.6, frein: 0.6 }, unlock: { coins: 1000 } },
  p3008: { name: '3008', kind: 'suv', dims: [4.45, 1.84, 1.62], wb: 2.68, wr: 0.33,
    prof: { nose: 0.44, hood: 0.56, hoodX: 0.24, roofX: 0.42, roofH: 0.96, roofEndX: 0.78, tailH: 0.70 },
    glass: { belt: 0.62, endX: 0.93 }, lights: 'blade', cols: [...commonCols, P.bordeaux], w: 5.5, clearance: 0.36,
    perf: { vmax: 180, acc: 0.55, man: 0.55, frein: 0.62 }, unlock: { coins: 1400 } },
  p5008: { name: '5008', kind: 'suv', dims: [4.64, 1.84, 1.65], wb: 2.84, wr: 0.33,
    prof: { nose: 0.44, hood: 0.56, hoodX: 0.22, roofX: 0.40, roofH: 0.97, roofEndX: 0.84, tailH: 0.74 },
    glass: { belt: 0.60, endX: 0.94 }, lights: 'blade', cols: [...commonCols], w: 3.5, clearance: 0.36,
    perf: { vmax: 178, acc: 0.5, man: 0.5, frein: 0.6 }, unlock: { coins: 1500 } },
  // ——— Citroën ———
  c1: { name: 'C1', kind: 'hatch', dims: [3.46, 1.62, 1.46], wb: 2.34, wr: 0.27,
    prof: { nose: 0.34, hood: 0.48, hoodX: 0.26, roofX: 0.42, roofH: 0.98, roofEndX: 0.80, tailH: 0.68 },
    glass: { belt: 0.54, endX: 0.95 }, lights: 'round', cols: [...commonCols, P.rougeVif, P.jaune], w: 4.5,
    perf: { vmax: 145, acc: 0.42, man: 0.78, frein: 0.5 }, unlock: { km: 8 } },
  c3: { name: 'C3', kind: 'hatch', dims: [3.99, 1.75, 1.47], wb: 2.54, wr: 0.29,
    prof: { nose: 0.36, hood: 0.50, hoodX: 0.24, roofX: 0.42, roofH: 0.97, roofEndX: 0.78, tailH: 0.66 },
    glass: { belt: 0.58, endX: 0.93 }, lights: 'split', cols: [...commonCols, P.rougeVif, P.blancNacre], w: 6,
    perf: { vmax: 162, acc: 0.46, man: 0.66, frein: 0.56 }, unlock: { coins: 500 } },
  c4: { name: 'C4', kind: 'fastback', dims: [4.36, 1.80, 1.53], wb: 2.67, wr: 0.31,
    prof: { nose: 0.40, hood: 0.50, hoodX: 0.24, roofX: 0.42, roofH: 0.95, roofEndX: 0.66, tailH: 0.56 },
    glass: { belt: 0.60, endX: 0.90 }, lights: 'split', cols: [...commonCols, P.bordeaux], w: 4.5, clearance: 0.32,
    perf: { vmax: 178, acc: 0.55, man: 0.62, frein: 0.62 }, unlock: { coins: 1100 } },
  // ——— Mercedes ———
  a250: { name: 'A 250', kind: 'hatch', dims: [4.42, 1.80, 1.44], wb: 2.73, wr: 0.31,
    prof: { nose: 0.36, hood: 0.44, hoodX: 0.27, roofX: 0.45, roofH: 0.95, roofEndX: 0.72, tailH: 0.62 },
    glass: { belt: 0.60, endX: 0.92 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisF, P.argent, P.rouge, P.bleuNuit], w: 3, sport: 0.3,
    perf: { vmax: 200, acc: 0.72, man: 0.74, frein: 0.75 }, unlock: { coins: 2200 } },
  gla250: { name: 'GLA 250', kind: 'suv', dims: [4.41, 1.83, 1.61], wb: 2.73, wr: 0.33,
    prof: { nose: 0.42, hood: 0.52, hoodX: 0.25, roofX: 0.43, roofH: 0.96, roofEndX: 0.75, tailH: 0.68 },
    glass: { belt: 0.60, endX: 0.92 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisF, P.argent, P.bleuNuit], w: 2.5, clearance: 0.35,
    perf: { vmax: 195, acc: 0.68, man: 0.62, frein: 0.7 }, unlock: { coins: 2400 } },
  c63s: { name: 'C 63 S', kind: 'sedan', dims: [4.75, 1.84, 1.44], wb: 2.84, wr: 0.34,
    prof: { nose: 0.35, hood: 0.44, hoodX: 0.30, roofX: 0.47, roofH: 0.94, roofEndX: 0.72, tailH: 0.56 },
    glass: { belt: 0.60, endX: 0.86 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisNardo, P.rougeSport, P.bleuNuit], w: 0.35, sport: 1,
    perf: { vmax: 235, acc: 0.95, man: 0.78, frein: 0.85 }, unlock: { laps: 4, coins: 6000 } },
  // ——— BMW ———
  bmw120: { name: 'Série 1 · 120', kind: 'hatch', dims: [4.32, 1.77, 1.43], wb: 2.69, wr: 0.31,
    prof: { nose: 0.36, hood: 0.46, hoodX: 0.30, roofX: 0.47, roofH: 0.95, roofEndX: 0.73, tailH: 0.60 },
    glass: { belt: 0.59, endX: 0.92 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisF, P.argent, P.bleu, P.rouge], w: 3.5, sport: 0.2,
    perf: { vmax: 195, acc: 0.66, man: 0.75, frein: 0.72 }, unlock: { coins: 1800 } },
  m5: { name: 'M5', kind: 'sedan', dims: [4.98, 1.90, 1.47], wb: 2.98, wr: 0.35,
    prof: { nose: 0.36, hood: 0.45, hoodX: 0.30, roofX: 0.48, roofH: 0.94, roofEndX: 0.73, tailH: 0.56 },
    glass: { belt: 0.60, endX: 0.86 }, lights: 'slim', cols: [P.noir, P.blanc, P.grisNardo, P.bleuSport, P.grisF], w: 0.35, sport: 1,
    perf: { vmax: 240, acc: 0.96, man: 0.76, frein: 0.85 }, unlock: { laps: 5, coins: 6500 } },
  gs: { name: 'GS 1250', kind: 'moto', dims: [2.21, 0.95, 1.43], wb: 1.52, wr: 0.32, moto: 'adv',
    cols: [P.blanc, P.noir, P.bleuSport, P.rouge, P.kaki], w: 2,
    perf: { vmax: 210, acc: 0.85, man: 0.9, frein: 0.7 }, unlock: { laps: 2, coins: 3000 } },
  // ——— Toyota ———
  yaris: { name: 'Yaris', kind: 'hatch', dims: [3.94, 1.75, 1.50], wb: 2.56, wr: 0.29,
    prof: { nose: 0.36, hood: 0.48, hoodX: 0.24, roofX: 0.42, roofH: 0.97, roofEndX: 0.74, tailH: 0.66 },
    glass: { belt: 0.58, endX: 0.93 }, lights: 'blade', cols: [...commonCols, P.rougeVif, P.blancNacre], w: 6,
    perf: { vmax: 165, acc: 0.5, man: 0.7, frein: 0.6 }, unlock: { coins: 650 } },
  auris: { name: 'Auris', kind: 'hatch', dims: [4.33, 1.76, 1.47], wb: 2.60, wr: 0.30,
    prof: { nose: 0.33, hood: 0.45, hoodX: 0.26, roofX: 0.44, roofH: 0.96, roofEndX: 0.76, tailH: 0.62 },
    glass: { belt: 0.57, endX: 0.93 }, lights: 'oval', cols: [...commonCols], w: 4,
    perf: { vmax: 172, acc: 0.5, man: 0.63, frein: 0.6 }, unlock: { coins: 750 } },
  corolla: { name: 'Corolla', kind: 'sedan', dims: [4.37, 1.79, 1.44], wb: 2.64, wr: 0.31,
    prof: { nose: 0.34, hood: 0.45, hoodX: 0.27, roofX: 0.45, roofH: 0.95, roofEndX: 0.72, tailH: 0.56 },
    glass: { belt: 0.58, endX: 0.86 }, lights: 'slim', cols: [...commonCols, P.blancNacre], w: 5,
    perf: { vmax: 178, acc: 0.55, man: 0.65, frein: 0.65 }, unlock: { coins: 950 } },
  // ——— Audi ———
  a1: { name: 'A1', kind: 'hatch', dims: [4.03, 1.74, 1.41], wb: 2.56, wr: 0.30,
    prof: { nose: 0.37, hood: 0.46, hoodX: 0.26, roofX: 0.44, roofH: 0.96, roofEndX: 0.72, tailH: 0.64 },
    glass: { belt: 0.60, endX: 0.92 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisF, P.argent, P.rouge, P.jaune], w: 3,
    perf: { vmax: 180, acc: 0.58, man: 0.73, frein: 0.68 }, unlock: { coins: 1300 } },
  a3: { name: 'A3', kind: 'hatch', dims: [4.34, 1.82, 1.43], wb: 2.64, wr: 0.31,
    prof: { nose: 0.36, hood: 0.45, hoodX: 0.28, roofX: 0.46, roofH: 0.95, roofEndX: 0.73, tailH: 0.60 },
    glass: { belt: 0.59, endX: 0.92 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisF, P.argent, P.bleuNuit, P.rouge], w: 3.5,
    perf: { vmax: 195, acc: 0.64, man: 0.72, frein: 0.72 }, unlock: { coins: 1700 } },
  q3: { name: 'Q3', kind: 'suv', dims: [4.48, 1.86, 1.62], wb: 2.68, wr: 0.33,
    prof: { nose: 0.44, hood: 0.55, hoodX: 0.25, roofX: 0.43, roofH: 0.96, roofEndX: 0.78, tailH: 0.70 },
    glass: { belt: 0.61, endX: 0.93 }, lights: 'slim', cols: [P.blanc, P.noir, P.grisF, P.argent, P.orange, P.bleuNuit], w: 3, clearance: 0.35,
    perf: { vmax: 190, acc: 0.6, man: 0.58, frein: 0.66 }, unlock: { coins: 2000 } },
  rs6: { name: 'RS 6', kind: 'wagon', dims: [4.99, 1.95, 1.46], wb: 2.93, wr: 0.36,
    prof: { nose: 0.38, hood: 0.46, hoodX: 0.28, roofX: 0.46, roofH: 0.95, roofEndX: 0.82, tailH: 0.66 },
    glass: { belt: 0.60, endX: 0.95 }, lights: 'blade', cols: [P.grisNardo, P.noir, P.blanc, P.vertMamba, P.bleuSport], w: 0.4, sport: 1,
    perf: { vmax: 245, acc: 0.98, man: 0.72, frein: 0.88 }, unlock: { laps: 6, coins: 7000 } },
  // ——— deux-roues ———
  tmax530: { name: 'T-Max 530', kind: 'moto', dims: [2.20, 0.78, 1.42], wb: 1.58, wr: 0.26, moto: 'maxiscooter',
    cols: [P.noir, P.grisF, P.blanc, P.bleuNuit], w: 5,
    perf: { vmax: 175, acc: 0.75, man: 0.95, frein: 0.6 }, unlock: { coins: 1600 } },
  tmax560: { name: 'T-Max 560', kind: 'moto', dims: [2.20, 0.78, 1.42], wb: 1.58, wr: 0.26, moto: 'maxiscooter',
    cols: [P.noir, P.grisNardo, P.blancNacre, P.jaune], w: 3,
    perf: { vmax: 180, acc: 0.78, man: 0.95, frein: 0.62 }, unlock: { coins: 2000 } },
  xmax: { name: 'X-Max', kind: 'moto', dims: [2.18, 0.79, 1.41], wb: 1.54, wr: 0.25, moto: 'scooter',
    cols: [P.noir, P.grisF, P.bleu, P.blanc], w: 4.5,
    perf: { vmax: 160, acc: 0.65, man: 0.92, frein: 0.55 }, unlock: { coins: 1100 } },
  xadv: { name: 'X-ADV', kind: 'moto', dims: [2.24, 0.91, 1.34], wb: 1.59, wr: 0.28, moto: 'adv',
    cols: [P.noir, P.rouge, P.grisF, P.kaki], w: 2,
    perf: { vmax: 185, acc: 0.8, man: 0.88, frein: 0.65 }, unlock: { coins: 2600 } },
  // ——— trafic générique (non jouable) ———
  berline_g: { name: 'Berline', kind: 'sedan', dims: [4.6, 1.82, 1.45], wb: 2.75, wr: 0.32,
    prof: { nose: 0.34, hood: 0.45, hoodX: 0.28, roofX: 0.46, roofH: 0.95, roofEndX: 0.72, tailH: 0.56 },
    glass: { belt: 0.58, endX: 0.86 }, lights: 'oval', cols: commonCols, w: 5 },
  citadine_g: { name: 'Citadine', kind: 'hatch', dims: [3.7, 1.66, 1.47], wb: 2.4, wr: 0.28,
    prof: { nose: 0.33, hood: 0.47, hoodX: 0.27, roofX: 0.44, roofH: 0.97, roofEndX: 0.78, tailH: 0.65 },
    glass: { belt: 0.55, endX: 0.94 }, lights: 'round', cols: commonCols, w: 5 },
  suv_g: { name: 'SUV', kind: 'suv', dims: [4.5, 1.85, 1.65], wb: 2.7, wr: 0.33,
    prof: { nose: 0.43, hood: 0.55, hoodX: 0.24, roofX: 0.42, roofH: 0.96, roofEndX: 0.79, tailH: 0.71 },
    glass: { belt: 0.60, endX: 0.93 }, lights: 'oval', cols: commonCols, w: 4, clearance: 0.35 },
  taxi: { name: 'Taxi', kind: 'sedan', dims: [4.6, 1.82, 1.45], wb: 2.75, wr: 0.32,
    prof: { nose: 0.34, hood: 0.45, hoodX: 0.28, roofX: 0.46, roofH: 0.95, roofEndX: 0.72, tailH: 0.56 },
    glass: { belt: 0.58, endX: 0.86 }, lights: 'oval', cols: [P.taxiG, P.noir, P.grisF, P.bleuNuit], w: 3, taxi: true },
  fourgon: { name: 'Fourgon', kind: 'box', dims: [5.6, 2.05, 2.5], wb: 3.4, wr: 0.35,
    cols: [P.blancVan, P.blancVan, P.gris, P.jaune], w: 3 },
  livraison: { name: 'Livraison', kind: 'box', dims: [6.2, 2.1, 2.7], wb: 3.8, wr: 0.36,
    cols: [P.blancVan, P.jaune, P.marron], w: 2, stripe: true },
  camionnette: { name: 'Camionnette', kind: 'van', dims: [4.4, 1.85, 1.85], wb: 2.9, wr: 0.31,
    prof: { nose: 0.32, hood: 0.45, hoodX: 0.15, roofX: 0.32, roofH: 0.99, roofEndX: 0.96, tailH: 0.94, mono: true },
    glass: { belt: 0.48, endX: 0.45, panel: true }, lights: 'oval', cols: [P.blancVan, P.blancVan, P.gris, P.bleu], w: 4 },
  bus: { name: 'Bus', kind: 'bus', dims: [12.0, 2.55, 3.1], wb: 6.0, wr: 0.45,
    cols: [0xdfe5e2], w: 1.2 },
  depanneuse: { name: 'Dépanneuse', kind: 'tow', dims: [6.5, 2.2, 2.6], wb: 3.6, wr: 0.37,
    cols: [P.jaune, P.blancVan, P.orange], w: 0.5 },
  municipal: { name: 'Ville de Paris', kind: 'box', dims: [5.4, 2.05, 2.4], wb: 3.3, wr: 0.34,
    cols: [P.vertParis], w: 1, municipal: true },
};

// ---------- calibration globale des silhouettes ----------------------
// Les proportions réelles ont le capot bien plus haut que le premier jet :
// on relève nez/capot/ceinture de caisse d'un cran, sauf monospaces
// (déjà hauts) et véhicules à caisse dédiée.
for (const id of Object.keys(CATALOG)) {
  const m = CATALOG[id];
  if (!m.prof || m.prof.mono) continue;
  m.prof.nose = Math.min(m.prof.nose + 0.12, 0.56);
  m.prof.hood = Math.min(m.prof.hood + 0.12, 0.68);
  m.prof.tailH = Math.min(m.prof.tailH + 0.05, 0.8);
  if (m.glass) m.glass.belt = Math.min(m.glass.belt + 0.06, 0.72);
}

export const TRAFFIC_IDS = Object.keys(CATALOG).filter((id) => (CATALOG[id].w || 0) > 0);
export const PLAYER_IDS = Object.keys(CATALOG).filter((id) => CATALOG[id].perf);

// ---------- helpers vitrage (quads de surface) ----------------------
// trapèze traversant la largeur, centré sur z=0 (pare-brise / lunette),
// bombé vers l'extérieur pour épouser la coque lissée + biseau
function glassQuad(T, x1, y1, w1, x2, y2, w2) {
  // normale extérieure 2D de la corde (composante Y positive)
  let nx = y2 - y1, ny = -(x2 - x1);
  if (ny < 0) { nx = -nx; ny = -ny; }
  const l = Math.hypot(nx, ny) || 1;
  nx /= l; ny /= l;
  const o1 = 0.04, oM = 0.085; // décalage aux bords / au centre
  const ax1 = x1 + nx * o1, ay1 = y1 + ny * o1;
  const ax2 = x2 + nx * o1, ay2 = y2 + ny * o1;
  const mx = (x1 + x2) / 2 + nx * oM, my = (y1 + y2) / 2 + ny * oM, wM = (w1 + w2) / 2;
  const g1 = quad4(T, [ax1, ay1, -w1 / 2], [ax1, ay1, w1 / 2], [mx, my, wM / 2], [mx, my, -wM / 2]);
  const g2 = quad4(T, [mx, my, -wM / 2], [mx, my, wM / 2], [ax2, ay2, w2 / 2], [ax2, ay2, -w2 / 2]);
  const merged = mergeGeoms(T, [g1, g2]);
  g1.dispose(); g2.dispose();
  return merged;
}
// quad quelconque à 4 sommets (2 triangles, non indexé)
function quad4(T, a, b, c, d) {
  const geo = new T.BufferGeometry();
  const pos = new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

// ============================================================
//                      FABRIQUE
// ============================================================
export class VehicleFactory {
  constructor(THREE, platePool) {
    this.T = THREE;
    this.plates = platePool;
    this.geomCache = new Map();   // id → BufferGeometry (3 groupes)
    this.paintCache = new Map();  // 'hex:dirt' → MeshStandardMaterial
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.08, metalness: 0.35, envMapIntensity: 0.8, side: THREE.DoubleSide });
    this.matteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.06 });
    this.glowHead = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    this.glowTail = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
    this.glowBrake = new THREE.MeshBasicMaterial({ color: 0xff3524 });
    this.glowOrange = new THREE.MeshBasicMaterial({ color: 0xffa020 });
    // ombre portée douce (quad radial)
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(6,8,12,0.55)');
    g.addColorStop(1, 'rgba(6,8,12,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(cv);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    this.shadowGeom = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.plateGeom = new THREE.PlaneGeometry(0.5, 0.11);
  }

  paint(hex, dirt = 0) {
    const key = `${hex}:${dirt}`;
    if (this.paintCache.has(key)) return this.paintCache.get(key);
    const c = new this.T.Color(hex);
    if (dirt > 0) c.lerp(new this.T.Color(0x6b5f4e), dirt * 0.22);
    const m = new this.T.MeshStandardMaterial({
      color: c, roughness: 0.34 + dirt * 0.25, metalness: 0.28, envMapIntensity: 0.9,
    });
    this.paintCache.set(key, m);
    return m;
  }

  // ---------- géométrie carrosserie 4 roues -------------------------
  geometry(id) {
    if (this.geomCache.has(id)) return this.geomCache.get(id);
    const m = CATALOG[id];
    let g;
    if (m.kind === 'moto') g = this.motoGeometry(m);
    else if (m.kind === 'box' || m.kind === 'tow') g = this.boxTruckGeometry(m);
    else if (m.kind === 'bus') g = this.busGeometry(m);
    else g = this.carGeometry(m);
    this.geomCache.set(id, g);
    return g;
  }

  carGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const p = m.prof;
    const wr = m.wr, gc = (m.clearance ?? 0.27);
    const frontOver = (L - m.wb) * 0.42;
    const fx = L / 2 - frontOver - wr;      // essieu avant
    const rx = fx - m.wb;                    // essieu arrière
    const archR = wr + 0.08;
    const X = (f) => L / 2 - f * L;          // fraction → x local (avant = +x)
    const Y = (f) => f * H;

    // — silhouette latérale (points avant → arrière, lissés) —
    const top = [
      [L / 2, Y(p.nose)],
      [X(0.045), Y(p.nose + 0.07)],
      [X(p.hoodX), Y(p.hood)],                                    // base pare-brise
      [X(p.roofX), Y(p.roofH)],                                    // avant du pavillon
      [X(p.roofEndX), Y(p.roofH - (p.mono ? 0.005 : 0.03))],       // arrière du pavillon
      [X(0.985), Y(p.tailH)],
      [-L / 2, Y(p.tailH - 0.09)],
    ];
    const shape = new T.Shape();
    const yBot = gc;
    shape.moveTo(L / 2, yBot + 0.03);
    // tracé par segments avec petits congés : les cassures capot/pare-brise/
    // pavillon/hayon restent nettes → silhouette reconnaissable
    shape.lineTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length - 1; i++) {
      const [px_, py_] = top[i];
      const [ax, ay] = top[i - 1];
      const [bx, by] = top[i + 1];
      const lin = Math.hypot(px_ - ax, py_ - ay), lout = Math.hypot(bx - px_, by - py_);
      const r = Math.min(lin, lout) * 0.3;
      const inX = px_ - ((px_ - ax) / lin) * r, inY = py_ - ((py_ - ay) / lin) * r;
      const outX = px_ + ((bx - px_) / lout) * r, outY = py_ + ((by - py_) / lout) * r;
      shape.lineTo(inX, inY);
      shape.quadraticCurveTo(px_, py_, outX, outY);
    }
    shape.lineTo(top[top.length - 1][0], top[top.length - 1][1]);
    shape.lineTo(-L / 2, yBot + 0.03);
    // chemin bas : -L/2 → arche arrière → arche avant → +L/2
    shape.lineTo(rx - archR, yBot + 0.03);
    shape.absarc(rx, wr * 0.95, archR, Math.PI, 0, true);
    shape.lineTo(fx - archR, yBot + 0.03);
    shape.absarc(fx, wr * 0.95, archR, Math.PI, 0, true);
    shape.lineTo(L / 2, yBot + 0.03);

    const bevel = W * 0.045;
    const bodyW = W - bevel * 2 - 0.06;
    const body = new T.ExtrudeGeometry(shape, {
      depth: bodyW, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel * 1.15, bevelSegments: 2, curveSegments: 6,
    });
    body.translate(0, 0, -bodyW / 2);
    // recalage exact aux cotes du modèle (le biseau déborde sinon)
    body.computeBoundingBox();
    const bb = body.boundingBox;
    body.scale(L / (bb.max.x - bb.min.x), H / bb.max.y, W / (bb.max.z - bb.min.z));
    colorize(T, body, 0xffffff); // groupe peinture : blanc × material.color

    // — vitrage : quads de surface (pare-brise, custodes, lunette) —
    const gl = m.glass;
    const beltY = Y(gl.belt);
    const glassParts = [];
    // pare-brise incliné
    glassParts.push(glassQuad(T, X(p.hoodX), Y(p.hood) + 0.04, W * 0.80, X(p.roofX), Y(p.roofH) - 0.035, W * 0.70));
    // lunette arrière / hayon
    glassParts.push(glassQuad(T, X(gl.endX), Y(p.tailH) + 0.05, W * 0.78, X(p.roofEndX), Y(p.roofH) - 0.04, W * 0.70));
    // vitres latérales (trapèze avec tumblehome)
    const xa = X(p.hoodX + 0.01), xb = X(gl.endX - 0.005);
    const xa2 = X(p.roofX + 0.01), xb2 = X(Math.min(p.roofEndX, gl.endX) - 0.01);
    const yTop = Y(p.roofH) - 0.14;
    // les faces latérales de la coque extrudée sont à ±W/2 : le vitrage
    // les épouse à plat, à peine en saillie
    for (const side of [-1, 1]) {
      const zb = side * (W / 2 + 0.008), zt = side * (W / 2 + 0.002);
      glassParts.push(quad4(T,
        [xa, beltY, zb], [xb, beltY, zb], [xb2, yTop, zt], [xa2, yTop, zt]));
    }
    const glass = mergeGeoms(T, glassParts);
    for (const g of glassParts) g.dispose();

    // — détails mats (vertex colors) —
    const det = [];
    const box = (w, h, d, col, tf) => det.push(colorize(T, xform(new T.BoxGeometry(w, h, d), tf), col));
    // roues (pneus + jantes)
    const tire = () => new T.CylinderGeometry(wr, wr, 0.24, 14).rotateZ(Math.PI / 2);
    const hub = () => new T.CylinderGeometry(wr * 0.55, wr * 0.55, 0.26, 10).rotateZ(Math.PI / 2);
    const hubCol = m.sport ? 0x2a2d31 : 0xb9bec4;
    for (const ax of [fx, rx]) {
      for (const side of [-1, 1]) {
        det.push(colorize(T, xform(tire(), { x: 0, y: wr * 0.95, z: side * (W / 2 - 0.13) }).translate(ax, 0, 0), 0x15171a));
        det.push(colorize(T, xform(hub(), { x: 0, y: wr * 0.95, z: side * (W / 2 - 0.13) }).translate(ax, 0, 0), hubCol));
      }
    }
    // calandre sombre (sans logo) + boucliers
    const noseY = Y(p.nose) * 0.72;
    box(0.07, Y(p.nose) * 0.5, W * 0.55, 0x191c1f, { x: L / 2 + 0.005, y: noseY });
    box(0.1, 0.13, W * 0.94, 0x2a2d31, { x: L / 2 - 0.03, y: yBot + 0.1 });     // lame av
    box(0.1, 0.13, W * 0.94, 0x2a2d31, { x: -L / 2 + 0.03, y: yBot + 0.1 });    // lame ar
    // optiques avant (formes par époque) et feux arrière
    const ls = m.lights || 'oval';
    const lightCol = 0xd8e2ea, tailCol = 0x8e1d1a;
    const lw = { round: [0.30, 0.17], oval: [0.34, 0.13], feline: [0.44, 0.12], slim: [0.40, 0.085], blade: [0.42, 0.07], split: [0.36, 0.06] }[ls];
    const hlY = Y(p.nose + 0.06);
    for (const side of [-1, 1]) {
      const zz = side * (W / 2 - lw[0] / 2 - 0.06);
      box(0.08, lw[1], lw[0], lightCol, { x: L / 2 + 0.01, y: hlY, z: zz, ry: ls === 'feline' ? -side * 0.35 : 0 });
      if (ls === 'split') box(0.07, 0.05, lw[0] * 0.8, lightCol, { x: L / 2 + 0.01, y: hlY + 0.12, z: zz });
      box(0.07, m.kind === 'hatch' || m.kind === 'mono' ? 0.30 : 0.12, m.kind === 'hatch' || m.kind === 'mono' ? 0.13 : 0.34,
        tailCol, { x: -L / 2 - 0.01, y: Y(p.tailH - 0.08), z: side * (W / 2 - 0.17) });
    }
    // rétroviseurs
    for (const side of [-1, 1]) box(0.1, 0.09, 0.16, 0x22262a, { x: X(p.hoodX + 0.02), y: beltY + 0.05, z: side * (W / 2 + 0.06) });
    // becquet sport / barres de toit / enseigne taxi
    if (m.sport) {
      box(0.16, 0.05, W * 0.8, 0x1c1f22, { x: -L / 2 + 0.1, y: Y(p.tailH) + 0.05 });
      box(0.28, 0.07, 0.07, 0x1c1f22, { x: -L / 2 + 0.18, y: yBot + 0.06, z: 0.28 }); // échapp.
      box(0.28, 0.07, 0.07, 0x1c1f22, { x: -L / 2 + 0.18, y: yBot + 0.06, z: -0.28 });
    }
    if (m.kind === 'suv' || m.kind === 'wagon') {
      for (const side of [-1, 1]) box(L * 0.42, 0.045, 0.05, 0x2e3236, { x: X((p.roofX + p.roofEndX) / 2), y: Y(p.roofH) + 0.02, z: side * W * 0.32 });
    }
    if (m.taxi) {
      box(0.34, 0.13, 0.2, 0xf2f2ea, { x: X(p.roofX + 0.06), y: Y(p.roofH) + 0.08 });
      box(0.05, 0.05, 0.05, 0x2fbf4f, { x: X(p.roofX + 0.06) + 0.17, y: Y(p.roofH) + 0.08 });
    }
    if (m.municipal) box(L * 0.02, 0.16, W * 0.9, 0xe8eaed, { x: -L * 0.1, y: Y(0.5) }); // bande blanche

    const geom = this.assemble(body, glass, det);
    geom.userData = { fx, rx, wr, W, L, H, yBot };
    return geom;
  }

  // ---------- fourgon à caisse / dépanneuse --------------------------
  boxTruckGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const wr = m.wr;
    const cabL = L * 0.32, boxL = m.kind === 'tow' ? L * 0.52 : L * 0.62;
    // cabine : profil monospace court
    const shape = new T.Shape();
    const cabH = H * 0.62, yBot = 0.34;
    shape.moveTo(L / 2, yBot + 0.05);
    shape.lineTo(L / 2, cabH * 0.42);
    shape.quadraticCurveTo(L / 2 - 0.05, cabH * 0.7, L / 2 - cabL * 0.45, cabH * 0.97);
    shape.lineTo(L / 2 - cabL, cabH);
    shape.lineTo(L / 2 - cabL, yBot + 0.05);
    shape.closePath();
    const cabW = W * 0.94;
    const cab = new T.ExtrudeGeometry(shape, { depth: cabW, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
    cab.translate(0, 0, -cabW / 2);
    colorize(T, cab, 0xffffff);
    // pare-brise cabine + vitres de portières (quads de surface)
    const glassParts = [
      glassQuad(T, L / 2 + 0.01, cabH * 0.48, W * 0.86, L / 2 - cabL * 0.45, cabH * 0.96, W * 0.78),
    ];
    for (const side of [-1, 1]) {
      glassParts.push(quad4(T,
        [L / 2 - cabL * 0.5, cabH * 0.5, side * (W / 2 - 0.015)],
        [L / 2 - cabL * 0.95, cabH * 0.5, side * (W / 2 - 0.015)],
        [L / 2 - cabL * 0.95, cabH * 0.92, side * (W / 2 - 0.06)],
        [L / 2 - cabL * 0.55, cabH * 0.92, side * (W / 2 - 0.06)]));
    }
    const glass = mergeGeoms(T, glassParts);
    for (const g of glassParts) g.dispose();

    const det = [];
    const box = (w, h, d, col, tf) => det.push(colorize(T, xform(new T.BoxGeometry(w, h, d), tf), col));
    if (m.kind === 'tow') {
      // plateau incliné + rampe
      box(boxL, 0.12, W * 0.96, 0xb9bec4, { x: -L / 2 + boxL / 2 + 0.1, y: H * 0.42, ry: 0 });
      box(0.8, 0.1, W * 0.9, 0x8f969e, { x: -L / 2 + 0.4, y: H * 0.38 });
      box(0.08, 0.5, W * 0.85, 0x8f969e, { x: -L / 2 + boxL + 0.15, y: H * 0.55 });
      box(0.5, 0.12, 0.3, 0xffa020, { x: L / 2 - cabL * 0.5, y: cabH + 0.1 }); // rampe orange
    } else {
      // caisse
      const bh = H * 0.92 - yBot;
      const bx = -L / 2 + boxL / 2;
      const caisse = colorize(T, xform(new T.BoxGeometry(boxL, bh, W), { x: bx, y: yBot + bh / 2 }), 0xffffff);
      det.push(caisse); // peinture ? non : détail… on la met en peinture via merge → mais groupe…
    }
    // roues (face externe affleurante pour rester visibles sous la caisse)
    for (const ax of [L / 2 - cabL * 0.55, -L / 2 + L * 0.22]) {
      for (const side of [-1, 1]) {
        det.push(colorize(T, xform(new T.CylinderGeometry(wr, wr, 0.3, 12).rotateZ(Math.PI / 2),
          { x: ax, y: wr, z: side * (W / 2 - 0.14) }), 0x15171a));
        det.push(colorize(T, xform(new T.CylinderGeometry(wr * 0.5, wr * 0.5, 0.32, 10).rotateZ(Math.PI / 2),
          { x: ax, y: wr, z: side * (W / 2 - 0.14) }), 0x9aa0a6));
      }
    }
    // optiques
    for (const side of [-1, 1]) {
      box(0.06, 0.14, 0.3, 0xd8e2ea, { x: L / 2 - 0.01, y: yBot + 0.35, z: side * (W / 2 - 0.25) });
      box(0.05, 0.22, 0.12, 0x7e1a18, { x: -L / 2 + 0.02, y: yBot + 0.5, z: side * (W / 2 - 0.15) });
    }
    if (m.municipal) box(0.4, 0.12, 0.3, 0xffa020, { x: L / 2 - cabL * 0.5, y: cabH + 0.08 });
    if (m.stripe) box(m.kind === 'tow' ? 0.1 : L * 0.6, 0.3, 0.02, 0xd9b430, { x: -L * 0.15, y: H * 0.6, z: W / 2 + 0.005 });

    // caisse peinte : on la fusionne au groupe peinture
    let paintGeoms = [cab];
    if (m.kind !== 'tow') {
      const bh = H * 0.92 - yBot;
      paintGeoms.push(colorize(T, xform(new T.BoxGeometry(boxL, bh, W), { x: -L / 2 + boxL / 2, y: yBot + bh / 2 }), 0xffffff));
    }
    const body = paintGeoms.length > 1 ? mergeGeoms(T, paintGeoms) : cab;
    const geom = this.assemble(body, glass, det);
    geom.userData = { fx: L / 2 - cabL * 0.55, rx: -L / 2 + L * 0.22, wr, W, L, H, yBot };
    return geom;
  }

  // ---------- bus urbain ------------------------------------------------
  busGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const yBot = 0.3;
    const body = new T.BoxGeometry(L, H - yBot - 0.1, W);
    xform(body, { y: yBot + (H - yBot) / 2 });
    colorize(T, body, 0xffffff);
    const det = [];
    const box = (w, h, d, col, tf) => det.push(colorize(T, xform(new T.BoxGeometry(w, h, d), tf), col));
    // bande de vitrage continue
    const glass = new T.BoxGeometry(L * 0.96, H * 0.28, W + 0.02);
    xform(glass, { y: H * 0.62 });
    // pare-brise
    box(0.05, H * 0.4, W * 0.9, 0x121820, { x: L / 2 - 0.01, y: H * 0.5 });
    // bande turquoise (esprit bus parisien, sans logo)
    box(L * 0.98, 0.22, 0.02, 0x2f8c85, { y: H * 0.34, z: W / 2 + 0.005 });
    box(L * 0.98, 0.22, 0.02, 0x2f8c85, { y: H * 0.34, z: -W / 2 - 0.005 });
    // girouette
    box(L * 0.25, 0.18, 0.02, 0x14181c, { x: L / 2 - L * 0.15, y: H * 0.88, z: W / 2 + 0.005 });
    for (const ax of [L / 2 - 1.4, -L / 2 + 1.6]) {
      for (const side of [-1, 1]) {
        det.push(colorize(T, xform(new T.CylinderGeometry(m.wr, m.wr, 0.3, 12).rotateZ(Math.PI / 2),
          { x: ax, y: m.wr, z: side * (W / 2 - 0.2) }), 0x15171a));
      }
    }
    for (const side of [-1, 1]) {
      box(0.06, 0.14, 0.3, 0xd8e2ea, { x: L / 2 - 0.01, y: 0.6, z: side * (W / 2 - 0.3) });
      box(0.05, 0.25, 0.14, 0x7e1a18, { x: -L / 2 + 0.02, y: 0.7, z: side * (W / 2 - 0.2) });
    }
    const geom = this.assemble(body, glass, det);
    geom.userData = { fx: L / 2 - 1.4, rx: -L / 2 + 1.6, wr: m.wr, W, L, H, yBot };
    return geom;
  }

  // ---------- deux-roues + pilote ---------------------------------------
  motoGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const isMaxi = m.moto === 'maxiscooter' || m.moto === 'scooter';
    const wr = isMaxi ? 0.27 : 0.33;
    const det = [], paint = [];
    const box = (arr, w, h, d, col, tf) => arr.push(colorize(T, xform(new T.BoxGeometry(w, h, d), tf), col));
    const fx = L / 2 - 0.36, rx = -L / 2 + 0.38;
    // roues bien visibles + moyeux
    for (const ax of [fx, rx]) {
      det.push(colorize(T, xform(new T.CylinderGeometry(wr, wr, 0.14, 14).rotateZ(Math.PI / 2), { x: ax, y: wr }), 0x17191c));
      det.push(colorize(T, xform(new T.CylinderGeometry(wr * 0.45, wr * 0.45, 0.16, 10).rotateZ(Math.PI / 2), { x: ax, y: wr }), 0x8f969e));
    }
    const screen = 0xaec4d4, dark = 0x24262a, metal = 0x6a7076;
    let seatX, seatY;
    if (isMaxi) {
      seatX = rx + 0.55; seatY = 0.80;
      box(paint, 0.55, 0.66, W * 0.82, 0xffffff, { x: fx - 0.16, y: 0.56, rz: -0.28 });  // tablier
      box(paint, 0.62, 0.16, W * 0.78, 0xffffff, { x: 0.0, y: 0.4 });                    // plancher
      box(paint, 0.85, 0.38, W * 0.88, 0xffffff, { x: rx + 0.5, y: 0.58, rz: 0.1 });     // coque arrière
      box(det, 0.68, 0.13, W * 0.8, dark, { x: rx + 0.5, y: 0.82 });                     // selle
      box(det, 0.2, 0.14, W * 0.6, dark, { x: rx + 0.18, y: 0.94 });                     // dosseret
      box(det, 0.03, 0.42, 0.42, screen, { x: fx - 0.02, y: 1.12, rz: -0.42 });          // bulle
      box(det, 0.06, 0.1, 0.3, 0xd8e2ea, { x: fx + 0.09, y: 0.66 });                     // double optique
      box(det, 0.05, 0.05, 0.56, dark, { x: fx - 0.06, y: 1.08 });                       // guidon
      box(det, 0.4, 0.09, 0.09, metal, { x: rx + 0.32, y: 0.38, z: 0.2 });               // échappement
    } else {
      seatX = -0.28; seatY = 0.88;
      box(paint, 0.5, 0.15, 0.3, 0xffffff, { x: fx + 0.02, y: 0.82, rz: -0.14 });        // bec
      box(paint, 0.44, 0.09, 0.26, 0xffffff, { x: fx, y: 0.66 });                        // garde-boue
      box(paint, 0.62, 0.36, 0.46, 0xffffff, { x: 0.1, y: 0.94, rz: 0.08 });             // réservoir
      box(paint, 0.34, 0.12, 0.3, 0xffffff, { x: rx + 0.3, y: 0.94, rz: 0.22 });         // coque arrière
      box(det, 0.5, 0.42, 0.4, 0x33363b, { x: 0.08, y: 0.5 });                           // bloc moteur
      box(det, 0.62, 0.13, 0.36, dark, { x: seatX, y: 0.86 });                           // selle
      for (const sz of [-1, 1]) box(det, 0.06, 0.6, 0.06, 0x3a3f45, { x: fx - 0.07, y: 0.64, z: sz * 0.09, rz: -0.34 }); // fourche
      box(det, 0.03, 0.34, 0.34, screen, { x: fx - 0.2, y: 1.3, rz: -0.32 });            // bulle haute
      box(det, 0.06, 0.13, 0.15, 0xd8e2ea, { x: fx - 0.02, y: 0.95 });                   // optique
      box(det, 0.05, 0.05, 0.62, dark, { x: fx - 0.18, y: 1.14 });                       // guidon
      box(det, 0.5, 0.09, 0.09, metal, { x: rx + 0.4, y: 0.62, z: 0.17, rz: 0.22 });     // échappement relevé
      if (m.dims[1] > 0.92) { // GS : valises alu
        box(det, 0.38, 0.42, 0.2, 0x9aa0a6, { x: rx + 0.12, y: 0.66, z: W / 2 - 0.06 });
        box(det, 0.38, 0.42, 0.2, 0x9aa0a6, { x: rx + 0.12, y: 0.66, z: -(W / 2 - 0.06) });
      }
    }
    // ---- pilote assis ----
    const jacket = [0x23272c, 0x3a2e2a, 0x2c3a4a, 0x40342c][Math.round(L * 100) % 4];
    const helmet = [0x14171a, 0xc23531, 0xe8eaed, 0x3466a8][Math.round(W * 100) % 4];
    box(det, 0.36, 0.36, 0.44, 0x2a2e33, { x: seatX + (isMaxi ? 0.3 : 0.18), y: seatY + 0.12 });   // jambes
    box(det, 0.3, 0.54, 0.38, jacket, { x: seatX - 0.04, y: seatY + 0.42, rz: isMaxi ? 0.06 : 0.16 }); // torse
    box(det, 0.5, 0.09, 0.09, jacket, { x: seatX + 0.26, y: seatY + 0.52, z: 0.16, rz: -0.3 });    // bras
    box(det, 0.5, 0.09, 0.09, jacket, { x: seatX + 0.26, y: seatY + 0.52, z: -0.16, rz: -0.3 });
    det.push(colorize(T, xform(new T.SphereGeometry(0.16, 10, 8), { x: seatX + 0.02, y: seatY + 0.82 }), helmet));
    box(det, 0.08, 0.1, 0.2, 0x101418, { x: seatX + 0.15, y: seatY + 0.82 });                      // visière
    // feu arrière
    box(det, 0.04, 0.08, 0.15, 0x8e1d1a, { x: rx - 0.05, y: isMaxi ? 0.7 : 0.9 });

    const body = mergeGeoms(T, paint);
    const geom = this.assemble(body, null, det);
    geom.userData = { fx, rx, wr, W, L, H, yBot: 0.2, moto: true };
    return geom;
  }

  // ---------- assemblage 3 groupes : peinture / vitrage / détails ------
  assemble(paintGeom, glassGeom, detGeoms) {
    const T = this.T;
    const det = mergeGeoms(T, detGeoms);
    const parts = glassGeom ? [paintGeom, colorize(T, glassGeom, 0xffffff), det] : [paintGeom, det];
    const merged = mergeGeoms(T, parts);
    let off = 0;
    const counts = parts.map((g) => (g.index ? g.index.count : g.getAttribute('position').count));
    merged.clearGroups();
    merged.addGroup(0, counts[0], 0);                        // peinture
    if (glassGeom) {
      merged.addGroup(counts[0], counts[1], 1);              // vitrage
      merged.addGroup(counts[0] + counts[1], counts[2], 2);  // détails
    } else {
      merged.addGroup(counts[0], counts[1], 2);
    }
    merged.computeVertexNormals();
    for (const g of parts) g.dispose?.();
    return merged;
  }

  // ---------- instanciation d'un véhicule -------------------------------
  build(id, { color, dirt = 0, forPlayer = false } = {}) {
    const T = this.T;
    const m = CATALOG[id];
    const src = this.geometry(id);
    const geom = forPlayer ? src.clone() : src;
    const ud = src.userData;
    const paintMat = this.paint(color ?? m.cols[0], forPlayer ? 0 : dirt);
    const mesh = new T.Mesh(geom, [paintMat, this.glassMat, this.matteMat]);
    mesh.userData.ud = ud;
    const group = new T.Group();
    group.add(mesh);

    // ombre portée
    const shadow = new T.Mesh(this.shadowGeom, this.shadowMat);
    shadow.scale.set(ud.W * 1.7, 1, ud.L * 1.15);
    shadow.rotation.y = Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.renderOrder = 2;
    group.add(shadow);

    // plaques
    const plate = this.plates.get();
    const rearPlate = new T.Mesh(this.plateGeom, plate.mat);
    rearPlate.position.set(0, ud.yBot + 0.28, -ud.L / 2 - 0.015);
    rearPlate.rotation.y = Math.PI;
    if (ud.moto) { rearPlate.scale.setScalar(0.6); rearPlate.position.y = ud.wr + 0.35; }
    group.add(rearPlate);
    let frontPlate = null;
    if (!ud.moto) {
      frontPlate = new T.Mesh(this.plateGeom, plate.mat);
      frontPlate.position.set(0, ud.yBot + 0.24, ud.L / 2 + 0.015);
      group.add(frontPlate);
    }

    // feux stop (visibles au freinage) + veilleuses nuit
    const brakeG = new T.PlaneGeometry(ud.moto ? 0.14 : 0.34, 0.09);
    const brake = new T.Group();
    for (const side of ud.moto ? [0] : [-1, 1]) {
      const q = new T.Mesh(brakeG, this.glowBrake);
      q.position.set(side * (ud.W / 2 - 0.24), ud.H * (m.prof ? m.prof.tailH - 0.06 : 0.35), -ud.L / 2 - 0.02);
      q.rotation.y = Math.PI;
      brake.add(q);
    }
    brake.visible = false;
    group.add(brake);
    const glows = new T.Group();
    for (const side of ud.moto ? [0] : [-1, 1]) {
      const hq = new T.Mesh(brakeG, this.glowHead);
      hq.scale.set(1, 0.7, 1);
      hq.position.set(side * (ud.W / 2 - 0.28), ud.H * (m.prof ? m.prof.nose + 0.06 : 0.25), ud.L / 2 + 0.02);
      glows.add(hq);
      const tq = new T.Mesh(brakeG, this.glowTail);
      tq.scale.set(0.8, 0.4, 1);
      tq.position.set(side * (ud.W / 2 - 0.24), ud.H * (m.prof ? m.prof.tailH - 0.1 : 0.3), -ud.L / 2 - 0.015);
      tq.rotation.y = Math.PI;
      glows.add(tq);
    }
    glows.visible = false;
    group.add(glows);

    // gyrophare orange (dépanneuse / municipal)
    let beacon = null;
    if (m.kind === 'tow' || m.municipal) {
      beacon = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 0.18), this.glowOrange);
      beacon.position.set(0, ud.H + 0.08, ud.L * 0.17);
      group.add(beacon);
    }

    // roues séparées (joueur uniquement : rotation visible)
    let wheels = null;
    if (forPlayer && !ud.moto) {
      wheels = [];
      const tireG = new T.CylinderGeometry(ud.wr, ud.wr, 0.24, 16).rotateZ(Math.PI / 2);
      const hubG = new T.CylinderGeometry(ud.wr * 0.56, ud.wr * 0.56, 0.26, 12).rotateZ(Math.PI / 2);
      const tireM = new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 });
      const hubM = new T.MeshStandardMaterial({ color: m.sport ? 0x2a2d31 : 0xb9bec4, roughness: 0.35, metalness: 0.7 });
      for (const ax of [ud.fx, ud.rx]) {
        for (const side of [-1, 1]) {
          const w = new T.Group();
          w.add(new T.Mesh(tireG, tireM), new T.Mesh(hubG, hubM));
          // repère groupe : le véhicule roule vers +Z, l'essieu est le long de X
          w.position.set(side * (ud.W / 2 - 0.12), ud.wr * 0.95, ax);
          wheels.push(w);
          group.add(w);
        }
      }
    }

    // le mesh carrosserie est construit avant = +x ; le groupe roule vers +z
    mesh.rotation.y = -Math.PI / 2;

    return { group, mesh, spec: m, ud, brake, glows, beacon, wheels, plateText: plate.text };
  }
}
