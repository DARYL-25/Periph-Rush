// ============================================================
// Périph' Rush — tracé du boulevard périphérique parisien
// Boucle fermée construite depuis les coordonnées GPS réelles des
// portes (sens intérieur = horaire), recalée à 35 040 m.
// Repère : X = est, Z = sud, Y = altitude. s = abscisse curviligne.
// ============================================================

import { clamp, lerp, smoothstep, wave1, wrap } from './utils.js';

// [nom, lat, lon, alt relative (m), drapeaux]
// alt: <0 tranchée/tunnel, >0 viaduc. Drapeaux zone jusqu'à la porte suivante :
//  t=tunnel après la porte, T=arbres denses (bois), S=Seine (viaduc), C=canal,
//  B=immeubles denses, I=échangeur majeur, W=murs antibruit
const PORTES = [
  ['Porte Maillot',            48.8781, 2.2825, -3, 'B I'],
  ['Porte des Ternes',         48.8815, 2.2872, -5, 't B'],
  ['Porte de Champerret',      48.8858, 2.2926, -4, 'B W'],
  ['Porte d\'Asnières',        48.8892, 2.3012, -3, 'B W'],
  ['Porte de Clichy',          48.8938, 2.3098, -2, 'B'],
  ['Porte de Saint-Ouen',      48.8983, 2.3292, -3, 'B W'],
  ['Porte de Clignancourt',    48.8996, 2.3446, -4, 'B'],
  ['Porte de la Chapelle',     48.8988, 2.3596, 0,  'B I'],
  ['Porte d\'Aubervilliers',   48.8984, 2.3702, 1,  'C B'],
  ['Porte de la Villette',     48.8978, 2.3858, 2,  'C B I'],
  ['Porte de Pantin',          48.8894, 2.3926, -2, 'B W'],
  ['Porte du Pré-Saint-Gervais', 48.8792, 2.3936, -5, 'B'],
  ['Porte des Lilas',          48.8768, 2.4066, -7, 't B'],
  ['Porte de Bagnolet',        48.8646, 2.4154, -2, 'B I'],
  ['Porte de Montreuil',       48.8534, 2.4146, -3, 'B W'],
  ['Porte de Vincennes',       48.8470, 2.4126, -4, 'T'],
  ['Porte Dorée',              48.8355, 2.4062, -1, 'T'],
  ['Porte de Bercy',           48.8272, 2.3912, 7,  'S I'],
  ['Porte d\'Ivry',            48.8216, 2.3692, 2,  'B I'],
  ['Porte d\'Italie',          48.8182, 2.3600, -2, 'B I'],
  ['Porte de Gentilly',        48.8166, 2.3422, -5, 'B'],
  ['Porte d\'Orléans',         48.8224, 2.3256, -3, 'B I'],
  ['Porte de Châtillon',       48.8228, 2.3142, -4, 'B W'],
  ['Porte de Vanves',          48.8252, 2.3050, -6, 't B'],
  ['Porte Brancion',           48.8266, 2.3008, -4, 'B W'],
  ['Porte de la Plaine',       48.8282, 2.2920, -2, 'B'],
  ['Porte de Sèvres',          48.8300, 2.2766, 3,  'S I'],
  ['Porte de Saint-Cloud',     48.8380, 2.2558, 0,  'B I'],
  ['Porte Molitor',            48.8452, 2.2522, -3, 'B'],
  ['Porte d\'Auteuil',         48.8478, 2.2518, -5, 'T I'],
  // traversée du Bois de Boulogne (points de forme sans sortie)
  ['@Bois de Boulogne',        48.8580, 2.2560, -3, 'T'],
  ['@Bois nord',               48.8668, 2.2680, -2, 'T'],
  ['Porte Dauphine',           48.8712, 2.2758, -4, 'T B'],
];

const RING_LENGTH = 35040; // longueur officielle du périphérique intérieur (m)
const STEP = 4;            // pas d'échantillonnage de la table (m)

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export class Track {
  constructor() {
    // --- lat/lon → mètres locaux (équirectangulaire autour du centre) ---
    const lat0 = 48.8590, lon0 = 2.3400; // ~centre de Paris
    const mLat = 111132, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const pts = PORTES.map(([name, lat, lon, alt, flags]) => ({
      name, alt, flags: flags || '',
      x: (lon - lon0) * mLon,
      z: -(lat - lat0) * mLat, // nord = -Z
    }));

    // --- échantillonnage dense de la Catmull-Rom fermée ---
    const raw = [];
    const N = pts.length;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      for (let j = 0; j < 24; j++) {
        const t = j / 24;
        raw.push({
          x: catmull(p0.x, p1.x, p2.x, p3.x, t),
          z: catmull(p0.z, p1.z, p2.z, p3.z, t),
          seg: i, t,
        });
      }
    }
    // longueur brute → facteur d'échelle vers 35 040 m
    let rawLen = 0;
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i], b = raw[(i + 1) % raw.length];
      rawLen += Math.hypot(b.x - a.x, b.z - a.z);
    }
    const scale = RING_LENGTH / rawLen;
    for (const p of raw) { p.x *= scale; p.z *= scale; }

    // --- table à pas constant (STEP m) : position, tangente, s de chaque porte ---
    this.length = RING_LENGTH;
    const n = Math.round(RING_LENGTH / STEP);
    this.tableX = new Float32Array(n);
    this.tableZ = new Float32Array(n);
    this.tableTX = new Float32Array(n);
    this.tableTZ = new Float32Array(n);
    this.tableCurv = new Float32Array(n);
    this.n = n;

    const porteS = new Array(N).fill(-1);
    let acc = 0, k = 0;
    for (let i = 0; i < raw.length && k < n; i++) {
      const a = raw[i], b = raw[(i + 1) % raw.length];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      while (acc <= d && k < n) {
        const t = d > 0 ? acc / d : 0;
        this.tableX[k] = lerp(a.x, b.x, t);
        this.tableZ[k] = lerp(a.z, b.z, t);
        if (a.t === 0 && porteS[a.seg] < 0) porteS[a.seg] = k * STEP;
        k++;
        acc += STEP;
      }
      acc -= d;
    }
    // tangentes + courbure (différences centrées, lissées)
    for (let i = 0; i < n; i++) {
      const ip = (i - 1 + n) % n, inx = (i + 1) % n;
      let tx = this.tableX[inx] - this.tableX[ip];
      let tz = this.tableZ[inx] - this.tableZ[ip];
      const l = Math.hypot(tx, tz) || 1;
      this.tableTX[i] = tx / l; this.tableTZ[i] = tz / l;
    }
    for (let i = 0; i < n; i++) {
      const ip = (i - 2 + n) % n, inx = (i + 2) % n;
      const dtx = this.tableTX[inx] - this.tableTX[ip];
      const dtz = this.tableTZ[inx] - this.tableTZ[ip];
      this.tableCurv[i] = Math.hypot(dtx, dtz) / (4 * STEP); // ≈ |dT/ds|
    }

    // --- portes (avec s), zones, tunnels ---
    this.portes = [];
    for (let i = 0; i < N; i++) {
      if (PORTES[i][0].startsWith('@')) continue;
      this.portes.push({ name: PORTES[i][0], s: porteS[i], alt: PORTES[i][3], flags: PORTES[i][4] || '' });
    }
    this.zoneAnchors = [];
    for (let i = 0; i < N; i++) {
      this.zoneAnchors.push({ s: porteS[i], alt: PORTES[i][3], flags: PORTES[i][4] || '', name: PORTES[i][0] });
    }
    // tunnels : commencent ~120 m après la porte marquée 't'
    this.tunnels = [];
    const tunnelLen = { 'Porte des Ternes': 320, 'Porte des Lilas': 780, 'Porte de Vanves': 420 };
    for (const p of this.portes) {
      if (p.flags.includes('t')) {
        const len = tunnelLen[p.name] || 350;
        this.tunnels.push({ s0: wrap(p.s + 140, RING_LENGTH), s1: wrap(p.s + 140 + len, RING_LENGTH), name: p.name });
      }
    }
    // viaducs de la Seine (zone 'S') : ~250 m centrés entre la porte et la suivante
    this.bridges = [];
    for (let i = 0; i < this.zoneAnchors.length; i++) {
      const a = this.zoneAnchors[i];
      if (a.flags.includes('S')) {
        const b = this.zoneAnchors[(i + 1) % this.zoneAnchors.length];
        const mid = wrap(a.s + wrap(b.s - a.s, RING_LENGTH) * 0.5, RING_LENGTH);
        this.bridges.push({ s0: wrap(mid - 160, RING_LENGTH), s1: wrap(mid + 160, RING_LENGTH), name: a.name });
      }
    }
    this.startS = this.portes.find((p) => p.name === 'Porte Maillot').s;
  }

  // --- interrogation du tracé ------------------------------------
  idx(s) { return wrap(s, this.length) / STEP; }

  pointAt(s, out) {
    const f = this.idx(s);
    const i = Math.floor(f) % this.n, j = (i + 1) % this.n, t = f - Math.floor(f);
    out.x = lerp(this.tableX[i], this.tableX[j], t);
    out.z = lerp(this.tableZ[i], this.tableZ[j], t);
    out.y = this.elevationAt(s);
    let tx = lerp(this.tableTX[i], this.tableTX[j], t);
    let tz = lerp(this.tableTZ[i], this.tableTZ[j], t);
    const l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l; out.tz = tz / l;
    // vecteur "droite du sens de marche" (le sens intérieur tourne horaire, Paris à droite)
    out.rx = -out.tz; out.rz = out.tx;
    out.curv = lerp(this.tableCurv[i], this.tableCurv[j], t);
    return out;
  }

  // position monde d'un point (s, latéral x vers la droite, hauteur h)
  worldPos(s, lat, h, out) {
    const p = this._tmp || (this._tmp = {});
    this.pointAt(s, p);
    out.x = p.x + p.rx * lat;
    out.y = p.y + (h || 0);
    out.z = p.z + p.rz * lat;
    return out;
  }

  headingAt(s) {
    const p = this._tmp2 || (this._tmp2 = {});
    this.pointAt(s, p);
    return Math.atan2(p.tx, p.tz); // angle Y three.js (0 = +Z)
  }

  // altitude : interpolation cosinus entre portes + ondulation légère
  elevationAt(s) {
    s = wrap(s, this.length);
    const A = this.zoneAnchors;
    let i = 0;
    for (let k = 0; k < A.length; k++) {
      const nk = (k + 1) % A.length;
      const inSeg = A[nk].s > A[k].s ? (s >= A[k].s && s < A[nk].s) : (s >= A[k].s || s < A[nk].s);
      if (inSeg) { i = k; break; }
    }
    const a = A[i], b = A[(i + 1) % A.length];
    const segLen = wrap(b.s - a.s, this.length) || 1;
    const t = wrap(s - a.s, this.length) / segLen;
    const base = lerp(a.alt, b.alt, 0.5 - 0.5 * Math.cos(t * Math.PI));
    return base + wave1(s * 0.0016, 7) * 1.1;
  }

  inTunnel(s) {
    s = wrap(s, this.length);
    for (const t of this.tunnels) {
      if (t.s1 > t.s0 ? (s >= t.s0 && s < t.s1) : (s >= t.s0 || s < t.s1)) return t;
    }
    return null;
  }
  onBridge(s) {
    s = wrap(s, this.length);
    for (const b of this.bridges) {
      if (b.s1 > b.s0 ? (s >= b.s0 && s < b.s1) : (s >= b.s0 || s < b.s1)) return b;
    }
    return null;
  }

  // zone d'ambiance au point s (drapeaux de la porte précédente)
  zoneAt(s) {
    s = wrap(s, this.length);
    const A = this.zoneAnchors;
    let best = A[0], bestD = Infinity;
    for (const a of A) {
      const d = wrap(s - a.s, this.length);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // prochaine porte devant s (pour les panneaux de sortie / HUD)
  nextPorte(s) {
    s = wrap(s, this.length);
    let best = null, bestD = Infinity;
    for (const p of this.portes) {
      const d = wrap(p.s - s, this.length);
      if (d < bestD) { bestD = d; best = p; }
    }
    return { porte: best, dist: bestD };
  }
}
