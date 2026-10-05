// ============================================================
// Périph' Rush — abords réels du périphérique (OpenStreetMap)
// • ~6 900 bâtiments (rectangles orientés + hauteurs réelles quand
//   elles sont connues), 200 grands bâtiments en polygone extrudé
// • occupation du sol (bois, parcs, terrains de sport, cimetières,
//   emprises ferroviaires, eau, Seine et canaux) pour colorer le sol
//   et planter la végétation
// • indexation par abscisse s pour le streaming par segments
// • monuments lointains (silhouettes) pour la ligne d'horizon
// Données © contributeurs OpenStreetMap (ODbL).
// ============================================================

import { BUILDINGS_B64, BIG_BUILDINGS, LANDUSE } from './periph-data.js';
import { rng, wrap } from './utils.js';
import { Batch, rgb, shade } from './geo.js';
import { FACADES } from './textures.js';

const FAC = Object.fromEntries(FACADES.map((f, i) => [f.id, i]));
export const LAT0 = 48.8590, LON0 = 2.3400;
const M_LAT = 111132, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
export const geoToLocal = (lat, lon) => ({ x: (lon - LON0) * M_LON, z: -(lat - LAT0) * M_LAT });

function decodeB64(b64) {
  if (!b64) return new Int16Array(0);
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(u8.buffer);
}

// --- index spatial de l'axe (grille de 50 m) pour projeter un point en (s, lat) ---
class TrackIndex {
  constructor(track) {
    this.track = track;
    this.cell = 50;
    this.map = new Map();
    const p = {};
    for (let s = 0; s < track.length; s += 8) {
      track.pointAt(s, p);
      const k = this.key(p.x, p.z);
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(s);
    }
  }
  key(x, z) { return Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell); }
  project(x, z, maxR = 400) {
    const t = this.track, p = {};
    let best = null, bd = Infinity;
    const R = Math.ceil(maxR / this.cell);
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let r = 0; r <= R && !(best !== null && bd < (r - 1) * this.cell); r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const list = this.map.get((cx + i) * 100003 + (cz + j));
        if (!list) continue;
        for (const s of list) { t.pointAt(s, p); const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = s; } }
      }
    }
    if (best === null) return null;
    // affinage local
    for (let k = 0; k < 2; k++) {
      let b2 = best;
      for (let ds = -8; ds <= 8; ds += 1) { t.pointAt(best + ds, p); const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b2 = best + ds; } }
      best = b2;
    }
    t.pointAt(best, p);
    const lat = (x - p.x) * p.rx + (z - p.z) * p.rz;
    return { s: wrap(best, t.length), lat };
  }
}

// --- occupation du sol : lookup point-dans-polygone avec grille ---
class Landuse {
  constructor() {
    this.polys = [];
    this.lines = [];
    for (const [k, flat, isLine] of LANDUSE) {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
      if (isLine) {
        const w = 26;
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        this.lines.push({ k, pts, w, x0: x0 - w, x1: x1 + w, z0: z0 - w, z1: z1 + w });
        continue;
      }
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      this.polys.push({ k, pts, x0, x1, z0, z1 });
    }
    // la Seine : la ligne la plus longue des « river » ; largeur ≈ 150 m
    this.cell = 120;
    this.grid = new Map();
    this.polys.forEach((p, i) => {
      for (let gx = Math.floor(p.x0 / this.cell); gx <= Math.floor(p.x1 / this.cell); gx++) {
        for (let gz = Math.floor(p.z0 / this.cell); gz <= Math.floor(p.z1 / this.cell); gz++) {
          const k = gx * 100003 + gz;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(i);
        }
      }
    });
  }
  // type d'occupation au point (priorité : eau > terrain > parc > bois > …)
  at(x, z) {
    const list = this.grid.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (this.inWater(x, z)) return 'water';
    if (!list) return null;
    let best = null, rank = 0;
    const R = { water: 9, pitch: 6, cemetery: 5, park: 4, wood: 4, rail: 3, urban: 2 };
    for (const i of list) {
      const p = this.polys[i];
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if ((R[p.k] || 1) <= rank) continue;
      if (pip(p.pts, x, z)) { best = p.k; rank = R[p.k] || 1; }
    }
    return best;
  }
  inWater(x, z) {
    for (const l of this.lines) {
      if (x < l.x0 || x > l.x1 || z < l.z0 || z > l.z1) continue;
      const half = l.w / 2;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [ax, az] = l.pts[i], [bx, bz] = l.pts[i + 1];
        if (Math.min(ax, bx) - half > x || Math.max(ax, bx) + half < x || Math.min(az, bz) - half > z || Math.max(az, bz) + half < z) continue;
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) < half) return true;
      }
    }
    return false;
  }
}
function pip(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ============================================================
export class Scenery {
  constructor(THREE, track, chunkLen, ramps = null) {
    this.T = THREE;
    this.ramps = ramps;
    this.track = track;
    this.chunkLen = chunkLen;
    this.index = new TrackIndex(track);
    this.landuse = new Landuse();
    // la Seine (≈ 160 m) : lignes passant sous les deux viaducs de franchissement
    const bp = track.bridges.map((b) => { const p = {}; track.pointAt((b.s0 + b.s1) / 2, p); return p; });
    for (const l of this.landuse.lines) {
      const seine = l.pts.some(([x, z]) => bp.some((p) => Math.hypot(p.x - x, p.z - z) < 300));
      if (seine) { l.w = 160; l.x0 -= 80; l.x1 += 80; l.z0 -= 80; l.z1 += 80; }
    }
    this.byChunk = new Map();
    const nChunks = Math.ceil(track.length / chunkLen);
    this.dropped = 0;
    const put = (s, b) => {
      // aucune emprise ne doit mordre sur la chaussée, les bretelles ou les ouvrages
      const near = b.custom || !(b.dist > 55);
      const res = near ? this.clearance(b.kind === 'box' ? rectPts(b) : b.pts) : { ok: true };
      if (!res.ok) {
        if (!b.custom) { this.dropped++; return; }
        for (let k = 0; k < 8 && !res.ok; k++) {
          const p = {}; track.pointAt(res.s, p);
          const sh = (res.need + 4) * res.side;
          b.cx += p.rx * sh; b.cz += p.rz * sh;
          Object.assign(res, this.clearance(rectPts(b)));
        }
      }
      const ci = Math.floor(wrap(s, track.length) / chunkLen) % nChunks;
      if (!this.byChunk.has(ci)) this.byChunk.set(ci, []);
      this.byChunk.get(ci).push(b);
    };
    // --- bâtiments rectangulaires ---
    const a = decodeB64(BUILDINGS_B64);
    const n = a.length / 7;
    const rand = rng(4242);
    for (let i = 0; i < n; i++) {
      const cx = a[i] / 2, cz = a[n + i] / 2, w = a[2 * n + i] / 4, d = a[3 * n + i] / 4;
      const ang = a[4 * n + i] / 1000, hRaw = a[5 * n + i] / 4, tRaw = a[6 * n + i];
      const pr = this.index.project(cx, cz);
      if (!pr) continue;
      const known = tRaw < 16, type = tRaw & 15;
      const side = pr.lat > 0 ? 1 : -1; // 1 = côté Paris
      // distance minimale de l'emprise à l'axe (coins projetés dans le repère local)
      const pp = {}; track.pointAt(pr.s, pp);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let minLat = Infinity, crosses = false;
      for (const [u, v] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) {
        const x = cx + u * ca - v * sa, z = cz + u * sa + v * ca;
        const lat = (x - pp.x) * pp.rx + (z - pp.z) * pp.rz;
        if (Math.sign(lat) !== side) crosses = true;
        minLat = Math.min(minLat, Math.abs(lat));
      }
      if (crosses) continue;
      const r = rand();
      let h = known && hRaw > 2 ? hRaw : this.guessHeight(type, side, w * d, r);
      const fac = this.pickFacade(type, side, h, w * d, r, rand());
      put(pr.s, { kind: 'box', cx, cz, w: Math.max(w, 3), d: Math.max(d, 3), ang, h, fac, dist: minLat, s: pr.s, seed: r });
    }
    this.addCustomBuildings(put);
    // --- grands bâtiments polygonaux ---
    const seenBig = new Set();
    for (const [hRaw, type, flat, name] of BIG_BUILDINGS) {
      const sig = flat.slice(0, 4).join(',');
      if (seenBig.has(sig)) continue;
      seenBig.add(sig);
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
      let cx = 0, cz = 0;
      for (const p of pts) { cx += p[0]; cz += p[1]; }
      cx /= pts.length; cz /= pts.length;
      const pr = this.index.project(cx, cz, 600);
      if (!pr) continue;
      const side = pr.lat > 0 ? 1 : -1;
      const pp = {}; track.pointAt(pr.s, pp);
      let minLat = Infinity, crosses = false;
      for (const [x, z] of pts) { const lat = (x - pp.x) * pp.rx + (z - pp.z) * pp.rz; if (Math.sign(lat) !== side) crosses = true; minLat = Math.min(minLat, Math.abs(lat)); }
      if (crosses) continue;
      const r = rand();
      const h = hRaw > 2 ? hRaw : this.guessHeight(type, side, 3000, r);
      put(pr.s, { kind: 'poly', pts, h, fac: this.pickFacade(type, side, h, 3000, r, rand()), name, s: pr.s, dist: minLat, seed: r });
    }
  }

  // grands repères proches du périphérique, modélisés en volumes empilés (façades réelles de l'atlas)
  addCustomBuildings(put) {
    const t = this.track;
    const add = (lat, lon, tiers, fac, angDeg, tint = null) => {
      const { x, z } = geoToLocal(lat, lon);
      const pr = this.index.project(x, z, 800);
      if (!pr) return;
      for (const [w, d, y0, h, dx = 0, dz = 0] of tiers) {
        put(pr.s, { kind: 'box', cx: x + dx, cz: z + dz, w, d, ang: (angDeg * Math.PI) / 180, h: y0 + h, y0, fac, dist: 99, s: pr.s, seed: 0.5, tint, custom: true });
      }
    };
    // Tribunal de Paris (R. Piano, 160 m) : socle + 3 gradins vitrés en retrait
    add(48.8972, 2.3140, [[118, 58, 0, 38], [96, 46, 38, 52, -6, 0], [80, 40, 90, 40, -10, 0], [66, 32, 130, 30, -14, 0]], FAC.office, 18, [1.55, 1.62, 1.7]);
    // Hôtel Hyatt Regency Paris Étoile (Porte Maillot, 137 m) + Palais des Congrès
    add(48.8797, 2.2832, [[46, 28, 0, 137]], FAC.office, 28);
    add(48.8784, 2.2826, [[150, 92, 0, 30]], FAC.modern, 28);
    // Philharmonie de Paris (Porte de Pantin) : volume « oiseaux » en aluminium
    add(48.8918, 2.3935, [[120, 70, 0, 38], [60, 40, 38, 16, 10, 0]], FAC.modern, 20, [1.15, 1.2, 1.25]);
    // Tours Duo (J. Nouvel, Paris 13) : deux tours de 180 m et 122 m
    add(48.8286, 2.3790, [[26, 26, 0, 180, -12, 6]], FAC.office, 32, [1.2, 1.3, 1.4]);
    add(48.8283, 2.3810, [[26, 26, 0, 122, 14, -6]], FAC.office, 32, [1.2, 1.3, 1.4]);
    // Accor Arena (Bercy) : pyramide végétalisée
    add(48.8386, 2.3787, [[150, 110, 0, 14], [120, 84, 14, 12, 0, 0], [92, 58, 26, 10, 0, 0]], FAC.industry, 0, [0.78, 0.92, 0.7]);
    // Parc des expositions de la Porte de Versailles : grands halls
    add(48.8316, 2.2877, [[180, 120, 0, 24], [140, 80, 24, 6, 0, 0]], FAC.industry, 10, [0.95, 0.98, 1.02]);
    // Adidas Arena (Porte de la Chapelle)
    add(48.8996, 2.3615, [[110, 74, 0, 28]], FAC.modern, 0, [0.62, 0.66, 0.72]);
    // Cité des sciences et de l'industrie (La Villette)
    add(48.8951, 2.3880, [[230, 100, 0, 44]], FAC.office, 20, [1.1, 1.15, 1.2]);
    // Tours Mercuriales (Bagnolet, ~ 90 m)
    add(48.8637, 2.4170, [[30, 30, 0, 92, -32, 0], [30, 30, 0, 92, 32, 0]], FAC.office, 0);
  }

  // vérifie qu'une emprise reste à distance de la plate-forme routière
  clearance(pts) {
    const t = this.track;
    let need = 0, sAt = 0, side = 0, firstSide = 0;
    const test = (x, z) => {
      const pr = this.index.project(x, z, 500);
      if (!pr) return;
      const sd = pr.lat >= 0 ? 1 : -1;
      if (!firstSide) firstSide = sd;
      let edge = t.mainEdgeAt(pr.s) + 7;
      if (this.ramps && sd > 0) for (const o of this.ramps.at(pr.s, 0)) edge = Math.max(edge, t.mainEdgeAt(pr.s) + o.gap + o.w + 5);
      let n = edge - Math.abs(pr.lat);
      if (sd !== firstSide) n = edge + Math.abs(pr.lat); // l'emprise enjambe le périphérique
      if (n > need) { need = n; sAt = pr.s; side = firstSide; }
    };
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 8));
      for (let k = 0; k < n; k++) test(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n);
    }
    return { ok: need <= 0, need, s: sAt, side: side || 1 };
  }

  guessHeight(type, side, area, r) {
    switch (type) {
      case 1: return side > 0 ? 18 + r * 9 : 14 + r * 14;      // HBM ≈ 6-8 niveaux
      case 2: return 16 + r * 18;
      case 3: return 6 + r * 6;
      case 4: return 10 + r * 8;
      case 5: return 7 + r * 4;
      case 6: return 14 + r * 10;
      case 7: return 16 + r * 10;
      default: return area < 120 ? 6 + r * 6 : area < 400 ? 12 + r * 10 : 15 + r * 12;
    }
  }
  pickFacade(type, side, h, area, r, r2) {
    if (type === 2) return h > 22 ? FAC.office : (r2 < 0.5 ? FAC.office : FAC.modern);
    if (type === 3 || type === 6) return FAC.industry;
    if (h > 34) return r2 < 0.55 ? FAC.barre : FAC.office;
    if (type === 1 || type === 0 || type === 4) {
      if (side > 0) return r2 < 0.55 ? FAC.hbm : r2 < 0.75 ? FAC.modern : r2 < 0.88 ? FAC.haussmann : FAC.barre;
      return r2 < 0.38 ? FAC.haussmann : r2 < 0.7 ? FAC.modern : r2 < 0.85 ? FAC.barre : FAC.hbm;
    }
    if (type === 5) return r2 < 0.6 ? FAC.haussmann : FAC.modern;
    if (type === 7) return FAC.haussmann;
    return FAC.modern;
  }

  // construit les bâtiments d'un segment : 1 batch par façade + 1 batch toitures
  buildChunk(ci, roadClear, facB, roofB) {
    const list = this.byChunk.get(ci);
    if (!list) return;
    for (const b of list) {
      if (b.dist < roadClear) continue; // ne jamais empiéter sur la chaussée
      this.drawBuilding(b, facB, roofB);
    }
  }

  // dessine un bâtiment (façades atlas + toiture, mansarde, édicules)
  drawBuilding(b, facB, roofB) {
    {
      const fac = FACADES[b.fac];
      const pal = TINTS[b.fac];
      const tint = b.tint || shade(rgb(pal[Math.floor(b.seed * 997) % pal.length]), 0.9 + b.seed * 0.14);
      const pts = b.kind === 'box' ? rectPts(b) : b.pts;
      const h = b.h, B = facB[b.fac], y0 = b.y0 || 0;
      // rez-de-chaussée commerçant sous les immeubles de ville (hauts de 9 m et plus)
      const shopOK = y0 < 0.5 && h >= 9 && (b.fac === FAC.hbm || b.fac === FAC.haussmann || b.fac === FAC.modern || b.fac === FAC.barre) && b.seed > 0.12;
      const SH = 4.2, SB = facB[FAC.shop];
      // façades
      for (let i = 0; i < pts.length; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 0.3) continue;
        const base = shopOK && L > 5 ? SH : 0;
        if (base) {
          const sc = shade(rgb(0xffffff), 0.94 + ((i * 5) % 3) * 0.03);
          const s0 = SB.v(x0, 0, z0, 0, 0, sc), s1 = SB.v(x1, 0, z1, L / (3.4 * 4), 0, sc);
          const s2 = SB.v(x1, SH, z1, L / (3.4 * 4), 0.25, sc), s3 = SB.v(x0, SH, z0, 0, 0.25, sc);
          SB.quad(s0, s1, s2, s3);
        }
        const u1 = L / (fac.bay * 4), v1 = h / (fac.floor * 4), v0 = (y0 + base) / (fac.floor * 4);
        const c = shade(tint, 0.92 + ((i * 7) % 3) * 0.04);
        const a0 = B.v(x0, y0 + base, z0, 0, v0, c), a1 = B.v(x1, y0 + base, z1, u1, v0, c);
        const a2 = B.v(x1, h, z1, u1, v1, c), a3 = B.v(x0, h, z0, 0, v1, c);
        B.quad(a0, a1, a2, a3);
      }
      // toiture (éventail convexe suffisant pour rectangles ; polygones : triangulation)
      const rc = b.fac === FAC.haussmann ? rgb(0x6d757d) : b.fac === FAC.hbm ? rgb(0x7a5a4a) : rgb(0x5a5c5f);
      const ids = pts.map(([x, z]) => roofB.v(x, h, z, x / 6, z / 6, shade(rc, 0.9 + b.seed * 0.2)));
      if (pts.length === 4) { roofB.quad(ids[0], ids[1], ids[2], ids[3]); }
      else {
        const tris = this.T.ShapeUtils.triangulateShape(pts.map(([x, z]) => new this.T.Vector2(x, z)), []);
        for (const [i0, i1, i2] of tris) roofB.tri(ids[i0], ids[i1], ids[i2]);
      }
      // acrotère : rebord clair qui dessine le bâtiment (toutes toitures plates)
      if (!(b.kind === 'box' && b.fac === FAC.haussmann && b.w > 6 && b.d > 6)) {
        const ac = shade(rgb(0xcfcac0), 0.9 + b.seed * 0.12), AH = b.fac === FAC.office ? 0.5 : 0.85;
        for (let i = 0; i < pts.length; i++) {
          const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
          if (Math.hypot(x1 - x0, z1 - z0) < 0.8) continue;
          roofB.quad(roofB.v(x0, h, z0, 0, 0, ac), roofB.v(x1, h, z1, 1, 0, ac), roofB.v(x1, h + AH, z1, 1, 0.1, ac), roofB.v(x0, h + AH, z0, 0, 0.1, ac));
        }
      }
      // antenne / mât sur les tours
      if (b.kind === 'box' && h > 30 && b.seed > 0.35) {
        const hh = 5 + b.seed * 9, w = 0.35, am = rgb(0x8d9298);
        const x = b.cx, z = b.cz;
        roofB.quad(roofB.v(x - w, h, z, 0, 0, am), roofB.v(x + w, h, z, 1, 0, am), roofB.v(x + w, h + hh, z, 1, 1, am), roofB.v(x - w, h + hh, z, 0, 1, am));
        roofB.quad(roofB.v(x, h, z - w, 0, 0, am), roofB.v(x, h, z + w, 1, 0, am), roofB.v(x, h + hh, z + w, 1, 1, am), roofB.v(x, h + hh, z - w, 0, 1, am));
      }
      // édicules techniques sur les toits plats
      if (b.kind === 'box' && b.w * b.d > 180 && b.fac !== FAC.haussmann) {
        const cx = b.cx, cz = b.cz, ca = Math.cos(b.ang), sa = Math.sin(b.ang);
        const ew = Math.min(b.w * 0.25, 5), ed = Math.min(b.d * 0.3, 4);
        const ep = [[-ew, -ed], [ew, -ed], [ew, ed], [-ew, ed]].map(([u, v]) => [cx + u * ca - v * sa, cz + u * sa + v * ca]);
        for (let i = 0; i < 4; i++) {
          const [x0, z0] = ep[i], [x1, z1] = ep[(i + 1) % 4];
          const cc = shade(rgb(0x8a8c8e), 0.9);
          const q0 = roofB.v(x0, h, z0, 0, 0, cc), q1 = roofB.v(x1, h, z1, 1, 0, cc), q2 = roofB.v(x1, h + 2.4, z1, 1, 0.4, cc), q3 = roofB.v(x0, h + 2.4, z0, 0, 0.4, cc);
          roofB.quad(q0, q1, q2, q3);
        }
        const top = ep.map(([x, z]) => roofB.v(x, h + 2.4, z, 0, 0, rgb(0x6a6c6e)));
        roofB.quad(top[0], top[1], top[2], top[3]);
      }
      // mansarde en zinc pour l'haussmannien (rectangles)
      if (b.kind === 'box' && b.fac === FAC.haussmann && b.w > 6 && b.d > 6) {
        const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
        const W = b.w / 2, D = b.d / 2, ins = 2.2, mh = 3.6;
        const base = [[-W, -D], [W, -D], [W, D], [-W, D]], top = [[-W + ins, -D + ins], [W - ins, -D + ins], [W - ins, D - ins], [-W + ins, D - ins]];
        const tw = (u, v) => [b.cx + u * ca - v * sa, b.cz + u * sa + v * ca];
        const zc = rgb(0x6f7880);
        for (let i = 0; i < 4; i++) {
          const A = tw(...base[i]), Bq = tw(...base[(i + 1) % 4]), C = tw(...top[(i + 1) % 4]), Dq = tw(...top[i]);
          const q0 = roofB.v(A[0], h, A[1], 0, 0, zc), q1 = roofB.v(Bq[0], h, Bq[1], 2, 0, zc);
          const q2 = roofB.v(C[0], h + mh, C[1], 2, 1, shade(zc, 1.1)), q3 = roofB.v(Dq[0], h + mh, Dq[1], 0, 1, shade(zc, 1.1));
          roofB.quad(q0, q1, q2, q3);
        }
        const tt = top.map((p) => { const w = tw(...p); return roofB.v(w[0], h + mh, w[1], 0, 0, rgb(0x5d656c)); });
        roofB.quad(tt[0], tt[1], tt[2], tt[3]);
        // lucarnes de la mansarde : une par travée sur chaque pan
        for (let i = 0; i < 4; i++) {
          const A = tw(...base[i]), Bq = tw(...base[(i + 1) % 4]), C = tw(...top[(i + 1) % 4]), Dq = tw(...top[i]);
          const len = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]);
          const n = Math.floor(len / 3.4) - 1;
          if (n < 1 || n > 18) continue;
          for (let k = 0; k < n; k += 2) {
            const f = ((k + 1) * 3.4 - 0.2) / len;
            if (f > 0.96) break;
            const px = (A[0] + (Bq[0] - A[0]) * f) * 0.55 + (Dq[0] + (C[0] - Dq[0]) * f) * 0.45;
            const pz = (A[1] + (Bq[1] - A[1]) * f) * 0.55 + (Dq[1] + (C[1] - Dq[1]) * f) * 0.45;
            const py = h + mh * 0.45;
            let nx = pz - b.cz, nz = -(px - b.cx);                 // normale sortante (perpendiculaire à l'arête)
            const ex = Bq[0] - A[0], ez = Bq[1] - A[1];
            nx = -ez; nz = ex;
            if (nx * (px - b.cx) + nz * (pz - b.cz) < 0) { nx = -nx; nz = -nz; }
            const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
            const ux = ex / len, uz = ez / len, hw = 0.55, dh = 1.25, dd = 0.7;
            const fz = shade(zc, 1.18), win = rgb(0x2a3038), fr = rgb(0xe6e1d4);
            const f0 = [px + nx * dd - ux * hw, pz + nz * dd - uz * hw], f1 = [px + nx * dd + ux * hw, pz + nz * dd + uz * hw];
            const b0 = [px - ux * hw, pz - uz * hw], b1 = [px + ux * hw, pz + uz * hw];
            roofB.quad(roofB.v(f0[0], py, f0[1], 0, 0, fr), roofB.v(f1[0], py, f1[1], 1, 0, fr), roofB.v(f1[0], py + dh, f1[1], 1, 1, fr), roofB.v(f0[0], py + dh, f0[1], 0, 1, fr));
            const iw = 0.82;   // vitrage sombre
            roofB.quad(roofB.v(f0[0] + ux * 0.1 + nx * 0.01, py + 0.12, f0[1] + uz * 0.1 + nz * 0.01, 0, 0, win), roofB.v(f1[0] - ux * 0.1 + nx * 0.01, py + 0.12, f1[1] - uz * 0.1 + nz * 0.01, 1, 0, win),
              roofB.v(f1[0] - ux * 0.1 + nx * 0.01, py + dh * iw, f1[1] - uz * 0.1 + nz * 0.01, 1, 1, win), roofB.v(f0[0] + ux * 0.1 + nx * 0.01, py + dh * iw, f0[1] + uz * 0.1 + nz * 0.01, 0, 1, win));
            roofB.quad(roofB.v(f0[0], py + dh, f0[1], 0, 0, fz), roofB.v(f1[0], py + dh, f1[1], 1, 0, fz), roofB.v(b1[0], py + dh + 0.6, b1[1], 1, 1, fz), roofB.v(b0[0], py + dh + 0.6, b0[1], 0, 1, fz));
          }
        }
        // cheminées
        for (let k = 0; k < 3; k++) {
          const u = (-0.6 + k * 0.6) * (W - ins), w = tw(u, 0);
          const cc = rgb(0xb07a5a);
          const cp = [[-0.5, -0.25], [0.5, -0.25], [0.5, 0.25], [-0.5, 0.25]].map(([du, dv]) => [w[0] + du * ca - dv * sa, w[1] + du * sa + dv * ca]);
          for (let i = 0; i < 4; i++) {
            const [x0, z0] = cp[i], [x1, z1] = cp[(i + 1) % 4];
            roofB.quad(roofB.v(x0, h + mh, z0, 0, 0, cc), roofB.v(x1, h + mh, z1, 0, 0, cc), roofB.v(x1, h + mh + 1.6, z1, 0, 0, cc), roofB.v(x0, h + mh + 1.6, z0, 0, 0, cc));
          }
        }
      }
    }
  }
}

// teintes par type de façade (enduits, pierres, bétons)
const TINTS = [
  [0xffffff, 0xf2e6e0, 0xffeedd],                     // HBM
  [0xffffff, 0xfff4e2, 0xf3eadb, 0xfffaf0],           // haussmannien
  [0xe8e4dc, 0xd9d2c4, 0xefe3cf, 0xd0d4d8, 0xe6d3c0], // barres
  [0xffffff, 0xdfe8f0, 0xe8e8e8],                     // bureaux
  [0xf0e6d4, 0xe6dccb, 0xf3eee6, 0xe9d8c6, 0xdfe2e0, 0xf1dfd0], // logements récents
  [0xffffff, 0xd8dcd6, 0xe4d9c8],                     // entrepôts
  [0xffffff, 0xf4efe4, 0xece3d2],                     // commerces
];

function rectPts(b) {
  const ca = Math.cos(b.ang), sa = Math.sin(b.ang), W = b.w / 2, D = b.d / 2;
  return [[-W, -D], [W, -D], [W, D], [-W, D]].map(([u, v]) => [b.cx + u * ca - v * sa, b.cz + u * sa + v * ca]);
}

// ============================================================
// Monuments et grands repères de la ligne d'horizon (silhouettes)
// ============================================================
export function buildLandmarks(T, scene) {
  const B = new Batch();
  const at = geoToLocal;
  const box = (x, z, w, d, y0, h, col, ang = 0) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * ca - v * sa, z + u * sa + v * ca]);
    const c = rgb(col);
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % 4];
      B.quad(B.v(x0, y0, z0, 0, 0, c), B.v(x1, y0, z1, 1, 0, c), B.v(x1, y0 + h, z1, 1, 1, shade(c, 1.06)), B.v(x0, y0 + h, z0, 0, 1, shade(c, 1.06)));
    }
    const t = pts.map(([px, pz]) => B.v(px, y0 + h, pz, 0, 0, shade(c, 1.1)));
    B.quad(t[0], t[1], t[2], t[3]);
  };
  // pyramide tronquée (pieds de la tour Eiffel, dômes approximés)
  const frustum = (x, z, w0, w1, y0, h, col, n = 4) => {
    const c = rgb(col);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + Math.PI / 4, a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / 4;
      const p = (r, a, y) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      const q = [p(w0, a0, y0), p(w0, a1, y0), p(w1, a1, y0 + h), p(w1, a0, y0 + h)];
      B.quad(B.v(...q[0], 0, 0, c), B.v(...q[1], 1, 0, c), B.v(...q[2], 1, 1, c), B.v(...q[3], 0, 1, c));
    }
  };
  // Tour Montparnasse
  { const { x, z } = at(48.8421, 2.3220); box(x, z, 50, 32, 0, 209, 0x2c3138, 0.5); }
  // Sacré-Cœur sur la butte Montmartre
  {
    const { x, z } = at(48.8867, 2.3431);
    frustum(x, z, 260, 120, 0, 60, 0x5c6b4a, 8);   // butte
    box(x, z, 85, 45, 60, 32, 0xece6da);
    frustum(x, z, 18, 16, 92, 16, 0xf2ede2, 10); frustum(x, z, 16, 2, 108, 26, 0xf2ede2, 10);
    frustum(x + 30, z + 8, 7, 1, 92, 16, 0xf2ede2, 8); frustum(x - 30, z + 8, 7, 1, 92, 16, 0xf2ede2, 8);
    box(x + 42, z - 12, 10, 10, 60, 50, 0xece6da);
  }
  // Dôme des Invalides
  { const { x, z } = at(48.8551, 2.3126); box(x, z, 56, 56, 0, 30, 0xd9d4c8); frustum(x, z, 18, 14, 30, 14, 0xd9d4c8, 12); frustum(x, z, 14, 1.5, 44, 30, 0xc9a94a, 12); }
  // La Défense : grappe de tours + Grande Arche
  {
    const { x, z } = at(48.8925, 2.2380), rand = rng(42);
    const H = [231, 210, 187, 184, 178, 167, 161, 150, 140, 130, 120, 110];
    H.forEach((h, i) => box(x + (rand() - 0.5) * 900, z + (rand() - 0.5) * 520, 40 + rand() * 25, 30 + rand() * 25, 0, h, [0x5b6b7d, 0x7a8b9c, 0x49586a, 0x8ea0b0, 0x3f4b58][i % 5], rand()));
    const a = at(48.8925, 2.2359);
    box(a.x, a.z - 45, 110, 10, 0, 110, 0xe4e7ea); box(a.x, a.z + 45, 110, 10, 0, 110, 0xe4e7ea); box(a.x, a.z, 110, 100, 100, 10, 0xe4e7ea);
  }
  // Parc des Princes (anneau de béton nervuré) et Roland-Garros
  {
    const { x, z } = at(48.8414, 2.2530);
    const c = rgb(0xc9c6bd);
    for (let i = 0; i < 40; i++) { // bracons verticaux caractéristiques
      const a = (i / 40) * Math.PI * 2;
      box(x + Math.cos(a) * 118 * 0.9, z + Math.sin(a) * 80 * 0.9, 3, 9, 0, 34, 0xd6d3cb, -a);
    }
    frustum(x, z, 112, 104, 0, 28, 0xb2aea4, 24);
    const rg = at(48.8467, 2.2493); box(rg.x, rg.z, 110, 90, 0, 22, 0xb7553a);
  }
  // La Géode (La Villette) : sphère d'acier poli de 36 m
  {
    const { x, z } = at(48.8957, 2.3884);
    const R = 18, c = rgb(0xd5dadf);
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI - Math.PI / 2, a1 = ((k + 1) / 8) * Math.PI - Math.PI / 2;
      frustum(x, z, Math.cos(a0) * R, Math.max(0.5, Math.cos(a1) * R), R + Math.sin(a0) * R, (Math.sin(a1) - Math.sin(a0)) * R, k % 2 ? 0xe2e6ea : 0xc9cfd5, 14);
    }
  }
  // Maison de la Radio (Paris 16e) : couronne circulaire + tour
  {
    const { x, z } = at(48.8553, 2.2655);
    frustum(x, z, 78, 74, 0, 24, 0xcbbfa4, 32);
    box(x, z, 18, 18, 24, 44, 0xcbbfa4, 0.4);
  }
  // stade Charléty
  { const { x, z } = at(48.8196, 2.3466); frustum(x, z, 95, 88, 0, 20, 0xb9b6ae, 28); }
  // Tour Pleyel, Stade de France (nord, au-delà du périphérique)
  { const p = at(48.9180, 2.3440); box(p.x, p.z, 36, 36, 0, 129, 0x445566); const sf = at(48.9245, 2.3602); frustum(sf.x, sf.z, 160, 150, 0, 42, 0xd8dbe0, 24); }
  const geo = B.build(T);
  const mat = haze(new T.MeshLambertMaterial({ vertexColors: true, fog: true }), 4.5);
  const mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const eiffel = eiffelTower(T);
  scene.add(eiffel);
  return { mesh, eiffelMat: eiffel.children[0].material };
}

// brume atmosphérique allongée pour les repères lointains (visibles à plusieurs km)
export function haze(mat, k) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>',
      `#ifdef USE_FOG\n  float fogFactor = smoothstep( fogNear, fogFar * ${k.toFixed(2)}, vFogDepth ) * 0.85;\n  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif`);
  };
  mat.customProgramCacheKey = () => 'haze' + k;
  return mat;
}

// Tour Eiffel : silhouette ajourée (treillis, arches, plateformes) sur 2 plans croisés
function eiffelTower(T) {
  const W = 512, H = 1024, M = H / 330; // px par mètre
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const hw = (y) => 62.5 * Math.pow(Math.max(0, 1 - y / 312), 2.35) + 1.6;
  const X = (m) => W / 2 + m * M, Y = (m) => H - m * M;
  // silhouette
  c.beginPath();
  for (let y = 0; y <= 300; y += 2) c.lineTo(X(-hw(y)), Y(y));
  for (let y = 300; y >= 0; y -= 2) c.lineTo(X(hw(y)), Y(y));
  c.closePath();
  c.save(); c.clip();
  // treillis : croisillons serrés
  c.strokeStyle = '#6a5442'; c.lineWidth = 2.2;
  for (let k = -H; k < W + H; k += 9) {
    c.beginPath(); c.moveTo(k, H); c.lineTo(k + H * 0.55, 0); c.stroke();
    c.beginPath(); c.moveTo(k, H); c.lineTo(k - H * 0.55, 0); c.stroke();
  }
  // arêtes et montants
  c.lineWidth = 5; c.strokeStyle = '#5b4637';
  for (let y = 0; y < 300; y += 3) { c.fillStyle = '#5b4637'; c.fillRect(X(-hw(y)), Y(y) - 3, 7, 3); c.fillRect(X(hw(y)) - 7, Y(y) - 3, 7, 3); }
  for (let y = 0; y < 57; y += 3) { const inner = hw(y) - 16 * (1 - y / 70); c.fillRect(X(-inner) - 5, Y(y) - 3, 6, 3); c.fillRect(X(inner) - 1, Y(y) - 3, 6, 3); }
  c.restore();
  // grande arche entre les piliers (transparente)
  c.save(); c.globalCompositeOperation = 'destination-out';
  c.beginPath(); c.ellipse(X(0), Y(0), 38 * M, 40 * M, 0, Math.PI, 0); c.fill();
  // jours entre les piliers au-dessus de l'arche
  c.beginPath(); c.moveTo(X(-22), Y(40)); c.lineTo(X(22), Y(40)); c.lineTo(X(14), Y(54)); c.lineTo(X(-14), Y(54)); c.fill();
  c.restore();
  c.strokeStyle = '#5b4637'; c.lineWidth = 6;
  c.beginPath(); c.ellipse(X(0), Y(0), 38 * M, 40 * M, 0, Math.PI, 0); c.stroke();
  // plateformes
  c.fillStyle = '#4e3c2f';
  c.fillRect(X(-hw(57) - 3), Y(63), (hw(57) + 3) * 2 * M, 6 * M);
  c.fillRect(X(-hw(115) - 2), Y(119), (hw(115) + 2) * 2 * M, 4 * M);
  c.fillRect(X(-5), Y(282), 10 * M, 6 * M);
  // sommet et antenne
  c.fillRect(X(-2.4), Y(300), 4.8 * M, 18 * M);
  c.fillRect(X(-0.7), Y(330), 1.4 * M, 30 * M);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = haze(new T.MeshLambertMaterial({ map: tex, alphaTest: 0.35, side: T.DoubleSide, fog: true, emissive: 0xffa640, emissiveMap: tex, emissiveIntensity: 0 }), 5);
  const g = new T.Group();
  const { x, z } = geoToLocal(48.8584, 2.2945);
  for (const ry of [0.75, 0.75 + Math.PI / 2]) {
    const m = new T.Mesh(new T.PlaneGeometry(165, 330), mat);
    m.position.set(x, 165, z);
    m.rotation.y = ry;
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}
