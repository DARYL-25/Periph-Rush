// ============================================================
// Périph' Rush — outils de construction de géométrie le long du tracé
// Batch : accumulateur de sommets (position/uv/couleur) → 1 BufferGeometry.
// Toutes les primitives sont exprimées en coordonnées « piste »
// (s, latéral, altitude absolue) puis projetées dans le monde.
// ============================================================

export class Batch {
  constructor(tiled = false) { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.tiled = tiled; this.tile = []; this.cur = [0, 0, 1, 1]; }
  get count() { return this.pos.length / 3; }
  v(x, y, z, u, w, c) {
    this.pos.push(x, y, z);
    this.uv.push(u, w);
    this.col.push(c[0], c[1], c[2]);
    if (this.tiled) { const t = this.cur; this.tile.push(t[0], t[1], t[2], t[3]); }
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  // copie d'une géométrie three.js (déjà transformée) avec couleur uniforme
  addGeometry(geo, c, uvScale = 1) {
    const p = geo.getAttribute('position'), uv = geo.getAttribute('uv');
    const base = this.count;
    for (let i = 0; i < p.count; i++) this.v(p.getX(i), p.getY(i), p.getZ(i), uv ? uv.getX(i) * uvScale : 0, uv ? uv.getY(i) * uvScale : 0, c);
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(geo.index.array[i] + base);
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    geo.dispose();
  }
  build(T) {
    if (!this.idx.length) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    if (this.tiled) g.setAttribute('tile', new T.Float32BufferAttribute(this.tile, 4));
    g.setIndex(this.idx.length > 65535 * 3 || this.count > 65535 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// vue d'un Batch « atlas » avec une tuile imposée (même interface que Batch)
export class TileView {
  constructor(base, tile) { this.base = base; this.t = tile; }
  get count() { return this.base.count; }
  v(x, y, z, u, w, c) { this.base.cur = this.t; return this.base.v(x, y, z, u, w, c); }
  tri(a, b, c) { this.base.tri(a, b, c); }
  quad(a, b, c, d) { this.base.quad(a, b, c, d); }
  addGeometry(geo, c, s) { this.base.cur = this.t; this.base.addGeometry(geo, c, s); }
}

const _cache = new Map();
export function rgb(hex) {
  if (_cache.has(hex)) return _cache.get(hex);
  // conversion sRGB → linéaire (vertex colors en espace linéaire)
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const c = [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
  _cache.set(hex, c);
  return c;
}
export function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

// Projection piste → monde. `rows` : échantillons {s, x, z, rx, rz, tx, tz, h}
export function P(row, lat, y) { return [row.x + row.rx * lat, y, row.z + row.rz * lat]; }

// Bande entre deux lignes latérales (latA, yA) → (latB, yB) le long des rangées.
// fA/fB(row) renvoient [lat, y]. uv : u = s / su, v = distance transversale / sv
export function band(B, rows, fA, fB, color, su = 4, sv = 4, colorB = null) {
  let prev = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const a = fA(r), b = fB(r);
    if (!a || !b) { prev = null; continue; }
    const pa = P(r, a[0], a[1]), pb = P(r, b[0], b[1]);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ia = B.v(pa[0], pa[1], pa[2], r.s / su, 0, a[2] || color);
    const ib = B.v(pb[0], pb[1], pb[2], r.s / su, d / sv, b[2] || colorB || color);
    if (prev) B.quad(prev[0], prev[1], ib, ia);
    prev = [ia, ib];
  }
}

// Boîte orientée selon le tracé au point `row` (centre lat, y bas), dims w(lat) × h × l(s)
export function boxAt(B, row, lat, y, w, h, l, color, uvs = 1, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // axes : a = droite (rx,rz), t = avant (tx,tz), tournés de yaw autour de Y
  const ax = row.rx * c + row.tx * s, az = row.rz * c + row.tz * s;
  const tx = row.tx * c - row.rx * s, tz = row.tz * c - row.rz * s;
  const cx = row.x + row.rx * lat, cz = row.z + row.rz * lat;
  const corners = [];
  for (const dy of [0, h]) for (const dl of [-l / 2, l / 2]) for (const dw of [-w / 2, w / 2]) {
    corners.push([cx + ax * dw + tx * dl, y + dy, cz + az * dw + tz * dl]);
  }
  // faces : 6 × 4 sommets (normales nettes)
  const F = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  const dims = [[w, l], [w, l], [w, h], [w, h], [l, h], [l, h]];
  F.forEach((f, k) => {
    const [du, dv] = dims[k];
    const ids = f.map((ci, j) => {
      const p = corners[ci];
      const u = (j === 1 || j === 2) ? du / uvs : 0, v = (j >= 2) ? dv / uvs : 0;
      return B.v(p[0], p[1], p[2], u, v, color);
    });
    B.quad(ids[0], ids[1], ids[2], ids[3]);
  });
}

// boîte libre en coordonnées monde (centre x,z ; y bas ; largeur w selon dir (dx,dz))
export function boxWorld(B, x, y, z, w, h, d, dx, dz, color, uvs = 1) {
  const row = { x, z, rx: dx, rz: dz, tx: -dz, tz: dx };
  boxAt(B, row, 0, y, w, h, d, color, uvs);
}

// cylindre vertical (mâts, piles) — n côtés
export function cylinder(B, x, y, z, r0, r1, h, n, color) {
  let prev = null, first = null;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const i0 = B.v(x + c * r0, y, z + s * r0, i / n, 0, color);
    const i1 = B.v(x + c * r1, y + h, z + s * r1, i / n, h, color);
    if (prev) B.quad(prev[0], i0, i1, prev[1]);
    else first = [i0, i1];
    prev = [i0, i1];
  }
}
