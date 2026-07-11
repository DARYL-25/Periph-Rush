// ============================================================
// Périph' Rush — catalogue & fabrique de véhicules procéduraux
// Carrosseries construites par LOFT de sections transversales :
// galbe en plan (nez/poupe rétrécis), ligne d'épaule, passages de
// roue avec élargisseurs, pavillon peint + bandeau vitré, jantes à
// bâtons, peinture vernie, optiques émissives. Aucun logo.
// Groupes de matériaux : 0=peinture (clearcoat), 1=vitrage,
// 2=détails mats (vertex colors), 3=métal brillant (jantes, chromes),
// 4=optiques avant, 5=optiques arrière (émissives la nuit).
// ============================================================

import { mergeGeoms, colorize, xform, clamp, lerp } from './utils.js';

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
// prof: silhouette {nose, hood, hoodX, roofX, roofH, roofEndX, tailH, mono?}
//   (fractions de longueur/hauteur) · glass: {belt, endX, panel?}
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
    glass: { belt: 0.55, endX: 0.94 }, lights: 'teardrop', cols: [P.argent, ...commonCols, P.rougeVif, P.grisBleu], w: 8,
    strip: true, antennaFront: true, spokes: 12, plateHigh: true,
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
// Relève nez/capot/ceinture (proportions réelles), sauf monospaces.
for (const id of Object.keys(CATALOG)) {
  const m = CATALOG[id];
  if (!m.prof || m.prof.mono) continue;
  m.prof.nose = Math.min(m.prof.nose + 0.12, 0.56);
  m.prof.hood = Math.min(m.prof.hood + 0.12, 0.68);
  m.prof.tailH = Math.min(m.prof.tailH + 0.05, 0.8);
  if (m.glass) m.glass.belt = Math.min(m.glass.belt + 0.02, 0.66);
}

export const TRAFFIC_IDS = Object.keys(CATALOG).filter((id) => (CATALOG[id].w || 0) > 0);
export const PLAYER_IDS = Object.keys(CATALOG).filter((id) => CATALOG[id].perf);

// ============================================================
//            OUTILS GÉOMÉTRIQUES DU LOFT
// ============================================================
// interpolation Catmull-Rom dans une polyligne [[x,y]…] triée x décroissant
// (directrices lissées : capot, pavillon, ceinture — plus d'angles durs)
function polyAt(pts, x) {
  if (x >= pts[0][0]) return pts[0][1];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x <= x0 && x >= x1) {
      const t = (x0 - x) / Math.max(x0 - x1, 1e-6);
      const ym = pts[Math.max(0, i - 1)][1];
      const yp = pts[Math.min(n - 1, i + 2)][1];
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * y0) + (-ym + y1) * t +
        (2 * ym - 5 * y0 + 4 * y1 - yp) * t2 +
        (-ym + 3 * y0 - 3 * y1 + yp) * t3);
    }
  }
  return pts[n - 1][1];
}

// loft d'une bande : stations = [{x, pts:[[z,y]…]}] (même nb de pts partout)
// miroir automatique (z et -z), normales lissées par bande (arêtes nettes entre bandes)
function loftStrip(T, stations) {
  const n = stations[0].pts.length;
  const pos = [], uv = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let s = 0; s < stations.length; s++) {
      const st = stations[s];
      for (let i = 0; i < n; i++) {
        const [z, y] = st.pts[i];
        pos.push(st.x, y, z * side);
        uv.push(s / (stations.length - 1), i / (n - 1));
      }
    }
    for (let s = 0; s < stations.length - 1; s++) {
      for (let i = 0; i < n - 1; i++) {
        const a = base + s * n + i, b = a + 1, c = a + n, d = a + n + 1;
        if (side > 0) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function quad4(T, a, b, c, d) {
  const geo = new T.BufferGeometry();
  const pos = new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

// jante à bâtons + disque de frein (géométrie partagée, matériau « bright »)
// spokes élevé (ex. 12 pour la Clio 3) → branches plus fines
function rimGeometry(T, wr, spokes = 6) {
  const parts = [];
  const rr = wr * 0.62;
  parts.push(xform(new T.CylinderGeometry(rr, rr, 0.06, 18).rotateZ(Math.PI / 2), { x: 0 })); // voile
  parts.push(xform(new T.CylinderGeometry(rr * 0.22, rr * 0.22, 0.1, 10).rotateZ(Math.PI / 2), {})); // moyeu
  const th = 0.055 * Math.sqrt(6 / spokes);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const sp = new T.BoxGeometry(th, rr * 0.95, th + rr * 0.14);
    sp.translate(0, rr * 0.48, 0);
    sp.rotateX(a);
    parts.push(sp);
  }
  const g = mergeGeoms(T, parts);
  for (const p2 of parts) p2.dispose();
  return g;
}
function tireGeometry(T, wr, tw = 0.245) {
  return new T.CylinderGeometry(wr, wr, tw, 22).rotateZ(Math.PI / 2);
}

// ============================================================
//                      FABRIQUE
// ============================================================
export class VehicleFactory {
  constructor(THREE, platePool) {
    this.T = THREE;
    this.plates = platePool;
    this.geomCache = new Map();
    this.rimCache = new Map();
    this.paintCache = new Map();
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d1218, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06,
      envMapIntensity: 1.5, side: THREE.DoubleSide,
    });
    this.matteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
    this.brightMat = new THREE.MeshStandardMaterial({ color: 0xd4d8dd, roughness: 0.22, metalness: 0.95 });
    this.lensFMat = new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.18, metalness: 0.4, emissive: 0xfff3d8, emissiveIntensity: 0 });
    this.lensRMat = new THREE.MeshStandardMaterial({ color: 0x81201c, roughness: 0.2, metalness: 0.3, emissive: 0xff2418, emissiveIntensity: 0 });
    this.glowBrake = new THREE.MeshBasicMaterial({ color: 0xff3524 });
    this.glowOrange = new THREE.MeshBasicMaterial({ color: 0xffa020 });
    this.plateGeom = new THREE.PlaneGeometry(0.5, 0.11);
    this.materials = [null, this.glassMat, this.matteMat, this.brightMat, this.lensFMat, this.lensRMat];
  }

  // phares/feux du parc entier (matériaux partagés)
  setNight(on) {
    this.lensFMat.emissiveIntensity = on ? 2.4 : 0;
    this.lensRMat.emissiveIntensity = on ? 1.5 : 0;
  }

  paint(hex, dirt = 0) {
    const key = `${hex}:${dirt}`;
    if (this.paintCache.has(key)) return this.paintCache.get(key);
    const c = new this.T.Color(hex);
    if (dirt > 0) c.lerp(new this.T.Color(0x6b5f4e), dirt * 0.2);
    const m = new this.T.MeshPhysicalMaterial({
      color: c, metalness: 0.55, roughness: 0.32 + dirt * 0.22,
      clearcoat: 1 - dirt * 0.45, clearcoatRoughness: 0.08 + dirt * 0.2,
      envMapIntensity: 1.05,
    });
    this.paintCache.set(key, m);
    return m;
  }

  rim(wr, sport, spokes) {
    const n = spokes ?? (sport ? 10 : 6);
    const key = `${wr}:${n}`;
    if (!this.rimCache.has(key)) this.rimCache.set(key, rimGeometry(this.T, wr, n));
    return this.rimCache.get(key);
  }

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

  // ---------- carrosserie par loft de sections -------------------------
  carGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const p = m.prof;
    const X = (f) => L / 2 - f * L, Y = (f) => f * H;
    const wr = m.wr, gc = m.clearance ?? 0.26;
    const frontOver = (L - m.wb) * 0.42;
    const fx = L / 2 - frontOver - wr, rx = fx - m.wb;
    const archR = wr + 0.055;
    const axleY = wr * 0.95;
    const sport = !!m.sport;
    const flareAmt = sport ? 0.055 : m.kind === 'suv' ? 0.045 : 0.028;

    // — courbes directrices —
    const belt0 = Y(m.glass.belt);
    const cabF = X(p.hoodX), cabR = X(m.glass.endX);
    // fourgon vitré à l'avant seulement : la caisse suit le pavillon jusqu'à l'arrière
    const panel = !!m.glass.panel;
    const cabEnd = panel ? X(0.975) : cabR;
    const isHatch = ['hatch', 'mono', 'van', 'suv', 'wagon'].includes(m.kind);
    const deckPts = [
      [L / 2 + 1, Y(p.nose) - 0.02], [L / 2, Y(p.nose)], [X(0.05), Y(p.nose) + 0.06],
      [cabF, Y(p.hood)],
      [lerp(cabF, cabEnd, 0.5), belt0 + 0.03],
      [cabEnd, belt0 + 0.05],
      [X(0.985), Math.max(Y(p.tailH), panel ? belt0 : 0)], [-L / 2 - 1, Y(p.tailH) - 0.05],
    ];
    const tailGlassY = panel ? Y(p.roofH) - 0.06
      : isHatch ? Y(p.tailH) + 0.04 : belt0 + 0.08;
    const roofPts = [
      [cabF + 0.01, Y(p.hood) + 0.02],
      [cabF - 0.03, Y(p.hood) + 0.09], // cassure nette à la base du pare-brise
      [lerp(cabF, X(p.roofX), 0.55), lerp(Y(p.hood), Y(p.roofH), 0.66)],
      [X(p.roofX), Y(p.roofH)],
      [X(p.roofEndX), Y(p.roofH) - (p.mono ? 0.01 : 0.035)],
      [cabEnd - 0.01, tailGlassY],
    ];
    const deckY = (x) => polyAt(deckPts, x);
    const roofY = (x) => polyAt(roofPts, x);

    // galbe en plan : nez et poupe rétrécis
    const taper = (x) => {
      const xi = clamp((L / 2 - x) / L, 0, 1);
      const f = 1 - 0.16 * Math.pow(Math.max(0, (0.16 - xi) / 0.16), 1.7);
      const r = 1 - 0.11 * Math.pow(Math.max(0, (xi - 0.86) / 0.14), 1.7);
      return f * r;
    };
    // élargisseurs d'ailes + relevage du bas de caisse sur les passages de roue
    const archWin = (x) => {
      let w = 0;
      for (const ax of [fx, rx]) {
        const d = Math.abs(x - ax) / (archR + 0.16);
        if (d < 1) w = Math.max(w, Math.cos((d * Math.PI) / 2) ** 2);
      }
      return w;
    };
    const botAt = (x) => {
      let y = gc;
      for (const ax of [fx, rx]) {
        const dx = Math.abs(x - ax);
        if (dx < archR) y = Math.max(y, axleY + Math.sqrt(archR * archR - dx * dx));
      }
      return y;
    };

    // — stations —
    const xsSet = new Set([L / 2 - 0.01, X(0.03), X(0.08), X(0.14)]);
    for (const ax of [fx, rx]) for (const d of [-archR, -archR * 0.8, -archR * 0.45, 0, archR * 0.45, archR * 0.8, archR]) xsSet.add(ax + d);
    for (const f of [p.hoodX * 0.55, p.hoodX, p.hoodX + 0.05, p.roofX * 0.75 + p.hoodX * 0.25, p.roofX, (p.roofX + p.roofEndX) / 2, p.roofEndX, p.roofEndX + 0.04, m.glass.endX, 0.94]) xsSet.add(X(f));
    xsSet.add(-L / 2 + 0.01);
    let xs = [...xsSet].filter((x) => x <= L / 2 && x >= -L / 2).sort((a, b) => b - a);
    // pincements avant/arrière (capots de nez/poupe arrondis)
    const stationsOf = (mk) => {
      const list = [];
      // pincement léger : bouclier franc, coins arrondis
      list.push(mk(L / 2 - 0.003, 0.80, 0));
      for (const x of xs) list.push(mk(x, 1, 0));
      list.push(mk(-L / 2 + 0.003, 0.82, 0));
      return list;
    };

    const secW = (x, pinch) => (W / 2 - 0.02) * taper(x) * pinch * (1 + flareAmt * archWin(x));
    // bande basse : bas de caisse → épaule
    const stripA = stationsOf((x, pinch, lift) => {
      const w = secW(x, pinch);
      const yB = botAt(x) + lift * 0.12;
      const deck = deckY(x);
      const sh = deck - 0.075;
      return { x, pts: [[w * 0.90, yB], [w * 0.995, lerp(yB, sh, 0.42)], [w, sh]] };
    });
    // bande haute : épaule → pont central (capot/ceinture/malle)
    const stripB = stationsOf((x, pinch) => {
      const w = secW(x, pinch);
      const deck = deckY(x);
      return { x, pts: [[w, deck - 0.075], [w * 0.985, deck - 0.035], [w * 0.84, deck], [0, deck + 0.026]] };
    });
    // dessous (ferme le volume pour les ombres)
    const stripU = stationsOf((x, pinch) => {
      const w = secW(x, pinch);
      const yB = botAt(x);
      return { x, pts: [[0, yB], [w * 0.9, yB]] };
    });

    // — cabine : bandeau vitré + pavillon peint —
    const cabRange = (x0, x1) => {
      const list = xs.filter((x) => x < x0 && x > x1);
      return [x0, ...list, x1];
    };
    const cabStation = (x, mkPts) => ({ x, pts: mkPts(x) });
    const cabW = (x) => secW(x, 1) - 0.015;
    const bandPts = (xx) => {
      const w = cabW(xx), deck = deckY(xx), rY = Math.max(roofY(xx), deck + 0.02);
      const y0 = deck + 0.008;
      return [[w * 0.955, y0], [w * 0.78, Math.max(rY - 0.045, y0 + 0.004)]];
    };
    const glassStrip = loftStrip(T, cabRange(cabF, cabR).map((x) => cabStation(x, bandPts)));
    const roofStrip = loftStrip(T, cabRange(cabF, cabEnd).map((x) => cabStation(x, (xx) => {
      const w = cabW(xx), deck = deckY(xx), rY = Math.max(roofY(xx), deck + 0.02);
      return [[w * 0.78, rY - 0.045], [w * 0.60, rY], [0, rY + 0.018]];
    })));

    const paint = [loftStrip(T, stripA), loftStrip(T, stripB), roofStrip];
    // fourgon : flanc de caisse peint entre la fin du vitrage et l'arrière
    if (panel) paint.push(loftStrip(T, cabRange(cabR, cabEnd).map((x) => cabStation(x, bandPts))));
    const glass = [glassStrip];
    const det = [], bright = [], lensF = [], lensR = [];
    const box = (arr, w, h, d, tf, col) => {
      const g = xform(new T.BoxGeometry(w, h, d), tf);
      arr.push(arr === det ? colorize(T, g, col ?? 0x24262a) : g);
    };

    // — montants A/C peints (par-dessus le bandeau vitré) —
    for (const side of [-1, 1]) {
      const zA = (x) => side * (cabW(x) * 0.955 + 0.006);
      const zT = (x) => side * (cabW(x) * 0.78 + 0.006);
      const aX0 = cabF, aX1 = X(p.roofX);
      paint.push(quad4(T,
        [aX0, deckY(aX0) + 0.01, zA(aX0)], [aX0 - 0.10, deckY(aX0) + 0.01, zA(aX0)],
        [aX1 - 0.10, roofY(aX1) - 0.05, zT(aX1)], [aX1, roofY(aX1) - 0.05, zT(aX1)]));
      const cX0 = X(p.roofEndX), cX1 = cabR;
      if (!m.glass.panel) {
        paint.push(quad4(T,
          [cX1 + 0.12, deckY(cX1) + 0.01, zA(cX1)], [cX1, deckY(cX1) + 0.01, zA(cX1)],
          [cX0, roofY(cX0) - 0.05, zT(cX0)], [cX0 + 0.12, roofY(cX0) - 0.05, zT(cX0)]));
      }
    }

    // — roues fusionnées (PNJ) : pneu (mat) + jante à bâtons (chrome/anthracite) —
    const rimG = this.rim(wr, sport, m.spokes);
    for (const ax of [fx, rx]) {
      for (const side of [-1, 1]) {
        const tire = tireGeometry(T, wr * 1.04);
        xform(tire, { x: ax, y: axleY, z: side * (W / 2 - 0.105) });
        det.push(colorize(T, tire, 0x141619));
        const rim = rimG.clone();
        xform(rim, { x: ax, y: axleY, z: side * (W / 2 - 0.105) + side * 0.055 });
        if (sport) det.push(colorize(T, rim, 0x2b2e33));
        else bright.push(rim);
        // voile intérieur d'arche sombre
        box(det, archR * 1.7, archR * 1.1, 0.3, { x: ax, y: axleY + 0.2, z: side * (W / 2 - 0.3) }, 0x0d0f12);
      }
    }

    // — face avant : calandre, optiques (habillage chrome + lentille émissive) —
    const noseY = Y(p.nose);
    const ls = m.lights || 'oval';
    if (ls === 'teardrop') {
      // Clio 3 : fente de calandre étroite sous le capot + grande entrée basse + antibrouillards
      box(det, 0.08, 0.07, W * 0.36, { x: L / 2 - 0.015, y: noseY + 0.13 }, 0x101316);
      box(det, 0.09, 0.17, W * 0.46, { x: L / 2 - 0.02, y: gc + 0.16 }, 0x101316);
      for (const side of [-1, 1]) {
        bright.push(xform(new T.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateZ(Math.PI / 2),
          { x: L / 2 - 0.01, y: gc + 0.17, z: side * W * 0.3 }));
      }
    } else {
      box(det, 0.08, noseY * 0.42, W * 0.52, { x: L / 2 - 0.02, y: noseY * 0.66 }, 0x101316);
    }
    box(det, 0.1, 0.12, W * 0.9, { x: L / 2 - 0.03, y: gc + 0.1 }, 0x1c1f23);         // lame av
    box(det, 0.1, 0.12, W * 0.9, { x: -L / 2 + 0.03, y: gc + 0.1 }, 0x1c1f23);        // lame ar
    const lw = { round: [0.3, 0.17], oval: [0.35, 0.13], feline: [0.46, 0.115], slim: [0.42, 0.085], blade: [0.44, 0.07], split: [0.36, 0.06], teardrop: [0.4, 0.15] }[ls];
    const hlY = noseY + 0.09;
    for (const side of [-1, 1]) {
      const zz = side * (secW(L / 2 - 0.03, 0.86) - lw[0] / 2);
      if (ls === 'teardrop') {
        // optique en goutte d'eau : lentille au coin, pointe couchée SUR l'aile
        // (ancrée à la surface réelle du capot via deckY)
        const xMain = L / 2 - 0.14;
        const zc = side * (secW(xMain, 0.94) - 0.17);
        const yMain = Math.min(hlY + 0.03, deckY(xMain) - 0.07);
        bright.push(xform(new T.BoxGeometry(0.22, 0.18, 0.26), { x: xMain - 0.02, y: yMain, z: zc, ry: -side * 0.22 }));
        lensF.push(xform(new T.BoxGeometry(0.22, 0.15, 0.24), { x: xMain, y: yMain + 0.01, z: zc, ry: -side * 0.22 }));
        // pointe effilée à demi noyée dans le capot, remontant vers l'aile
        const xTail = L / 2 - 0.36;
        const zTail = side * (secW(xTail, 1) - 0.15);
        lensF.push(xform(new T.BoxGeometry(0.3, 0.07, 0.13), {
          x: xTail, y: deckY(xTail) - 0.015, z: zTail, ry: -side * 0.42, rz: -0.1,
        }));
      } else {
        const ry = ls === 'feline' ? -side * 0.4 : -side * 0.12;
        bright.push(xform(new T.BoxGeometry(0.05, lw[1] + 0.03, lw[0] + 0.03), { x: L / 2 - 0.035, y: hlY, z: zz, ry }));
        lensF.push(xform(new T.BoxGeometry(0.05, lw[1], lw[0]), { x: L / 2 - 0.012, y: hlY, z: zz, ry }));
        if (ls === 'split' || ls === 'blade') {
          lensF.push(xform(new T.BoxGeometry(0.04, 0.035, lw[0] * 0.7), { x: L / 2 - 0.01, y: hlY + lw[1] / 2 + 0.05, z: zz, ry }));
        }
      }
      // feux arrière (bien à plat sur la face arrière, à l'intérieur du pincement)
      const tall = isHatch && m.kind !== 'wagon';
      const wRear = secW(-L / 2 + 0.02, 0.84);
      if (ls === 'teardrop') {
        // Clio 3 : blocs verticaux en goutte qui enveloppent l'angle, insert blanc central
        const zr = side * (wRear - 0.17);
        lensR.push(xform(new T.BoxGeometry(0.1, 0.32, 0.15), { x: -L / 2 + 0.03, y: Y(p.tailH) - 0.19, z: zr, ry: side * 0.3 }));
        bright.push(xform(new T.BoxGeometry(0.05, 0.11, 0.07), { x: -L / 2 + 0.005, y: Y(p.tailH) - 0.2, z: zr - side * 0.02, ry: side * 0.3 }));
      } else {
        lensR.push(xform(new T.BoxGeometry(0.06, tall ? 0.26 : 0.11, tall ? 0.13 : 0.3),
          { x: -L / 2 + 0.015, y: Y(p.tailH) - 0.13, z: side * (wRear - (tall ? 0.26 : 0.34)) }));
      }
    }
    // rétroviseurs peints + poignées chromées
    for (const side of [-1, 1]) {
      paint.push(xform(new T.BoxGeometry(0.1, 0.09, 0.17), { x: cabF - 0.02, y: deckY(cabF) + 0.07, z: side * (cabW(cabF) + 0.09) }));
      for (const hx of [cabF - L * 0.13, cabF - L * 0.3]) {
        if (hx > cabR) bright.push(xform(new T.BoxGeometry(0.14, 0.025, 0.02), { x: hx, y: deckY(hx) - 0.11, z: side * (secW(hx, 1) + 0.004) }));
      }
    }
    // équipements par type
    if (sport) {
      box(det, 0.14, 0.05, W * 0.8, { x: -L / 2 + 0.1, y: Y(p.tailH) + 0.04 }, 0x17191c);       // becquet
      for (const side of [-1, 1]) bright.push(xform(new T.CylinderGeometry(0.045, 0.045, 0.1, 10).rotateZ(Math.PI / 2), { x: -L / 2 + 0.06, y: gc + 0.08, z: side * W * 0.28 }));
    }
    if (m.kind === 'suv' || m.kind === 'wagon') {
      for (const side of [-1, 1]) box(det, L * 0.4, 0.04, 0.05, { x: X((p.roofX + p.roofEndX) / 2), y: Y(p.roofH) + 0.02, z: side * W * 0.3 }, 0x2e3236);
    }
    if (m.taxi) {
      box(det, 0.32, 0.13, 0.2, { x: X(p.roofX + 0.06), y: Y(p.roofH) + 0.08 }, 0xf2f2ea);
      box(det, 0.05, 0.05, 0.05, { x: X(p.roofX + 0.06) + 0.17, y: Y(p.roofH) + 0.08 }, 0x2fbf4f);
    }
    // baguettes de protection latérales (Clio 3 et modèles des années 2000)
    if (m.strip) {
      const sLen = (fx - rx) - archR * 2 - 0.15;
      for (const side of [-1, 1]) {
        box(det, sLen, 0.045, 0.02, { x: (fx + rx) / 2, y: Y(m.glass.belt) * 0.62, z: side * (W / 2 + 0.008) }, 0x1c1f22);
      }
    }
    if (m.antennaFront) {
      // antenne tige inclinée à l'avant du pavillon
      const ax2 = X(p.roofX + 0.03);
      det.push(colorize(T, xform(new T.CylinderGeometry(0.012, 0.016, 0.3, 6),
        { x: ax2 - 0.06, y: roofY(ax2) + 0.13, rz: 0.55 }), 0x17191c));
    } else {
      box(det, 0.16, 0.05, 0.03, { x: X(p.roofEndX + 0.02), y: roofY(X(p.roofEndX + 0.02)) + 0.03 }, 0x17191c); // antenne aileron
    }

    const geom = this.assemble({ paint, glass, det, bright, lensF, lensR });
    geom.userData = { fx, rx, wr, W, L, H, yBot: gc };
    return geom;
  }

  // ---------- fourgon à caisse / dépanneuse --------------------------
  boxTruckGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const wr = m.wr;
    const cabL = L * 0.32, boxL = m.kind === 'tow' ? L * 0.52 : L * 0.62;
    const cabH = H * 0.62, yBot = 0.34;
    const paint = [], det = [], bright = [], lensF = [], lensR = [], glass = [];
    const shape = new T.Shape();
    shape.moveTo(L / 2, yBot + 0.05);
    shape.lineTo(L / 2, cabH * 0.42);
    shape.quadraticCurveTo(L / 2 - 0.05, cabH * 0.7, L / 2 - cabL * 0.45, cabH * 0.97);
    shape.lineTo(L / 2 - cabL, cabH);
    shape.lineTo(L / 2 - cabL, yBot + 0.05);
    shape.closePath();
    const cabW = W * 0.94;
    const cab = new T.ExtrudeGeometry(shape, { depth: cabW, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    cab.translate(0, 0, -cabW / 2);
    paint.push(cab);
    if (m.kind !== 'tow') {
      const bh = H * 0.92 - yBot;
      paint.push(xform(new T.BoxGeometry(boxL, bh, W), { x: -L / 2 + boxL / 2, y: yBot + bh / 2 }));
    }
    // pare-brise + vitres de portières
    glass.push(quad4(T,
      [L / 2 + 0.01, cabH * 0.48, -W * 0.43], [L / 2 + 0.01, cabH * 0.48, W * 0.43],
      [L / 2 - cabL * 0.45, cabH * 0.96, W * 0.39], [L / 2 - cabL * 0.45, cabH * 0.96, -W * 0.39]));
    for (const side of [-1, 1]) {
      glass.push(quad4(T,
        [L / 2 - cabL * 0.5, cabH * 0.5, side * (W / 2 + 0.005)],
        [L / 2 - cabL * 0.95, cabH * 0.5, side * (W / 2 + 0.005)],
        [L / 2 - cabL * 0.95, cabH * 0.92, side * (W / 2 - 0.03)],
        [L / 2 - cabL * 0.55, cabH * 0.92, side * (W / 2 - 0.03)]));
    }
    const box = (arr, w, h, d, tf, col) => {
      const g = xform(new T.BoxGeometry(w, h, d), tf);
      arr.push(arr === det ? colorize(T, g, col ?? 0x24262a) : g);
    };
    if (m.kind === 'tow') {
      box(det, boxL, 0.12, W * 0.96, { x: -L / 2 + boxL / 2 + 0.1, y: H * 0.42 }, 0xb9bec4);
      box(det, 0.8, 0.1, W * 0.9, { x: -L / 2 + 0.4, y: H * 0.38 }, 0x8f969e);
      box(det, 0.08, 0.5, W * 0.85, { x: -L / 2 + boxL + 0.15, y: H * 0.55 }, 0x8f969e);
      box(det, 0.5, 0.12, 0.3, { x: L / 2 - cabL * 0.5, y: cabH + 0.1 }, 0xffa020);
    }
    const rimG = this.rim(wr, false);
    for (const ax of [L / 2 - cabL * 0.55, -L / 2 + L * 0.22]) {
      for (const side of [-1, 1]) {
        det.push(colorize(T, xform(tireGeometry(T, wr, 0.3), { x: ax, y: wr, z: side * (W / 2 - 0.14) }), 0x141619));
        bright.push(xform(rimG.clone(), { x: ax, y: wr, z: side * (W / 2 - 0.14) + side * 0.06 }));
      }
    }
    for (const side of [-1, 1]) {
      lensF.push(xform(new T.BoxGeometry(0.05, 0.14, 0.3), { x: L / 2 - 0.005, y: yBot + 0.35, z: side * (W / 2 - 0.25) }));
      lensR.push(xform(new T.BoxGeometry(0.05, 0.22, 0.12), { x: -L / 2 + 0.005, y: yBot + 0.5, z: side * (W / 2 - 0.15) }));
    }
    if (m.municipal) box(det, 0.4, 0.12, 0.3, { x: L / 2 - cabL * 0.5, y: cabH + 0.08 }, 0xffa020);
    if (m.stripe) box(det, L * 0.6, 0.3, 0.02, { x: -L * 0.15, y: H * 0.6, z: W / 2 + 0.005 }, 0xd9b430);

    const geom = this.assemble({ paint, glass, det, bright, lensF, lensR });
    geom.userData = { fx: L / 2 - cabL * 0.55, rx: -L / 2 + L * 0.22, wr, W, L, H, yBot };
    return geom;
  }

  // ---------- bus urbain ------------------------------------------------
  busGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const yBot = 0.3;
    const paint = [], det = [], bright = [], lensF = [], lensR = [], glass = [];
    const body = xform(new T.BoxGeometry(L, H - yBot - 0.1, W), { y: yBot + (H - yBot) / 2 });
    paint.push(body);
    glass.push(xform(new T.BoxGeometry(L * 0.96, H * 0.28, W + 0.02), { y: H * 0.62 }));
    glass.push(xform(new T.BoxGeometry(0.06, H * 0.42, W * 0.9), { x: L / 2 + 0.01, y: H * 0.5 }));
    const box = (arr, w, h, d, tf, col) => {
      const g = xform(new T.BoxGeometry(w, h, d), tf);
      arr.push(arr === det ? colorize(T, g, col ?? 0x24262a) : g);
    };
    box(det, L * 0.98, 0.22, 0.02, { y: H * 0.34, z: W / 2 + 0.005 }, 0x2f8c85);
    box(det, L * 0.98, 0.22, 0.02, { y: H * 0.34, z: -W / 2 - 0.005 }, 0x2f8c85);
    box(det, L * 0.25, 0.18, 0.02, { x: L / 2 - L * 0.15, y: H * 0.88, z: W / 2 + 0.005 }, 0x14181c);
    // portes
    for (const dx of [L * 0.18, -L * 0.1, -L * 0.35]) {
      box(det, 1.15, H * 0.52, 0.015, { x: dx, y: yBot + H * 0.3, z: W / 2 + 0.006 }, 0x3d4348);
    }
    for (const ax of [L / 2 - 1.4, -L / 2 + 1.6]) {
      for (const side of [-1, 1]) {
        det.push(colorize(T, xform(tireGeometry(T, m.wr, 0.32), { x: ax, y: m.wr, z: side * (W / 2 - 0.18) }), 0x141619));
      }
    }
    for (const side of [-1, 1]) {
      lensF.push(xform(new T.BoxGeometry(0.05, 0.14, 0.3), { x: L / 2 + 0.005, y: 0.6, z: side * (W / 2 - 0.3) }));
      lensR.push(xform(new T.BoxGeometry(0.05, 0.25, 0.14), { x: -L / 2 - 0.005, y: 0.7, z: side * (W / 2 - 0.2) }));
    }
    const geom = this.assemble({ paint, glass, det, bright, lensF, lensR });
    geom.userData = { fx: L / 2 - 1.4, rx: -L / 2 + 1.6, wr: m.wr, W, L, H, yBot };
    return geom;
  }

  // ---------- deux-roues + pilote ---------------------------------------
  motoGeometry(m) {
    const T = this.T;
    const [L, W, H] = m.dims;
    const isMaxi = m.moto === 'maxiscooter' || m.moto === 'scooter';
    const wr = isMaxi ? 0.27 : 0.33;
    const paint = [], det = [], bright = [], lensF = [], lensR = [], glass = [];
    const box = (arr, w, h, d, tf, col) => {
      const g = xform(new T.BoxGeometry(w, h, d), tf);
      arr.push(arr === det ? colorize(T, g, col ?? 0x24262a) : g);
    };
    const fx = L / 2 - 0.36, rx = -L / 2 + 0.38;
    for (const ax of [fx, rx]) {
      det.push(colorize(T, xform(new T.CylinderGeometry(wr, wr, 0.14, 16).rotateZ(Math.PI / 2), { x: ax, y: wr }), 0x141619));
      bright.push(xform(new T.CylinderGeometry(wr * 0.45, wr * 0.45, 0.16, 12).rotateZ(Math.PI / 2), { x: ax, y: wr }));
    }
    const dark = 0x24262a, metal = 0x6a7076;
    let seatX, seatY;
    if (isMaxi) {
      seatX = rx + 0.55; seatY = 0.80;
      box(paint, 0.55, 0.66, W * 0.82, { x: fx - 0.16, y: 0.56, rz: -0.28 });
      box(paint, 0.62, 0.16, W * 0.78, { x: 0.0, y: 0.4 });
      box(paint, 0.85, 0.38, W * 0.88, { x: rx + 0.5, y: 0.58, rz: 0.1 });
      box(det, 0.68, 0.13, W * 0.8, { x: rx + 0.5, y: 0.82 }, dark);
      box(det, 0.2, 0.14, W * 0.6, { x: rx + 0.18, y: 0.94 }, dark);
      glass.push(xform(new T.BoxGeometry(0.02, 0.42, 0.42), { x: fx - 0.02, y: 1.12, rz: -0.42 }));
      lensF.push(xform(new T.BoxGeometry(0.05, 0.1, 0.3), { x: fx + 0.1, y: 0.66 }));
      box(det, 0.05, 0.05, 0.56, { x: fx - 0.06, y: 1.08 }, dark);
      box(det, 0.4, 0.09, 0.09, { x: rx + 0.32, y: 0.38, z: 0.2 }, metal);
    } else {
      seatX = -0.28; seatY = 0.88;
      box(paint, 0.5, 0.15, 0.3, { x: fx + 0.02, y: 0.82, rz: -0.14 });
      box(paint, 0.44, 0.09, 0.26, { x: fx, y: 0.66 });
      box(paint, 0.62, 0.36, 0.46, { x: 0.1, y: 0.94, rz: 0.08 });
      box(paint, 0.34, 0.12, 0.3, { x: rx + 0.3, y: 0.94, rz: 0.22 });
      box(det, 0.5, 0.42, 0.4, { x: 0.08, y: 0.5 }, 0x33363b);
      box(det, 0.62, 0.13, 0.36, { x: seatX, y: 0.86 }, dark);
      for (const sz of [-1, 1]) box(det, 0.06, 0.6, 0.06, { x: fx - 0.07, y: 0.64, z: sz * 0.09, rz: -0.34 }, 0x3a3f45);
      glass.push(xform(new T.BoxGeometry(0.02, 0.34, 0.34), { x: fx - 0.2, y: 1.3, rz: -0.32 }));
      lensF.push(xform(new T.BoxGeometry(0.05, 0.13, 0.15), { x: fx - 0.02, y: 0.95 }));
      box(det, 0.05, 0.05, 0.62, { x: fx - 0.18, y: 1.14 }, dark);
      box(det, 0.5, 0.09, 0.09, { x: rx + 0.4, y: 0.62, z: 0.17, rz: 0.22 }, metal);
      if (m.dims[1] > 0.92) {
        box(det, 0.38, 0.42, 0.2, { x: rx + 0.12, y: 0.66, z: W / 2 - 0.06 }, 0x9aa0a6);
        box(det, 0.38, 0.42, 0.2, { x: rx + 0.12, y: 0.66, z: -(W / 2 - 0.06) }, 0x9aa0a6);
      }
    }
    const jacket = [0x23272c, 0x3a2e2a, 0x2c3a4a, 0x40342c][Math.round(L * 100) % 4];
    const helmet = [0x14171a, 0xc23531, 0xe8eaed, 0x3466a8][Math.round(W * 100) % 4];
    box(det, 0.36, 0.36, 0.44, { x: seatX + (isMaxi ? 0.3 : 0.18), y: seatY + 0.12 }, 0x2a2e33);
    box(det, 0.3, 0.54, 0.38, { x: seatX - 0.04, y: seatY + 0.42, rz: isMaxi ? 0.06 : 0.16 }, jacket);
    box(det, 0.5, 0.09, 0.09, { x: seatX + 0.26, y: seatY + 0.52, z: 0.16, rz: -0.3 }, jacket);
    box(det, 0.5, 0.09, 0.09, { x: seatX + 0.26, y: seatY + 0.52, z: -0.16, rz: -0.3 }, jacket);
    det.push(colorize(T, xform(new T.SphereGeometry(0.16, 12, 10), { x: seatX + 0.02, y: seatY + 0.82 }), helmet));
    box(det, 0.08, 0.1, 0.2, { x: seatX + 0.15, y: seatY + 0.82 }, 0x101418);
    lensR.push(xform(new T.BoxGeometry(0.04, 0.08, 0.15), { x: rx - 0.05, y: isMaxi ? 0.7 : 0.9 }));

    const geom = this.assemble({ paint, glass, det, bright, lensF, lensR });
    geom.userData = { fx, rx, wr, W, L, H, yBot: 0.2, moto: true };
    return geom;
  }

  // ---------- assemblage en 6 groupes de matériaux ----------------------
  assemble(parts) {
    const T = this.T;
    const order = ['paint', 'glass', 'det', 'bright', 'lensF', 'lensR'];
    const merged = [];
    const groups = [];
    let offset = 0;
    order.forEach((name, mi) => {
      const list = parts[name];
      if (!list || !list.length) return;
      // le groupe "det" exige des couleurs de sommets ; les autres non
      const cleaned = list.map((g) => {
        if (name === 'det' && !g.getAttribute('color')) colorize(T, g, 0x24262a);
        if (name !== 'det' && g.getAttribute('color')) g.deleteAttribute('color');
        if (!g.getAttribute('uv')) {
          const n = g.getAttribute('position').count;
          g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
        }
        return g;
      });
      const g = cleaned.length > 1 ? mergeGeoms(T, cleaned) : cleaned[0];
      const count = g.index ? g.index.count : g.getAttribute('position').count;
      groups.push({ start: offset, count, materialIndex: mi });
      offset += count;
      merged.push({ g, name });
    });
    // fusion finale : uniformise les attributs (couleur blanche là où absente)
    for (const { g } of merged) {
      if (!g.getAttribute('color')) colorize(T, g, 0xffffff);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
    }
    const geom = mergeGeoms(T, merged.map((m2) => m2.g));
    geom.clearGroups();
    for (const gr of groups) geom.addGroup(gr.start, gr.count, gr.materialIndex);
    for (const { g } of merged) g.dispose();
    return geom;
  }

  // ---------- instanciation d'un véhicule -------------------------------
  build(id, { color, dirt = 0, forPlayer = false } = {}) {
    const T = this.T;
    const m = CATALOG[id];
    const src = this.geometry(id);
    const geom = forPlayer ? src.clone() : src;
    const ud = src.userData;
    const paintMat = this.paint(color ?? m.cols[0], forPlayer ? 0 : dirt);
    const mats = [paintMat, this.glassMat, this.matteMat, this.brightMat, this.lensFMat, this.lensRMat];
    const mesh = new T.Mesh(geom, mats);
    mesh.castShadow = true;
    mesh.userData.ud = ud;
    const group = new T.Group();
    group.add(mesh);

    // plaques
    const plate = this.plates.get();
    const rearPlate = new T.Mesh(this.plateGeom, plate.mat);
    // plaque arrière sur le hayon (Clio 3…) ou sur le bouclier selon le modèle
    rearPlate.position.set(0, m.plateHigh ? ud.H * 0.37 : ud.yBot + 0.26, -ud.L / 2 - 0.02);
    rearPlate.rotation.y = Math.PI;
    if (ud.moto) { rearPlate.scale.setScalar(0.6); rearPlate.position.y = ud.wr + 0.35; }
    group.add(rearPlate);
    if (!ud.moto) {
      const frontPlate = new T.Mesh(this.plateGeom, plate.mat);
      frontPlate.position.set(0, ud.yBot + 0.22, ud.L / 2 + 0.02);
      group.add(frontPlate);
    }

    // feux stop (superposition brillante au freinage)
    const brakeG = new T.PlaneGeometry(ud.moto ? 0.14 : 0.3, 0.09);
    const brake = new T.Group();
    for (const side of ud.moto ? [0] : [-1, 1]) {
      const q = new T.Mesh(brakeG, this.glowBrake);
      q.position.set(side * (ud.W / 2 - 0.42), ud.H * (m.prof ? m.prof.tailH - 0.09 : 0.35), -ud.L / 2 - 0.03);
      q.rotation.y = Math.PI;
      brake.add(q);
    }
    brake.visible = false;
    group.add(brake);
    const glows = new T.Group(); // compat (les lentilles émissives font le travail)
    glows.visible = false;
    group.add(glows);

    let beacon = null;
    if (m.kind === 'tow' || m.municipal) {
      beacon = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 0.18), this.glowOrange);
      beacon.position.set(0, ud.H + 0.08, ud.L * 0.17);
      group.add(beacon);
    }

    // roues séparées (joueur : braquage + rotation visibles)
    let wheels = null;
    if (forPlayer && !ud.moto) {
      wheels = [];
      const tireG = tireGeometry(T, ud.wr);
      const rimG = this.rim(ud.wr, !!m.sport, m.spokes);
      const tireM = new T.MeshStandardMaterial({ color: 0x141619, roughness: 0.92 });
      const rimM = m.sport
        ? new T.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.4, metalness: 0.7 })
        : this.brightMat;
      for (const ax of [ud.fx, ud.rx]) {
        for (const side of [-1, 1]) {
          const w = new T.Group();
          const t = new T.Mesh(tireG, tireM);
          const r = new T.Mesh(rimG, rimM);
          r.position.x = side * 0.055;
          t.castShadow = r.castShadow = true;
          w.add(t, r);
          w.position.set(side * (ud.W / 2 - 0.10), ud.wr * 0.95, ax);
          wheels.push(w);
          group.add(w);
        }
      }
    }

    mesh.rotation.y = -Math.PI / 2;
    return { group, mesh, spec: m, ud, brake, glows, beacon, wheels, plateText: plate.text };
  }
}
