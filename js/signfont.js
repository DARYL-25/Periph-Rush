// ============================================================
// Périph' Rush — lettrage des panneaux façon « Caractères » L1 / L2
// Alphabet capitales dessiné au trait (monolinéaire, géométrique),
// comme la police réglementaire française : L1 = gras, noir sur blanc
// (pôles proches, portes) ; L2 = plus fin et plus espacé, blanc sur
// bleu/vert (pôles éloignés, autoroutes). Tout est en MAJUSCULES.
// Coordonnées des glyphes : y = 0 ligne de base, y = 1 hauteur de capitale.
// ============================================================

function arc(cx, cy, rx, ry, a0, a1, n = 0) {
  const steps = n || Math.max(6, Math.ceil(Math.abs(a1 - a0) / 9));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}
const P = (...parts) => parts.flatMap((p) => (Array.isArray(p[0]) ? p : [p]));

// [largeur, [tracés…]] ; un tracé = liste de points (ou {dot:[x,y]})
const G = {
  A: [0.74, [P([0, 0], [0.37, 1], [0.74, 0]), P([0.14, 0.32], [0.6, 0.32])]],
  B: [0.62, [P([0, 0], [0, 1], [0.33, 1], arc(0.33, 0.755, 0.245, 0.245, 90, -90), [0, 0.51]), P([0, 0.51], [0.36, 0.51], arc(0.36, 0.255, 0.26, 0.255, 90, -90), [0, 0])]],
  C: [0.72, [arc(0.39, 0.5, 0.39, 0.5, 42, 318)]],
  D: [0.7, [P([0, 0], [0, 1], [0.28, 1], arc(0.28, 0.5, 0.42, 0.5, 90, -90), [0, 0])]],
  E: [0.58, [P([0.58, 1], [0, 1], [0, 0], [0.58, 0]), P([0, 0.52], [0.48, 0.52])]],
  F: [0.56, [P([0.56, 1], [0, 1], [0, 0]), P([0, 0.52], [0.47, 0.52])]],
  G: [0.76, [P(arc(0.39, 0.5, 0.39, 0.5, 42, 360), [0.78, 0.46], [0.44, 0.46])]],
  H: [0.64, [P([0, 0], [0, 1]), P([0.64, 0], [0.64, 1]), P([0, 0.52], [0.64, 0.52])]],
  I: [0, [P([0, 0], [0, 1])]],
  J: [0.46, [P([0.46, 1], [0.46, 0.3], arc(0.23, 0.3, 0.23, 0.3, 0, -180))]],
  K: [0.64, [P([0, 0], [0, 1]), P([0.6, 1], [0, 0.36]), P([0.21, 0.58], [0.66, 0])]],
  L: [0.54, [P([0, 1], [0, 0], [0.54, 0])]],
  M: [0.8, [P([0, 0], [0, 1], [0.4, 0.22], [0.8, 1], [0.8, 0])]],
  N: [0.64, [P([0, 0], [0, 1], [0.64, 0], [0.64, 1])]],
  O: [0.8, [arc(0.4, 0.5, 0.4, 0.5, 0, 360, 48)]],
  P: [0.6, [P([0, 0], [0, 1], [0.32, 1], arc(0.32, 0.725, 0.275, 0.275, 90, -90), [0, 0.45])]],
  Q: [0.82, [arc(0.4, 0.5, 0.4, 0.5, 0, 360, 48), P([0.5, 0.24], [0.84, -0.06])]],
  R: [0.64, [P([0, 0], [0, 1], [0.32, 1], arc(0.32, 0.735, 0.265, 0.265, 90, -90), [0, 0.47]), P([0.28, 0.47], [0.64, 0])]],
  S: [0.62, [P(arc(0.31, 0.75, 0.29, 0.25, 25, 270), arc(0.31, 0.25, 0.31, 0.25, 90, -155))]],
  T: [0.66, [P([0, 1], [0.66, 1]), P([0.33, 1], [0.33, 0])]],
  U: [0.64, [P([0, 1], [0, 0.33], arc(0.32, 0.33, 0.32, 0.33, 180, 360), [0.64, 1])]],
  V: [0.7, [P([0, 1], [0.35, 0], [0.7, 1])]],
  W: [0.98, [P([0, 1], [0.23, 0], [0.49, 0.78], [0.75, 0], [0.98, 1])]],
  X: [0.66, [P([0, 1], [0.66, 0]), P([0, 0], [0.66, 1])]],
  Y: [0.68, [P([0, 1], [0.34, 0.47], [0.68, 1]), P([0.34, 0.47], [0.34, 0])]],
  Z: [0.62, [P([0.02, 1], [0.62, 1], [0, 0], [0.64, 0])]],
  0: [0.62, [arc(0.31, 0.5, 0.31, 0.5, 0, 360, 44)]],
  1: [0.42, [P([0.04, 0.78], [0.3, 1], [0.3, 0])]],
  2: [0.62, [P(arc(0.31, 0.7, 0.3, 0.3, 158, -30), [0, 0], [0.63, 0])]],
  3: [0.6, [P(arc(0.29, 0.755, 0.27, 0.245, 155, -90)), P(arc(0.3, 0.255, 0.3, 0.255, 90, -158))]],
  4: [0.66, [P([0.48, 0], [0.48, 1], [0, 0.3], [0.66, 0.3])]],
  5: [0.62, [P([0.57, 1], [0.08, 1], [0.04, 0.55], arc(0.31, 0.31, 0.31, 0.31, 128, -158))]],
  6: [0.62, [P([0.5, 1], [0.06, 0.4]), arc(0.31, 0.3, 0.3, 0.3, 0, 360, 36)]],
  7: [0.6, [P([0, 1], [0.6, 1], [0.18, 0])]],
  8: [0.62, [arc(0.31, 0.76, 0.26, 0.24, 0, 360, 34), arc(0.31, 0.27, 0.31, 0.27, 0, 360, 36)]],
  9: [0.62, [arc(0.31, 0.7, 0.3, 0.3, 0, 360, 36), P([0.56, 0.6], [0.12, 0])]],
  "'": [0.02, [P([0, 1], [0, 0.7])]],
  '’': [0.02, [P([0, 1], [0, 0.7])]],
  '-': [0.34, [P([0, 0.45], [0.34, 0.45])]],
  '–': [0.5, [P([0, 0.45], [0.5, 0.45])]],
  '.': [0, [{ dot: [0, 0.06] }]],
  ',': [0.04, [P([0.04, 0.1], [0, -0.14])]],
  '/': [0.42, [P([0, -0.05], [0.42, 1.05])]],
  '+': [0.56, [P([0, 0.5], [0.56, 0.5]), P([0.28, 0.22], [0.28, 0.78])]],
  ':': [0, [{ dot: [0, 0.06] }, { dot: [0, 0.62] }]],
  '&': [0.66, [P([0.68, 0], [0.12, 0.64], arc(0.27, 0.8, 0.17, 0.2, 200, -20), [0.06, 0.34], arc(0.28, 0.24, 0.24, 0.24, 160, 330), [0.7, 0.45])]],
  ' ': [0.32, []],
  // « m » minuscule des distances (500 m) — x-height 0,72
  m: [0.8, [P([0, 0], [0, 0.72]), P([0, 0.5], arc(0.2, 0.5, 0.2, 0.22, 180, 0), [0.4, 0]), P([0.4, 0.5], arc(0.6, 0.5, 0.2, 0.22, 180, 0), [0.8, 0])]],
};
// accents (sur capitales)
const ACC = {
  acute: [P([0.0, 1.12], [0.16, 1.32])],
  grave: [P([0.16, 1.12], [0.0, 1.32])],
  circ: [P([-0.12, 1.12], [0.02, 1.3], [0.16, 1.12])],
  diaer: [{ dot: [-0.08, 1.2] }, { dot: [0.14, 1.2] }],
};
const ACCENTED = {
  É: ['E', 'acute'], È: ['E', 'grave'], Ê: ['E', 'circ'], Ë: ['E', 'diaer'],
  À: ['A', 'grave'], Â: ['A', 'circ'], Î: ['I', 'circ'], Ï: ['I', 'diaer'],
  Ô: ['O', 'circ'], Û: ['U', 'circ'], Ù: ['U', 'grave'], Ü: ['U', 'diaer'],
};

function norm(str) {
  // tout en capitales, sauf l'unité « m » des distances (« 500 m »)
  return str.toUpperCase().replace(/[’]/g, "'").replace(/Œ/g, 'OE').replace(/(\d) M$/, '$1 m');
}

// styles réglementaires
export const L1 = { sw: 0.17, track: 0.15 };   // gras, noir sur blanc
export const L2 = { sw: 0.135, track: 0.21 }; // plus fin, blanc sur couleur

function glyphOf(ch) {
  if (G[ch]) return { g: G[ch] };
  if (ACCENTED[ch]) return { g: G[ACCENTED[ch][0]], acc: ACC[ACCENTED[ch][1]] };
  if (ch === 'Ç') return { g: G.C, ced: true };
  return { g: G[' '] };
}

// largeur d'une chaîne (en px) pour une hauteur de capitale `cap`
export function signTextWidth(str, cap, style = L1) {
  const s = norm(str);
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const { g } = glyphOf(s[i]);
    w += (g[0] + style.sw + (i < s.length - 1 ? style.track : 0)) * cap;
  }
  return w;
}

// dessine la chaîne ; y = milieu de la hauteur de capitale
export function drawSignText(ctx, str, x, y, cap, color, align = 'left', style = L1, maxW = 0) {
  const s = norm(str);
  let scaleX = 1;
  let w = signTextWidth(s, cap, style);
  if (maxW && w > maxW) { scaleX = maxW / w; w = maxW; }
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const base = y + cap / 2;
  const sw = style.sw * cap;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = sw;
  ctx.lineJoin = 'miter'; ctx.miterLimit = 2.2;
  ctx.lineCap = 'butt';
  const half = sw / 2;
  for (let i = 0; i < s.length; i++) {
    const { g, acc, ced } = glyphOf(s[i]);
    const ox = cx + half * scaleX;
    const X = (gx) => ox + gx * cap * scaleX, Y = (gy) => base - half - gy * (cap - sw);
    const paths = g[1].slice();
    if (ced) paths.push(P([0.4, 0], [0.4, -0.12], [0.28, -0.22]));
    // accents : trait plus fin, au-dessus de la capitale
    if (acc) {
      ctx.lineWidth = sw * 0.7;
      for (const p of acc) {
        if (p.dot) { ctx.fillRect(X(p.dot[0] + g[0] / 2) - half * 0.8, Y(p.dot[1] + 0.06) - half * 0.8, sw * 0.8, sw * 0.8); continue; }
        ctx.beginPath();
        p.forEach(([gx, gy], k) => { const xx = X(gx + g[0] / 2 - 0.08), yy = Y(gy + 0.08); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); });
        ctx.stroke();
      }
      ctx.lineWidth = sw;
    }
    for (const p of paths) {
      if (p.dot) {
        const [dx, dy] = p.dot;
        ctx.fillRect(X(dx) - half, Y(dy) - half, sw, sw);
        continue;
      }
      ctx.beginPath();
      p.forEach(([gx, gy], k) => (k ? ctx.lineTo(X(gx), Y(gy)) : ctx.moveTo(X(gx), Y(gy))));
      const a = p[0], z = p[p.length - 1];
      if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-3) ctx.closePath();
      ctx.stroke();
    }
    cx += (g[0] + style.sw + style.track) * cap * scaleX;
  }
  ctx.restore();
  return w;
}
