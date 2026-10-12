// ============================================================
// Périph' Rush — silhouettes humaines low-poly (v20)
// Policiers (jumelles, gestes), automobilistes en gilet jaune derrière
// la glissière, agents de chantier orange. Géométrie fusionnée avec
// couleurs de sommets (≈ 150 triangles), à poser dans un groupe d'événement.
// Repère : y vers le haut, l'avant de la personne vers +z.
// ============================================================

import { mergeGeoms, colorize, xform } from './utils.js';

const SKIN = [0xe0b394, 0xc68e6a, 0x8d5a3b, 0x5e3b26];

// poses : 'stand', 'binoc' (jumelles aux yeux), 'wave' (bras levé, fait signe),
// 'phone' (téléphone à l'oreille), 'arms' (bras croisés), 'point' (indique la voie)
export function personGeometry(T, { shirt = 0x1b2547, pants = 0x1b2547, vest = null, head = null, cap = null, pose = 'stand', skin = null, rnd = Math.random } = {}) {
  const parts = [];
  const sk = skin ?? SKIN[(rnd() * SKIN.length) | 0];
  const add = (g, col, tf) => parts.push(colorize(T, xform(g, tf), col));
  // jambes
  for (const sd of [-1, 1]) {
    add(new T.CylinderGeometry(0.075, 0.065, 0.82, 6), pants, { x: sd * 0.1, y: 0.41 });
    add(new T.BoxGeometry(0.11, 0.07, 0.24), 0x17181b, { x: sd * 0.1, y: 0.035, z: 0.04 }); // chaussures
  }
  // tronc (gilet par-dessus si fourni)
  add(new T.CylinderGeometry(0.19, 0.16, 0.62, 8), vest ?? shirt, { y: 1.13 });
  if (vest) { // bandes rétroréfléchissantes
    add(new T.CylinderGeometry(0.195, 0.19, 0.04, 8), 0xd9dde2, { y: 1.02 });
    add(new T.CylinderGeometry(0.195, 0.19, 0.04, 8), 0xd9dde2, { y: 1.24 });
  }
  add(new T.CylinderGeometry(0.06, 0.07, 0.08, 6), sk, { y: 1.47 }); // cou
  add(new T.SphereGeometry(0.115, 8, 6), sk, { y: 1.6 });           // tête
  if (head) add(new T.SphereGeometry(0.118, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), head, { y: 1.62 }); // cheveux / casque
  if (cap) { // casquette / képi
    add(new T.CylinderGeometry(0.12, 0.12, 0.07, 8), cap, { y: 1.7 });
    add(new T.BoxGeometry(0.2, 0.015, 0.1), 0x111216, { y: 1.67, z: 0.1 });
  }
  // bras selon la pose
  const arm = (sd, rx, rz, y = 1.38) => {
    const g = new T.CylinderGeometry(0.05, 0.045, 0.6, 6);
    g.translate(0, -0.3, 0);
    add(g, vest ?? shirt, { x: sd * 0.24, y, rx, rz: sd * rz });
    // main
    const h = new T.SphereGeometry(0.05, 6, 4);
    h.translate(0, -0.62, 0);
    add(h, sk, { x: sd * 0.24, y, rx, rz: sd * rz });
  };
  if (pose === 'binoc') {
    arm(1, -1.25, -0.5); arm(-1, -1.25, -0.5);
    add(new T.BoxGeometry(0.17, 0.08, 0.14), 0x16181b, { y: 1.6, z: 0.17 }); // jumelles
  } else if (pose === 'wave') {
    arm(1, 0, 2.6); arm(-1, 0, 0.12);
  } else if (pose === 'phone') {
    arm(1, -0.5, -2.2); arm(-1, 0, 0.1);
    add(new T.BoxGeometry(0.04, 0.13, 0.07), 0x101114, { x: 0.13, y: 1.6, z: 0.02 });
  } else if (pose === 'arms') {
    arm(1, -1.4, -0.9, 1.3); arm(-1, -1.4, -0.9, 1.3);
  } else if (pose === 'point') {
    arm(1, 0, 1.45); arm(-1, 0, 0.12);
  } else {
    arm(1, 0, 0.1); arm(-1, 0, 0.1);
  }
  const g = mergeGeoms(T, parts);
  for (const p of parts) p.dispose();
  return g;
}

// tenues prêtes à l'emploi
export const OUTFITS = {
  police: { shirt: 0x1b2547, pants: 0x1b2547, cap: 0x1b2547 },
  policeVest: { shirt: 0x1b2547, pants: 0x1b2547, vest: 0xd6e83a, cap: 0x1b2547 },
  driver: { shirt: 0x3b4250, pants: 0x2b3442, vest: 0xd8ef2c, head: 0x2a2018 },
  worker: { shirt: 0xff7a1a, pants: 0x2b3442, vest: 0xff7a1a, head: 0xf2f3f5 },
  depanneur: { shirt: 0x24282e, pants: 0x24282e, vest: 0xff8a1a, head: 0x2a2018 },
  pompier: { shirt: 0x1d2433, pants: 0x1d2433, vest: 0xc8102e, head: 0xd8dce0 },
};
