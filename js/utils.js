// ============================================================
// Périph' Rush — utilitaires génériques
// ============================================================

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// amortissement exponentiel indépendant du framerate
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

// PRNG déterministe (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rand, arr) { return arr[(rand() * arr.length) | 0]; }
export function pickWeighted(rand, items, weights) {
  let tot = 0; for (const w of weights) tot += w;
  let r = rand() * tot;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// bruit 1D léger et périodique (somme de sinus) — pour vagues de trafic, relief…
export function wave1(x, seed = 0) {
  return (
    Math.sin(x * 1.0 + seed) * 0.5 +
    Math.sin(x * 2.31 + seed * 1.7 + 1.3) * 0.3 +
    Math.sin(x * 4.7 + seed * 0.6 + 2.1) * 0.2
  );
}

// distance signée minimale sur une boucle de longueur L (résultat dans [-L/2, L/2])
export function loopDelta(a, b, L) {
  let d = a - b;
  d = ((d % L) + L) % L;
  if (d > L / 2) d -= L;
  return d;
}
export function wrap(s, L) { return ((s % L) + L) % L; }

// fusion de BufferGeometry non indexées ou indexées (position/normal/uv/color)
export function mergeGeoms(THREE, geoms) {
  const attrs = ['position', 'normal', 'uv', 'color'];
  const present = attrs.filter((a) => geoms[0].getAttribute(a));
  let vCount = 0, iCount = 0;
  for (const g of geoms) {
    const n = g.getAttribute('position').count;
    vCount += n;
    iCount += g.index ? g.index.count : n;
  }
  const out = new THREE.BufferGeometry();
  for (const name of present) {
    const itemSize = geoms[0].getAttribute(name).itemSize;
    const arr = new Float32Array(vCount * itemSize);
    let off = 0;
    for (const g of geoms) {
      const src = g.getAttribute(name);
      arr.set(src.array.subarray(0, src.count * itemSize), off);
      off += src.count * itemSize;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  const idx = new (vCount > 65535 ? Uint32Array : Uint16Array)(iCount);
  let iOff = 0, vOff = 0;
  for (const g of geoms) {
    const n = g.getAttribute('position').count;
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[iOff++] = g.index.array[i] + vOff;
    } else {
      for (let i = 0; i < n; i++) idx[iOff++] = i + vOff;
    }
    vOff += n;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// applique une couleur uniforme en vertex colors sur une géométrie
export function colorize(THREE, geom, color) {
  const n = geom.getAttribute('position').count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

// transforme une géométrie en place (échelle, rotations Z puis Y, translation)
export function xform(geom, { x = 0, y = 0, z = 0, ry = 0, rz = 0, rx = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geom.scale(sx, sy, sz);
  if (rx) geom.rotateX(rx);
  if (rz) geom.rotateZ(rz);
  if (ry) geom.rotateY(ry);
  geom.translate(x, y, z);
  return geom;
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const fmtKm = (m) => (m / 1000).toFixed(2).replace('.', ',') + ' km';
export const fmtInt = (n) => Math.round(n).toLocaleString('fr-FR');
