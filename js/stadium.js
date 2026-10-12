// ============================================================
// Périph' Rush — Parc des Princes (v18)
// Anneau ovale (superellipse) posé au-dessus du périphérique, qui passe
// en tunnel sous les tribunes. Signature architecturale reproduite :
// 50 portiques en béton précontraint disposés tout autour, dont la tête
// se recourbe vers l'intérieur pour porter la couverture en porte-à-faux ;
// leur hauteur ondule (plus hauts au milieu des grands côtés), d'où la
// ligne de toit en vague. Façade en bandes (rez vitré, coursive sombre,
// sous-faces des gradins), cuvette à deux niveaux de gradins, pelouse.
// ============================================================

import { Batch, rgb, shade } from './geo.js';

const N_RIBS = 50;

export function buildParcDesPrinces(T, scene, at, track) {
  const c = at(48.8414, 2.2530);
  // axe long du stade parallèle au périphérique qui le traverse en dessous
  let best = null;
  const p = {};
  for (let s = 0; s < track.length; s += 10) {
    track.pointAt(s, p);
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (!best || d < best.d) best = { d, tx: p.tx, tz: p.tz };
  }
  const ux = best.tx, uz = best.tz, vx = -best.tz, vz = best.tx;
  const W = (u, v, y) => [c.x + u * ux + v * vx, y, c.z + u * uz + v * vz];
  const n = 2.5;
  const se = (t, A, Bv) => {
    const ct = Math.cos(t), st = Math.sin(t);
    return [A * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n), Bv * Math.sign(st) * Math.pow(Math.abs(st), 2 / n)];
  };
  const B = new Batch();
  const quad = (a, b, cc, d, col) => {
    B.quad(B.v(...a, 0, 0, col), B.v(...b, 1, 0, col), B.v(...cc, 1, 1, col), B.v(...d, 0, 1, col));
  };
  const SEG = 240;
  const ts = [];
  for (let i = 0; i <= SEG; i++) ts.push((i / SEG) * Math.PI * 2);
  // hauteur de tête des portiques selon la position sur l'ovale
  const Htop = (t) => 35 + 9 * Math.pow(Math.abs(Math.sin(t)), 1.6);

  // — esplanade (dalle de couverture du périphérique) —
  const AO = 114, BO = 97; // le périphérique (≈ 70–97 m à l'est de l'axe) passe sous la tribune est
  for (let i = 0; i < SEG; i++) {
    const [a0, b0] = se(ts[i], AO + 14, BO + 14), [a1, b1] = se(ts[i + 1], AO + 14, BO + 14);
    const [c0, d0] = se(ts[i], AO - 1, BO - 1), [c1, d1] = se(ts[i + 1], AO - 1, BO - 1);
    quad(W(c0, d0, 0.12), W(c1, d1, 0.12), W(a1, b1, 0.12), W(a0, b0, 0.12), rgb(0x8f8b82));
  }
  // — façade en bandes —
  const bands = [[0, 4.5, 0x2d3338], [4.5, 9.5, 0xbdb7ab], [9.5, 12.5, 0x34383d], [12.5, 15, 0xb4aea2], [15, 18, 0xa9a397], [18, 21, 0xb7b1a5], [21, 24.5, 0xa9a397], [24.5, 27, 0xbdb7ab]];
  for (const [y0, y1, col] of bands) {
    const lean0 = y0 * 0.06, lean1 = y1 * 0.06; // la sous-face des gradins s'évase vers le haut
    for (let i = 0; i < SEG; i++) {
      const [a0, b0] = se(ts[i], AO + lean0, BO + lean0), [a1, b1] = se(ts[i + 1], AO + lean0, BO + lean0);
      const [e0, f0] = se(ts[i], AO + lean1, BO + lean1), [e1, f1] = se(ts[i + 1], AO + lean1, BO + lean1);
      const k = col === 0x2d3338 && (i % 4 === 0) ? shade(rgb(0x9a958c), 1) : rgb(col);
      quad(W(a0, b0, y0), W(a1, b1, y0), W(e1, f1, y1), W(e0, f0, y1), k);
    }
  }
  // couronnement de façade (dessus des gradins hauts)
  for (let i = 0; i < SEG; i++) {
    const [a0, b0] = se(ts[i], AO + 1.6, BO + 1.6), [a1, b1] = se(ts[i + 1], AO + 1.6, BO + 1.6);
    const [c0, d0] = se(ts[i], AO - 4, BO - 4), [c1, d1] = se(ts[i + 1], AO - 4, BO - 4);
    quad(W(c0, d0, 27.6), W(c1, d1, 27.6), W(a1, b1, 27.2), W(a0, b0, 27.2), rgb(0xa39d91));
  }
  // — cuvette : gradins bas (bleus) et hauts (rouges), marches en dents de scie —
  const tiers = [
    { A0: 58, B0: 40, A1: 88, B1: 72, y0: 1.2, y1: 12, rows: 22, c: [0x22406f, 0x1b3560] },
    { A0: 90, B0: 74, A1: 110, B1: 93, y0: 15, y1: 27, rows: 20, c: [0xa8222b, 0x8f1c25] },
  ];
  for (const tr of tiers) {
    for (let r = 0; r < tr.rows; r++) {
      const f0 = r / tr.rows, f1 = (r + 1) / tr.rows;
      const A0 = tr.A0 + (tr.A1 - tr.A0) * f0, B0 = tr.B0 + (tr.B1 - tr.B0) * f0;
      const A1 = tr.A0 + (tr.A1 - tr.A0) * f1, B1 = tr.B0 + (tr.B1 - tr.B0) * f1;
      const y0 = tr.y0 + (tr.y1 - tr.y0) * f0, y1 = tr.y0 + (tr.y1 - tr.y0) * f1;
      for (let i = 0; i < SEG; i += 2) {
        const sector = Math.floor((i / SEG) * 16) % 2;
        const col = rgb(tr.c[(sector + (r % 3 === 0 ? 1 : 0)) % 2]);
        const [a0, b0] = se(ts[i], A0, B0), [a1, b1] = se(ts[i + 2], A0, B0);
        const [e0, g0] = se(ts[i], A1, B1), [e1, g1] = se(ts[i + 2], A1, B1);
        quad(W(a0, b0, y0), W(a1, b1, y0), W(a1, b1, y1), W(a0, b0, y1), shade(rgb(0x6d6a64), 1)); // contremarche
        quad(W(a0, b0, y1), W(a1, b1, y1), W(e1, g1, y1), W(e0, g0, y1), col);                       // assise
      }
    }
  }
  // garde-corps / loges entre les deux niveaux
  for (let i = 0; i < SEG; i++) {
    const [a0, b0] = se(ts[i], 89, 73), [a1, b1] = se(ts[i + 1], 89, 73);
    quad(W(a0, b0, 12), W(a1, b1, 12), W(a1, b1, 15), W(a0, b0, 15), rgb(i % 3 ? 0x2a2e33 : 0x3d4248));
  }
  // pelouse + piste
  for (let i = 0; i < SEG; i++) {
    const [a0, b0] = se(ts[i], 58, 40), [a1, b1] = se(ts[i + 1], 58, 40);
    const k = Math.floor(((a0 + 58) / 116) * 12) % 2 ? 0x2f7a33 : 0x37873a;
    B.tri(B.v(...W(0, 0, 1.0), 0, 0, rgb(k)), B.v(...W(a1, b1, 1.0), 0, 0, rgb(k)), B.v(...W(a0, b0, 1.0), 0, 0, rgb(k)));
  }

  // — couverture en porte-à-faux, suspendue sous les têtes de portiques —
  const roofIn = 44;
  for (let i = 0; i < SEG; i++) {
    const t0 = ts[i], t1 = ts[i + 1];
    const H0 = Htop(t0), H1 = Htop(t1);
    const ring = (off, dy, t, H) => { const [a, b] = se(t, AO + off, BO + off); return W(a, b, H + dy); };
    // dessus (tôle claire) du nu de façade jusqu'au bord intérieur
    quad(ring(1, -4.6, t0, H0), ring(1, -4.6, t1, H1), ring(-roofIn, -9.4, t1, H1), ring(-roofIn, -9.4, t0, H0), rgb(0xd8d6cf));
    // sous-face (plus sombre)
    quad(ring(-roofIn, -9.9, t0, H0), ring(-roofIn, -9.9, t1, H1), ring(1, -5.1, t1, H1), ring(1, -5.1, t0, H0), rgb(0x55575a));
    // rive intérieure + rampe de projecteurs
    quad(ring(-roofIn, -9.9, t0, H0), ring(-roofIn, -9.9, t1, H1), ring(-roofIn, -9.0, t1, H1), ring(-roofIn, -9.0, t0, H0), rgb(0xe6e3dc));
    if (i % 3 === 0) quad(ring(-roofIn + 0.2, -10.5, t0, H0), ring(-roofIn + 0.2, -10.5, t1, H1), ring(-roofIn + 0.2, -9.95, t1, H1), ring(-roofIn + 0.2, -9.95, t0, H0), rgb(0xfff4d8));
    // jonction couverture / façade
    quad(ring(1, -5.1, t0, H0), ring(1, -5.1, t1, H1), ring(1.6, 27.6 - H1, t1, H1), ring(1.6, 27.6 - H0, t0, H0), rgb(0x8e8a82));
  }

  // — les 50 portiques (répartis à pas constant sur le contour) —
  const samp = [];
  let acc = 0, prev = se(0, AO, BO);
  for (let i = 0; i <= 2000; i++) {
    const t = (i / 2000) * Math.PI * 2;
    const q = se(t, AO, BO);
    acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    samp.push({ t, acc });
    prev = q;
  }
  const total = acc;
  const concrete = rgb(0xcdc8bd), concreteD = rgb(0xb3ada1);
  for (let k = 0; k < N_RIBS; k++) {
    const target = (k + 0.5) / N_RIBS * total;
    const sm = samp.find((o) => o.acc >= target) || samp[samp.length - 1];
    const t = sm.t;
    const [pu, pv] = se(t, AO, BO);
    const [qu, qv] = se(t + 0.002, AO, BO);
    let tu = qu - pu, tv = qv - pv;
    const tl = Math.hypot(tu, tv); tu /= tl; tv /= tl;
    const nu = tv, nv = -tu; // normale extérieure (contour parcouru dans le sens trigonométrique)
    const H = Htop(t);
    // profil (d = décalage vers l'extérieur, y) : pied, fût légèrement incliné, tête recourbée, porte-à-faux
    const prof = [[7.6, 0], [6.9, 10], [6.5, 20], [5.6, H - 8], [3.6, H - 2.2], [0.6, H], [-12, H - 1.3], [-28, H - 3.9], [-42, H - 7.8], [-45.2, H - 9.2],
      [-44.2, H - 10.6], [-28, H - 6.6], [-12, H - 4.6], [-1.6, H - 4.4], [1.8, H - 8.4], [2.5, 20], [2.9, 10], [3.3, 0]];
    const th = 0.7; // demi-épaisseur tangentielle
    const P3 = (d, y, side) => W(pu + nu * d + tu * th * side, pv + nv * d + tv * th * side, y);
    // flancs
    const tri = T.ShapeUtils.triangulateShape(prof.map(([d, y]) => new T.Vector2(d, y)), []);
    for (const side of [1, -1]) {
      const ids = prof.map(([d, y]) => B.v(...P3(d, y, side), 0, 0, side > 0 ? concrete : concreteD));
      for (const [a, b, cc] of tri) side > 0 ? B.tri(ids[a], ids[b], ids[cc]) : B.tri(ids[a], ids[cc], ids[b]);
    }
    // chants
    for (let i = 0; i < prof.length; i++) {
      const [d0, y0] = prof[i], [d1, y1] = prof[(i + 1) % prof.length];
      const col = y0 > H - 11 && y1 > H - 11 ? shade(concrete, 1.06) : shade(concrete, 0.93);
      quad(P3(d0, y0, -1), P3(d1, y1, -1), P3(d1, y1, 1), P3(d0, y0, 1), col);
    }
  }
  const geo = B.build(T);
  const mat = new T.MeshLambertMaterial({ vertexColors: true, fog: true, side: T.DoubleSide });
  const mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
