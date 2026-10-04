// ============================================================
// Périph' Rush — tracé RÉEL du boulevard périphérique (sens intérieur)
// Axe extrait d'OpenStreetMap (628 sommets, 34,95 km), lissé en
// Catmull-Rom centripète puis rééchantillonné tous les 2 m.
// Attributs réels par tronçon : nombre de voies, tunnels/couvertures,
// viaducs, niveaux ; bretelles de sortie / d'entrée et leurs panneaux.
// Repère : X = est, Z = sud, Y = altitude. s = abscisse curviligne.
// Le sens intérieur tourne dans le sens horaire : Paris est à droite.
// ============================================================

import { clamp, lerp, smoothstep, wrap } from './utils.js';
import { RING_PTS, RING_RUNS, JUNCTIONS } from './periph-data.js';
import { CFG } from './config.js';

const STEP = 2;            // pas de la table (m)
const EGRID = 10;          // pas de la grille d'altitude (m)
export const TRENCH_DEPTH = 6.6;   // chaussée sous le niveau de la ville en tranchée
export const VIADUCT_H = 7.2;      // chaussée au-dessus de la ville sur viaduc/remblai

function catmullC(p0, p1, p2, p3, t) { // Catmull-Rom centripète (alpha 0.5)
  const d = (a, b) => Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5), 1e-4);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const u = lerp(t1, t2, t);
  const L = (a, b, ta, tb) => [((tb - u) * a[0] + (u - ta) * b[0]) / (tb - ta), ((tb - u) * a[1] + (u - ta) * b[1]) / (tb - ta)];
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

export class Track {
  constructor() {
    // --- 1. polyligne OSM → courbe dense ---
    const P = [];
    for (let i = 0; i < RING_PTS.length; i += 2) P.push([RING_PTS[i], RING_PTS[i + 1]]);
    const N = P.length;
    // longueur brute (référentiel des attributs OSM)
    let rawLen = 0;
    for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N]; rawLen += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const dense = [];
    for (let i = 0; i < N; i++) {
      const p0 = P[(i - 1 + N) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
      const segL = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.max(1, Math.ceil(segL / 1.5));
      for (let j = 0; j < k; j++) dense.push(catmullC(p0, p1, p2, p3, j / k));
    }
    // abscisse cumulée de la courbe dense
    const cum = new Float64Array(dense.length + 1);
    for (let i = 0; i < dense.length; i++) {
      const a = dense[i], b = dense[(i + 1) % dense.length];
      cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const denseLen = cum[dense.length];

    // --- 2. rééchantillonnage à pas constant + lissage gaussien (anti-cassures) ---
    let n = Math.round(denseLen / STEP);
    const X = new Float64Array(n), Z = new Float64Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = (i * denseLen) / n;
      while (cum[j + 1] < s) j++;
      const a = dense[j], b = dense[(j + 1) % dense.length];
      const t = (s - cum[j]) / Math.max(cum[j + 1] - cum[j], 1e-6);
      X[i] = lerp(a[0], b[0], t); Z[i] = lerp(a[1], b[1], t);
    }
    const R = 9, sig = 4.5, wts = [];
    let wsum = 0;
    for (let k = -R; k <= R; k++) { const w = Math.exp(-(k * k) / (2 * sig * sig)); wts.push(w); wsum += w; }
    const SX = new Float64Array(n), SZ = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let ax = 0, az = 0;
      for (let k = -R; k <= R; k++) { const q = (i + k + n) % n; ax += X[q] * wts[k + R]; az += Z[q] * wts[k + R]; }
      SX[i] = ax / wsum; SZ[i] = az / wsum;
    }
    // longueur finale
    let L = 0;
    for (let i = 0; i < n; i++) { const q = (i + 1) % n; L += Math.hypot(SX[q] - SX[i], SZ[q] - SZ[i]); }
    this.length = L;
    this.n = n = Math.round(L / STEP);
    this.step = L / n;
    // re-paramétrage à pas exact sur la courbe lissée
    this.tableX = new Float32Array(n); this.tableZ = new Float32Array(n);
    {
      let acc = 0, k = 0, i = 0;
      const m = SX.length;
      for (let q = 0; q < m && k < n; q++) {
        const q2 = (q + 1) % m;
        const d = Math.hypot(SX[q2] - SX[q], SZ[q2] - SZ[q]);
        while (acc <= d && k < n) {
          const t = d > 0 ? acc / d : 0;
          this.tableX[k] = lerp(SX[q], SX[q2], t); this.tableZ[k] = lerp(SZ[q], SZ[q2], t);
          k++; acc += this.step;
        }
        acc -= d; i++;
      }
      for (; k < n; k++) { this.tableX[k] = SX[0]; this.tableZ[k] = SZ[0]; }
    }
    this.tableTX = new Float32Array(n); this.tableTZ = new Float32Array(n); this.tableCurv = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ip = (i - 1 + n) % n, inx = (i + 1) % n;
      const tx = this.tableX[inx] - this.tableX[ip], tz = this.tableZ[inx] - this.tableZ[ip];
      const l = Math.hypot(tx, tz) || 1;
      this.tableTX[i] = tx / l; this.tableTZ[i] = tz / l;
    }
    for (let i = 0; i < n; i++) {
      const ip = (i - 3 + n) % n, inx = (i + 3) % n;
      // courbure signée (>0 = virage à droite, vers Paris)
      const cross = this.tableTX[ip] * this.tableTZ[inx] - this.tableTZ[ip] * this.tableTX[inx];
      this.tableCurv[i] = Math.asin(clamp(cross, -1, 1)) / (6 * this.step);
    }

    // --- 3. attributs OSM recalés sur l'abscisse finale ---
    const k = L / rawLen;
    this.kOSM = k;
    this.runs = RING_RUNS.map(([s, lanes, tunnel, bridge, layer], i) => {
      const nx = RING_RUNS[(i + 1) % RING_RUNS.length];
      return { s0: s * k, s1: (i + 1 < RING_RUNS.length ? nx[0] : rawLen) * k, lanes, tunnel: !!tunnel, bridge: !!bridge, layer };
    });
    // tunnels / couvertures (fusion des morceaux contigus)
    this.covers = [];
    for (const r of this.runs) {
      if (!r.tunnel) continue;
      const last = this.covers[this.covers.length - 1];
      if (last && r.s0 - last.s1 < 12) last.s1 = r.s1;
      else this.covers.push({ s0: r.s0, s1: r.s1 });
    }
    this.viaducts = [];
    for (const r of this.runs) {
      if (!r.bridge) continue;
      const last = this.viaducts[this.viaducts.length - 1];
      if (last && r.s0 - last.s1 < 12) { last.s1 = r.s1; last.layer = Math.max(last.layer, r.layer); }
      else this.viaducts.push({ s0: r.s0, s1: r.s1, layer: r.layer });
    }
    // tunnels « d'ambiance » (assombrissement) : couvertures > 150 m
    this.tunnels = this.covers.filter((c) => c.s1 - c.s0 > 150).map((c) => ({ ...c }));

    // --- 4. bretelles, portes ---
    this.junctions = JUNCTIONS.map(([s, kind, lanes, dests]) => ({ s: s * k, kind, lanes, dests }));
    this.exits = this.junctions.filter((j) => j.kind === 'X');
    this.entries = this.junctions.filter((j) => j.kind === 'E');
    this.portes = [];
    for (const x of this.exits) {
      const porte = x.dests.find((d) => /^Porte/.test(d[0]));
      if (porte) this.portes.push({ name: porte[0], s: x.s + 170, exitS: x.s, flags: '' });
    }
    // franchissements de la Seine (amont à Bercy, aval au Garigliano)
    this.bridges = this.viaducts.filter((v) => {
      const mid = (v.s0 + v.s1) / 2;
      return (mid > 1000 * k && mid < 1700 * k) || (mid > 11300 * k && mid < 12050 * k);
    }).map((v) => ({ ...v, seine: true }));
    // zones d'ambiance (bois)
    this.woods = [
      { s0: 13300 * k, s1: 17350 * k, name: 'Bois de Boulogne' },
      { s0: 33150 * k, s1: 34950 * k, name: 'Bois de Vincennes' },
      { s0: 0, s1: 650 * k, name: 'Bois de Vincennes' },
    ];
    // point repère : PR 0 à la Porte de Bercy
    this.prOrigin = (this.portes.find((p) => p.name === 'Porte de Bercy')?.s ?? 1400 * k) - 170;

    this.buildElevation();
    this.buildLaneDrops();

    const maillot = this.junctions.find((j) => j.kind === 'E' && Math.abs(j.s - 17903 * k) < 30);
    this.startS = (maillot ? maillot.s : 17903 * k) + 60; // entrée Porte Maillot
  }

  // ---------- altitude : contraintes OSM + relaxation (pentes douces) ----------
  buildElevation() {
    const L = this.length, m = Math.ceil(L / EGRID), eg = L / m;
    const hard = new Float32Array(m).fill(NaN);   // contrainte forte
    const soft = new Float32Array(m).fill(0);     // cible faible
    const wSoft = new Float32Array(m).fill(0.004);
    const runAt = (s) => this.runAtS(s);
    for (let i = 0; i < m; i++) {
      const s = i * eg, r = runAt(s);
      if (r.tunnel || r.layer < 0) hard[i] = -TRENCH_DEPTH;
      else if (r.bridge) hard[i] = VIADUCT_H + Math.max(0, r.layer - 1) * 2.2;
    }
    // tronçons ouverts courts entre deux tranchées : restent en tranchée
    for (let i = 0; i < m; i++) {
      if (!Number.isNaN(hard[i])) continue;
      let a = i, b = i;
      while (a > i - 110 && Number.isNaN(hard[(a + m) % m])) a--;
      while (b < i + 110 && Number.isNaN(hard[b % m])) b++;
      const ha = hard[(a + m) % m], hb = hard[b % m];
      if (ha < 0 && hb < 0) { soft[i] = -TRENCH_DEPTH; wSoft[i] = 0.25; }
      else if (ha > 0 && hb > 0 && b - a < 70) { soft[i] = VIADUCT_H; wSoft[i] = 0.25; }
    }
    const h = new Float32Array(m);
    for (let i = 0; i < m; i++) h[i] = Number.isNaN(hard[i]) ? soft[i] : hard[i];
    for (let it = 0; it < 900; it++) {
      for (let i = 0; i < m; i++) {
        if (!Number.isNaN(hard[i])) {
          // les extrémités des contraintes peuvent glisser (rampes d'accès)
          const prevFree = Number.isNaN(hard[(i - 1 + m) % m]), nextFree = Number.isNaN(hard[(i + 1) % m]);
          if (!prevFree && !nextFree) continue;
        }
        const avg = (h[(i - 1 + m) % m] + h[(i + 1) % m]) * 0.5;
        const v = (avg + wSoft[i] * soft[i]) / (1 + wSoft[i]);
        h[i] = Number.isNaN(hard[i]) ? v : lerp(hard[i], v, 0.35);
      }
    }
    // limitation de pente (5 %) aller-retour
    const g = 0.05 * eg;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < m * 2; i++) { const a = (i - 1) % m, b = i % m; h[b] = clamp(h[b], h[a] - g, h[a] + g); }
      for (let i = m * 2; i > 0; i--) { const a = i % m, b = (i - 1) % m; h[b] = clamp(h[b], h[a] - g, h[a] + g); }
    }
    this.elev = h;
    this.egrid = eg;
  }

  // fermetures permanentes de voies (sections à 2 ou 3 voies)
  buildLaneDrops() {
    this.laneDrops = [];
    for (const r of this.runs) {
      const main = Math.min(r.lanes, CFG.LANES);
      if (main >= CFG.LANES) continue;
      const lanes = [];
      for (let l = main; l < CFG.LANES; l++) lanes.push(l);
      const last = this.laneDrops[this.laneDrops.length - 1];
      if (last && Math.abs(last.s1 - r.s0) < 1 && last.lanes.length === lanes.length) last.s1 = r.s1;
      else this.laneDrops.push({ s0: r.s0, s1: r.s1, lanes, permanent: true });
    }
  }

  // --- interrogation du tracé ------------------------------------
  idx(s) { return wrap(s, this.length) / this.step; }

  runAtS(s) {
    s = wrap(s, this.length);
    const R = this.runs;
    let lo = 0, hi = R.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (R[mid].s0 <= s) lo = mid; else hi = mid - 1; }
    return R[lo];
  }

  pointAt(s, out) {
    const f = this.idx(s);
    const i = Math.floor(f) % this.n, j = (i + 1) % this.n, t = f - Math.floor(f);
    out.x = lerp(this.tableX[i], this.tableX[j], t);
    out.z = lerp(this.tableZ[i], this.tableZ[j], t);
    out.y = this.elevationAt(s);
    const tx = lerp(this.tableTX[i], this.tableTX[j], t);
    const tz = lerp(this.tableTZ[i], this.tableTZ[j], t);
    const l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l; out.tz = tz / l;
    // vecteur « droite du sens de marche » (sens horaire : Paris à droite)
    out.rx = -out.tz; out.rz = out.tx;
    out.curv = lerp(this.tableCurv[i], this.tableCurv[j], t);
    return out;
  }

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
    return Math.atan2(p.tx, p.tz);
  }

  elevationAt(s) {
    const f = wrap(s, this.length) / this.egrid;
    const m = this.elev.length;
    const i = Math.floor(f) % m, t = f - Math.floor(f);
    const a = this.elev[(i - 1 + m) % m], b = this.elev[i], c = this.elev[(i + 1) % m], d = this.elev[(i + 2) % m];
    // Catmull-Rom pour une pente continue
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  }

  // nombre de voies principales (≤ CFG.LANES) et voies auxiliaires (entrecroisement)
  lanesAt(s) { return clamp(this.runAtS(s).lanes, 2, CFG.LANES); }
  auxLanesAt(s) { return Math.max(0, this.runAtS(s).lanes - CFG.LANES); }
  // largeur de chaussée lissée (transitions de 90 m) en nombre de voies
  laneWidthAt(s, fn = (q) => this.lanesAt(q) + this.auxLanesAt(q)) {
    const a = fn(s - 45), b = fn(s), c = fn(s + 45);
    if (a === b && b === c) return b;
    // transition douce : moyenne glissante sur 90 m
    let acc = 0;
    for (let k = -4; k <= 4; k++) acc += fn(s + k * 11.25);
    return acc / 9;
  }
  edgeAt(s) { return CFG.INNER_EDGE + CFG.LANE_WIDTH * this.laneWidthAt(s); }
  mainEdgeAt(s) { return CFG.INNER_EDGE + CFG.LANE_WIDTH * this.laneWidthAt(s, (q) => this.lanesAt(q)); }

  // profil en travers : 'tunnel' | 'trench' | 'viaduct' | 'embankment' | 'ground'
  profileAt(s) {
    if (this.coverAt(s)) return 'tunnel';
    const h = this.elevationAt(s);
    if (h < -2.2) return 'trench';
    if (h > 2.4) return this.runAtS(s).bridge ? 'viaduct' : 'embankment';
    return 'ground';
  }

  inRanges(list, s) {
    s = wrap(s, this.length);
    for (const t of list) if (t.s1 > t.s0 ? (s >= t.s0 && s < t.s1) : (s >= t.s0 || s < t.s1)) return t;
    return null;
  }
  inTunnel(s) { return this.inRanges(this.tunnels, s); }
  coverAt(s) { return this.inRanges(this.covers, s); }
  onBridge(s) { return this.inRanges(this.bridges, s); }
  onViaduct(s) { return this.inRanges(this.viaducts, s); }
  woodAt(s) { return this.inRanges(this.woods, s); }

  // compatibilité : zone d'ambiance (drapeaux) au point s
  zoneAt(s) {
    const wood = this.woodAt(s);
    return { s, alt: this.elevationAt(s), flags: wood ? 'T' : 'B', name: wood ? wood.name : '' };
  }

  nextPorte(s) {
    s = wrap(s, this.length);
    let best = null, bestD = Infinity;
    for (const p of this.portes) {
      const d = wrap(p.s - s, this.length);
      if (d < bestD) { bestD = d; best = p; }
    }
    return { porte: best, dist: bestD };
  }
  nextExit(s) {
    s = wrap(s, this.length);
    let best = null, bestD = Infinity;
    for (const x of this.exits) {
      const d = wrap(x.s - s, this.length);
      if (d < bestD) { bestD = d; best = x; }
    }
    return { exit: best, dist: bestD };
  }
  // point repère kilométrique (PR, origine Porte de Bercy)
  prAt(s) { return wrap(s - this.prOrigin, this.length); }
}
