// ============================================================
// Périph' Rush — génération streamée du monde (refonte « réaliste »)
// Le périphérique réel (axe, voies, tranchées, couvertures, viaducs,
// bretelles, abords) est construit par segments de 100 m autour du
// joueur. Profil en travers par rangée de 5 m :
//   séparateur béton (DBA) + candélabres doubles — 2×(2 à 4) voies —
//   bretelles d'entrée/sortie réelles (voies d'accélération, musoirs,
//   zébras) — puis selon l'altitude : murs de tranchée tagués,
//   couvertures avec plafonds éclairés, viaducs à parapets et piles,
//   talus enherbés, écrans antibruit — et la ville réelle (OSM).
// Chaque segment fusionne son décor par matériau (≈ 20 draw calls).
// ============================================================

import { CFG } from './config.js';
import { rng, wrap, clamp, lerp, smoothstep } from './utils.js';
import { Batch, TileView, rgb, shade, P, band, boxAt, cylinder } from './geo.js';
import { makeAtlas, makeAtlasLike, atlasify } from './atlas.js';
import * as TX from './textures.js';
import {
  directionPanel, gantryPanel, speedLimitTexture, radarTexture, hovTexture, laneSignalTexture,
  sosTexture, prPlateTexture, goreTexture, VMSPanel, bpStack, exitLines,
} from './signs.js';
import { Scenery, buildLandmarks } from './scenery.js';

const ROW = 5;            // pas des rangées de construction (m)
const MED = 0.31;         // demi-largeur de la DBA centrale
const CEIL = 5.3;         // hauteur libre sous couverture
const LW = CFG.LANE_WIDTH;

// ---------- bretelles réelles (géométrie paramétrique) ----------
class Ramps {
  constructor(track) {
    this.track = track;
    const L = track.length;
    this.list = [];
    const J = track.junctions;
    for (const j of J) {
      const W = LW * Math.min(Math.max(j.lanes, 1), 2);
      const h = track.elevationAt(j.s);
      const target = Math.abs(h) > 2 ? 0 : h;
      if (j.kind === 'X') {
        const taper = 60, par = j.lanes > 1 ? 110 : 80, div = 240;
        this.list.push({ j, kind: 'X', W, target, taper, par, div, G: 12 + W, s0: j.s - par - taper, s1: j.s + div });
      } else {
        const taper = 70, par = 100, div = 240;
        this.list.push({ j, kind: 'E', W, target, taper, par, div, G: 12 + W, s0: j.s - div, s1: j.s + par + taper });
      }
    }
    // entrecroisements : entrée suivie d'une sortie à moins de 420 m → voie continue
    const sorted = [...J].sort((a, b) => a.s - b.s);
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i], x = sorted[(i + 1) % sorted.length];
      const d = wrap(x.s - e.s, L);
      if (e.kind === 'E' && x.kind === 'X' && d < 420) this.list.push({ kind: 'W', W: LW, s0: e.s, s1: e.s + d });
    }
  }
  // bretelles actives en s : [{gap, w, hr, parallel, r}]
  at(s, hMain) {
    const L = this.track.length, out = [];
    for (const r of this.list) {
      const u = wrap(s - r.s0, L);
      if (u > wrap(r.s1 - r.s0, L)) continue;
      let gap = 0, w = r.W, hr = hMain, t = 0;
      if (r.kind === 'W') { out.push({ gap: 0, w, hr, parallel: true, r, t: 0 }); continue; }
      if (r.kind === 'X') {
        const v = s - r.j.s; const vv = v < -L / 2 ? v + L : v > L / 2 ? v - L : v;
        if (vv < -r.par) w = r.W * smoothstep(-r.par - r.taper, -r.par, vv);
        else if (vv > 0) {
          t = vv / r.div;
          gap = r.G * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(t, 1)));
          hr = lerp(hMain, r.target, smoothstep(0.12, 0.95, t));
        }
      } else {
        const v = r.j.s - s; const vv = v < -L / 2 ? v + L : v > L / 2 ? v - L : v; // >0 avant la jonction
        if (vv < -r.par) w = r.W * smoothstep(-r.par - r.taper, -r.par, vv);
        else if (vv > 0) {
          t = vv / r.div;
          gap = r.G * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(t, 1)));
          hr = lerp(hMain, r.target, smoothstep(0.12, 0.95, t));
        }
      }
      if (w < 0.05) continue;
      out.push({ gap, w, hr, parallel: gap < 0.35, r, t });
    }
    out.sort((a, b) => a.gap - b.gap);
    // fusion des voies parallèles superposées (entrecroisement + bretelle)
    const merged = [];
    for (const o of out) {
      const last = merged[merged.length - 1];
      if (last && last.parallel && o.parallel) { last.w = Math.max(last.w, o.w); continue; }
      merged.push(o);
    }
    return merged;
  }
  // largeur praticable supplémentaire à droite (voies parallèles) — pour le joueur
  parallelWidth(s, hMain = 0) {
    let w = 0;
    for (const o of this.at(s, hMain)) if (o.parallel) w = Math.max(w, o.w);
    return w;
  }
}

// couronne d'arbre : 5 lobes déformés à normales radiales (aspect doux, 100 triangles)
function makeTreeGeometry(T) {
  const pos = [], nor = [], idx = [], uvs = [];
  const rand = rng(99);
  const lobes = [[0, 4.7, 0, 1.9], [0.95, 4.0, 0.45, 1.45], [-0.85, 4.1, -0.55, 1.4], [0.25, 5.6, -0.3, 1.25], [-0.3, 3.7, 0.9, 1.2]];
  for (const [cx, cy, cz, r] of lobes) {
    const g = new T.IcosahedronGeometry(1, 0);
    const p = g.getAttribute('position');
    const base = pos.length / 3;
    const map = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!map.has(key)) {
        const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
        const k = r * (0.85 + rand() * 0.3);
        pos.push(cx + nx * k, cy + ny * k * 0.9, cz + nz * k);
        const l = Math.hypot(nx, ny + 0.35, nz);
        nor.push(nx / l, (ny + 0.35) / l, nz / l);
        uvs.push((Math.atan2(nz, nx) / Math.PI + 1) * 1.5, (ny + 1) * 1.2 + cy * 0.3);
        map.set(key, base + map.size);
      }
      idx.push(map.get(key));
    }
    g.dispose();
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  return geo;
}

// ============================================================
export class World {
  constructor(THREE, scene, track) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.chunks = new Map();
    this.mats = this.makeMaterials();
    this.ramps = new Ramps(track);
    track.ramps = this.ramps;
    this.scenery = new Scenery(THREE, track, CFG.CHUNK_LEN, this.ramps);
    this.features = this.planFeatures();
    this.vms = this.features.filter((f) => f.type === 'pmv').map((f) => ({ s: f.s, panel: new VMSPanel(THREE), override: 0 }));
    this.features.filter((f) => f.type === 'pmv').forEach((f, i) => { f.vms = this.vms[i]; });
    this.landmarks = buildLandmarks(THREE, scene);
    this._p = {};
  }

  // ---------- matériaux ----------
  makeMaterials() {
    const T = this.T;
    const asphalt = TX.asphaltTextures(T);
    const facades = TX.facadeTextures(T);
    const concrete = TX.concreteTextures(T);
    const noise = TX.noiseWallTextures(T);
    const DS = T.DoubleSide;
    // atlas « ouvrages » : murs, DBA, écrans, talus, lierre, sol → 1 draw call
    const S = makeAtlas(T, [
      { name: 'wall0', image: concrete[0].image }, { name: 'wall1', image: concrete[1].image }, { name: 'wall2', image: concrete[2].image },
      { name: 'gba', image: TX.gbaTexture(T).image },
      { name: 'noise0', image: noise[0].image }, { name: 'noise1', image: noise[1].image }, { name: 'noise2', image: noise[2].image },
      { name: 'grass', image: TX.grassTexture(T).image }, { name: 'ivy', image: TX.ivyTexture(T).image }, { name: 'ground', image: TX.groundTexture(T).image },
      { name: 'tiles', image: TX.tilesTexture(T).image }, { name: 'noise3', image: TX.brickWallTexture(T).image },
      { name: 'stone', image: TX.stoneWallTexture(T).image }, { name: 'noise4', image: TX.beigeNoiseTexture(T).image }, { name: 'noise5', image: TX.ribbedMetalTexture(T).image },
    ]);
    // atlas « bâti » : 6 façades + toitures (jour) et fenêtres allumées (nuit)
    const roof = TX.roofTexture(T);
    const bEntries = facades.map((f, i) => ({ name: 'f' + i, image: f.day.image })).concat([{ name: 'roof', image: roof.image }]);
    const Bt = makeAtlas(T, bEntries);
    const glow = makeAtlasLike(T, Bt, facades.map((f) => ({ image: f.glow.image })).concat([{ image: null }]));
    const m = {
      road: new T.MeshPhongMaterial({ map: asphalt.map, bumpMap: asphalt.bump, bumpScale: 0.6, vertexColors: true, shininess: 6, specular: 0x111111 }),
      paint: new T.MeshPhongMaterial({ map: TX.paintTexture(T), vertexColors: true, side: DS, shininess: 18, specular: 0x222222, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
      struct: atlasify(new T.MeshLambertMaterial({ map: S.tex, vertexColors: true, side: DS })),
      concrete: new T.MeshLambertMaterial({ vertexColors: true, side: DS }), // compat. events.js
      metal: new T.MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: 0x444444, side: DS }),
      lamp: new T.MeshBasicMaterial({ color: 0x3a3f45 }),
      lampGlow: new T.PointsMaterial({ map: TX.glowTexture(T, '255,226,190'), size: 5.5, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
      tunnelLight: new T.MeshBasicMaterial({ color: 0xffdfa0 }),
      pool: new T.MeshBasicMaterial({ map: TX.glowTexture(T, '255,214,160'), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
      tpool: new T.MeshBasicMaterial({ map: TX.glowTexture(T, '255,236,200'), transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
      water: new T.MeshPhongMaterial({ color: 0x35505e, shininess: 90, specular: 0x7799aa, side: DS }),
      bld: atlasify(new T.MeshLambertMaterial({ map: Bt.tex, emissiveMap: glow, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, side: DS })),
      trunk: new T.MeshLambertMaterial({ color: 0x5b4a3a }),
      canopy: new T.MeshLambertMaterial({ color: 0xffffff, map: TX.leavesTexture(T) }),
      dark: new T.MeshBasicMaterial({ color: 0x0c0e11 }),
    };
    m.tiles = S.tiles;
    m.btiles = Bt.tiles;
    m.buildings = [m.bld];
    m.signCache = new Map();
    return m;
  }
  signMat(tex) {
    if (!this.mats.signCache.has(tex)) {
      this.mats.signCache.set(tex, new this.T.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.32, transparent: false, alphaTest: 0.5, side: this.T.FrontSide }));
    }
    return this.mats.signCache.get(tex);
  }
  ambienceHooks() {
    return {
      roadMat: this.mats.road, buildingMats: this.mats.buildings,
      lampMat: this.mats.lamp, tunnelLightMat: this.mats.tunnelLight, lampGlowMat: this.mats.lampGlow,
    };
  }

  // ---------- plan des équipements le long de l'anneau ----------
  planFeatures() {
    const t = this.track, L = t.length, F = [];
    const exits = t.exits.slice().sort((a, b) => a.s - b.s);
    const isFree = (s, r = 40) => !t.coverAt(s - r) && !t.coverAt(s) && !t.coverAt(s + r);
    const inCover = (s) => t.coverAt(s);
    const roundD = (d) => (d < 260 ? Math.round(d / 50) * 50 : Math.round(d / 100) * 100);
    const porteOf = (x) => (x.dests.find((d) => /^Porte/.test(d[0])) || x.dests.find((d) => d[1] === 'white') || x.dests[0]);
    exits.forEach((x, i) => {
      const prev = exits[(i - 1 + exits.length) % exits.length];
      const next = exits[(i + 1) % exits.length];
      const gapPrev = wrap(x.s - prev.s, L);
      // 1. présignalisation (« 600 m » en général), sur la tête du pont de la porte précédente si possible
      const dPre = Math.min(600, Math.floor((gapPrev * 0.8) / 100) * 100);
      if (dPre >= 200) {
        const cov = t.covers.find((c) => { const d = wrap(x.s - c.s0, L); return d > 180 && d < dPre + 160 && d > dPre - 280; });
        if (cov) F.push({ type: 'bridgeSign', s: wrap(cov.s0 - 0.55, L), lines: exitLines(x.dests, roundD(wrap(x.s - cov.s0, L)) + ' m') });
        else {
          let sp = x.s - dPre;
          for (let k = 0; k < 10 && (inCover(sp) || inCover(sp - 15) || inCover(sp + 15)); k++) sp -= 25;
          F.push({ type: 'gantry', s: wrap(sp, L), cols: [{ lines: exitLines(x.dests, roundD(wrap(x.s - sp, L)) + ' m'), right: true }] });
        }
      }
      // 2. portique ~100 m avant : à gauche la sortie suivante (suite du périphérique), à droite cette sortie
      let sg = x.s - 105;
      const cv = inCover(sg) || inCover(sg - 12) || inCover(sg + 12);
      const thru = exitLines(next.dests, null).filter((l) => l.kind !== 'ref');
      if (cv && wrap(x.s - cv.s0, L) > 40 && wrap(x.s - cv.s0, L) < 320) {
        F.push({ type: 'bridgeSign', s: wrap(cv.s0 - 0.55, L), lines: exitLines(x.dests, roundD(wrap(x.s - cv.s0, L)) + ' m'), thru });
      } else {
        for (let k = 0; k < 8 && (inCover(sg) || inCover(sg - 12) || inCover(sg + 12)); k++) sg += 12;
        if (!inCover(sg) && wrap(x.s - sg, L) > 25 && wrap(x.s - sg, L) < 300) {
          F.push({ type: 'gantry', s: wrap(sg, L), cols: [{ lines: thru, left: true }, { lines: exitLines(x.dests, roundD(wrap(x.s - sg, L)) + ' m'), right: true }] });
        }
      }
      // 3. musoir : rappel du nom de la porte
      F.push({ type: 'gore', s: wrap(x.s + 62, L), lines: [{ kind: 'porte', name: porteOf(x)[0] }] });
    });
    // après chaque entrée : rappel 50 (droite + séparateur)
    for (const e of t.entries) F.push({ type: 'limit', s: wrap(e.s + 140, L) });
    for (let s = 500; s < L; s += 1000) if (isFree(s, 5)) F.push({ type: 'limit', s, median: true });
    // PMV tous les ~2,9 km hors couvertures/bretelles
    for (let s = 2400; s < L - 500; s += 2900) {
      let sp = s;
      for (let k = 0; k < 12 && (!isFree(sp, 30) || this.ramps.at(sp, 0).length); k++) sp += 40;
      F.push({ type: 'pmv', s: sp });
    }
    // voie réservée covoiturage : potences à losange tous les 1 600 m
    for (let s = 900; s < L; s += 1600) if (isFree(s, 10)) F.push({ type: 'hov', s });
    // radars fixes
    // radars fixes (cabines grises et tourelles) annoncés ~250 m avant
    [1850, 4550, 8300, 12950, 16450, 20250, 23950, 27300, 30900, 33650].forEach((s0, i) => {
      let s = s0 * t.kOSM;
      for (let k = 0; k < 10 && (!isFree(s, 30) || this.ramps.at(s, 0).length); k++) s += 35;
      F.push({ type: 'radar', s, tower: i % 2 === 1 });
      F.push({ type: 'radarSign', s: wrap(s - 240, L) });
    });
    // bornes d'appel d'urgence tous les 500 m, plaques PR tous les 200 m
    for (let s = 250; s < L; s += 500) F.push({ type: 'sos', s });
    for (let s = 0; s < L; s += 500) F.push({ type: 'pr', s: wrap(t.prOrigin + s, L), km: (s / 1000).toFixed(1).replace('.', ',') });
    F.sort((a, b) => a.s - b.s);
    return F;
  }

  // ---------- streaming ----------
  chunkIndex(s) { return Math.floor(wrap(s, this.track.length) / CFG.CHUNK_LEN); }
  chunkCount() { return Math.ceil(this.track.length / CFG.CHUNK_LEN); }

  update(playerS) {
    this.tick();
    const n = this.chunkCount();
    const cur = this.chunkIndex(playerS);
    const want = new Set();
    for (let i = -CFG.CHUNKS_BEHIND; i <= CFG.CHUNKS_AHEAD; i++) want.add(((cur + i) % n + n) % n);
    for (const [idx, chunk] of this.chunks) {
      if (!want.has(idx)) {
        this.scene.remove(chunk.group);
        chunk.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
        for (const g of chunk.geoms) g.dispose();
        this.chunks.delete(idx);
      }
    }
    // construire d'abord les segments les plus proches, au plus 1 par frame
    for (let i = 0; i <= CFG.CHUNKS_AHEAD; i++) {
      const idx = ((cur + i) % n + n) % n;
      if (!this.chunks.has(idx)) { this.buildChunk(idx); return; }
    }
    for (let i = 1; i <= CFG.CHUNKS_BEHIND; i++) {
      const idx = ((cur - i) % n + n) % n;
      if (!this.chunks.has(idx)) { this.buildChunk(idx); return; }
    }
    this.updateVMS(playerS);
  }

  // halos au sol : suivent l'allumage des candélabres (piloté par l'ambiance)
  tick() {
    this.mats.pool.opacity = this.mats.lampGlow.opacity * 0.85;
    // la tour Eiffel s'illumine (doré) la nuit
    if (this.landmarks && this.landmarks.eiffelMat) this.landmarks.eiffelMat.emissiveIntensity = this.mats.lampGlow.opacity * 4.5;
  }

  prebuild(playerS) {
    const n = this.chunkCount();
    const cur = this.chunkIndex(playerS);
    for (let i = -CFG.CHUNKS_BEHIND; i <= CFG.CHUNKS_AHEAD; i++) {
      const idx = ((cur + i) % n + n) % n;
      if (!this.chunks.has(idx)) this.buildChunk(idx);
    }
    this.updateVMS(playerS, true);
  }

  // ---------- rangées d'échantillonnage du segment ----------
  makeRows(s0, len) {
    const t = this.track, rows = [];
    const nr = Math.round(len / ROW);
    for (let i = 0; i <= nr; i++) {
      const s = s0 + (i * len) / nr;
      const p = {};
      t.pointAt(s, p);
      const r = { s, x: p.x, z: p.z, rx: p.rx, rz: p.rz, tx: p.tx, tz: p.tz, h: p.y };
      r.Em = t.mainEdgeAt(s);
      r.cover = !!t.coverAt(s);
      r.viaduct = !!t.onViaduct(s) && r.h > 2;
      r.seine = !!t.onBridge(s);
      r.ramps = this.ramps.at(s, r.h);
      let outer = r.Em, outerH = r.h;
      for (const o of r.ramps) { if (r.Em + o.gap + o.w >= outer) { outer = r.Em + o.gap + o.w; outerH = o.hr; } }
      r.R = outer; r.RH = outerH;          // bord extérieur droit (sens intérieur)
      r.Lft = r.Em; r.LH = r.h;            // sens extérieur (miroir, sans bretelles)
      rows.push(r);
    }
    return rows;
  }

  // ============================================================
  buildChunk(idx) {
    const T = this.T, track = this.track, M = this.mats;
    const s0 = idx * CFG.CHUNK_LEN;
    const len = Math.min(CFG.CHUNK_LEN, track.length - s0);
    const rand = rng(idx * 7919 + 13);
    const group = new T.Group();
    const geoms = [];
    const rows = this.makeRows(s0, len);
    const S = new Batch(true), tl = this.mats.tiles;
    const stoneZone = (s0 > 2700 && s0 < 4300) || ((idx * 2654435761 >>> 0) % 9 === 0);
    const wallTile = stoneZone ? tl.stone : tl['wall' + ((idx * 2654435761 >>> 0) % 3)];
    const B = {
      road: new Batch(), paint: new Batch(), metal: new Batch(), lamp: new Batch(), tlight: new Batch(), water: new Batch(),
      pool: new Batch(), tpool: new Batch(),
      S, wall: new TileView(S, wallTile), gba: new TileView(S, tl.gba), noise: new TileView(S, tl['noise' + [4, 4, 4, 0, 1, 2, 3, 5, 5][((((idx / 3) | 0) * 2654435761) >>> 0) % 9]]),
      grass: new TileView(S, tl.grass), ivy: new TileView(S, tl.ivy), ground: new TileView(S, tl.ground),
      tiles: new TileView(S, tl.tiles),
    };
    const Bb = new Batch(true), bt = this.mats.btiles;
    B.bld = Bb;
    B.fac = [0, 1, 2, 3, 4, 5, 6].map((i) => new TileView(Bb, bt['f' + i]));
    B.roof = new TileView(Bb, bt.roof);
    const glow = [];
    const ctx = { s0, len, rows, B, glow, rand, group, geoms, idx };

    this.buildRoad(ctx);
    this.buildPaint(ctx);
    this.buildMedian(ctx);
    for (const side of [1, -1]) this.buildSide(ctx, side);
    this.buildRampStructures(ctx);
    this.buildCovers(ctx);
    this.buildViaductUnderside(ctx);
    this.buildLighting(ctx);
    this.buildFeatures(ctx);
    this.buildWater(ctx);
    this.buildTrees(ctx);

    // bâtiments réels
    this.scenery.buildChunk(idx, 21, B.fac, B.roof);
    // silhouette lointaine (au-delà des données)
    this.buildFarSkyline(ctx);

    this.addMesh(ctx, B.road, M.road, false, true);
    this.addMesh(ctx, B.paint, M.paint, false, false);
    this.addMesh(ctx, B.S, M.struct, true, true);
    this.addMesh(ctx, B.bld, M.bld, true, true);
    this.addMesh(ctx, B.metal, M.metal, true, false);
    this.addMesh(ctx, B.lamp, M.lamp, false, false);
    this.flushSigns(ctx);
    this.addMesh(ctx, B.tlight, M.tunnelLight, false, false);
    this.addMesh(ctx, B.water, M.water, false, true);
    for (const [b, m] of [[B.pool, M.pool], [B.tpool, M.tpool]]) { const pm = this.addMesh(ctx, b, m, false, false); if (pm) pm.renderOrder = 2; }
    if (glow.length) {
      const gg = new T.BufferGeometry();
      gg.setAttribute('position', new T.Float32BufferAttribute(glow, 3));
      const pts = new T.Points(gg, M.lampGlow);
      pts.frustumCulled = false;
      group.add(pts);
      geoms.push(gg);
    }
    this.scene.add(group);
    this.chunks.set(idx, { group, geoms });
  }

  addMesh(ctx, batch, mat, cast, receive = true) {
    const g = batch.build(this.T);
    if (!g) return null;
    const mesh = new this.T.Mesh(g, mat);
    mesh.castShadow = !!cast;
    mesh.receiveShadow = !!receive;
    ctx.group.add(mesh);
    ctx.geoms.push(g);
    return mesh;
  }

  // ---------- chaussée (2 sens + bretelles) avec traces de roulement ----------
  buildRoad(ctx) {
    const { rows, B } = ctx;
    const base = rgb(0xffffff);
    // colonnes latérales (relatives au bord) avec assombrissement des bandes de roulement
    const colsFor = (E) => {
      const c = [[-MED - 0.05, 0.92]];
      const n = Math.max(2, Math.round((E - CFG.INNER_EDGE) / LW));
      c.push([CFG.INNER_EDGE - 0.2, 0.95]);
      for (let l = 0; l < n; l++) {
        const x0 = CFG.INNER_EDGE + l * LW;
        c.push([x0 + 0.55, 0.9], [x0 + 0.95, 0.8], [x0 + 1.75, 0.93], [x0 + 2.55, 0.8], [x0 + 2.95, 0.9]);
      }
      return c;
    };
    const cols = colsFor(4 * LW + CFG.INNER_EDGE);
    for (const side of [1, -1]) {
      // grille régulière : colonnes fixes rabattues sur le bord réel de la rangée
      let prev = null;
      for (const r of rows) {
        const E = side > 0 ? r.Em : r.Lft;
        const ids = [];
        const pts = cols.map(([x, k]) => (x < E - 0.25 ? [x, k] : [E, 0.97]));
        pts.push([E, 0.97], [E + (r.viaduct ? 1.0 : 1.3), 0.86]);
        for (const [x, k] of pts) {
          const lat = side * x;
          const p = P(r, lat, r.h);
          ids.push(B.road.v(p[0], p[1], p[2], lat / 8, r.s / 8, shade(base, k)));
        }
        if (prev) for (let k = 0; k < ids.length - 1; k++) {
          if (side > 0) B.road.quad(prev[k], prev[k + 1], ids[k + 1], ids[k]);
          else B.road.quad(prev[k + 1], prev[k], ids[k], ids[k + 1]);
        }
        prev = ids;
      }
    }
    // bretelles (côté droit)
    for (const slot of [0, 1]) {
      band(B.road, rows,
        (r) => { const o = r.ramps[slot]; return o ? [r.Em + o.gap - (o.parallel ? 0.3 : 0.6), o.hr, shade(base, 0.92)] : null; },
        (r) => { const o = r.ramps[slot]; return o ? [r.Em + o.gap + o.w + 0.6, o.hr, shade(base, 0.86)] : null; },
        base, 8, 8);
    }
    // patch de raccord sous les zones parallèles (évite les jours entre chaussée et voie)
  }

  // ---------- marquage au sol ----------
  paintLine(B, s0, s1, lat0, lat1, yOff = 0.015, hFn = null, col = null) {
    const t = this.track, p = this._p;
    const n = Math.max(1, Math.ceil((s1 - s0) / 2.5));
    let prev = null;
    const white = col || [1, 1, 1];
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      t.pointAt(s, p);
      const la = typeof lat0 === 'function' ? lat0(s) : lat0;
      const lb = typeof lat1 === 'function' ? lat1(s) : lat1;
      const y = (hFn ? hFn(s) : p.y) + yOff;
      const a = B.v(p.x + p.rx * la, y, p.z + p.rz * la, 0, s / 3, white);
      const b = B.v(p.x + p.rx * lb, y, p.z + p.rz * lb, 1, s / 3, white);
      if (prev) B.quad(prev[0], prev[1], b, a);
      prev = [a, b];
    }
  }

  // fine bande sombre en travers de la chaussée (joint de dilatation)
  jointAt(B, d, lat0, lat1) {
    const t = this.track, p = this._p, dark = [0.17, 0.17, 0.19];
    const pts = [];
    for (const ds of [0, 0.2]) {
      t.pointAt(d + ds, p);
      pts.push([p.x + p.rx * lat0, p.y + 0.017, p.z + p.rz * lat0, p.x + p.rx * lat1, p.z + p.rz * lat1]);
    }
    const [a, b] = pts;
    B.quad(B.v(a[0], a[1], a[2], 0, 0, dark), B.v(a[3], a[1], a[4], 1, 0, dark), B.v(b[3], b[1], b[4], 1, 1, dark), B.v(b[0], b[1], b[2], 0, 1, dark));
  }

  buildPaint(ctx) {
    const { s0, len, rows, B } = ctx;
    const t = this.track, P2 = B.paint;
    const s1 = s0 + len;
    for (const side of [1, -1]) {
      const sg = side;
      // ligne de rive gauche (côté DBA), continue
      this.paintLine(P2, s0, s1, sg * (CFG.INNER_EDGE - 0.1), sg * (CFG.INNER_EDGE + 0.1));
      // lignes de séparation de voies : tirets 3 m / 10 m (T1)
      for (let k = 1; k < 4; k++) {
        const lat = CFG.INNER_EDGE + LW * k;
        for (let d = Math.ceil(s0 / 13) * 13; d < s1; d += 13) {
          const de = Math.min(d + 3, s1);
          if (t.laneWidthAt(d, (q) => t.lanesAt(q)) < k + 0.55) continue;
          this.paintLine(P2, d, de, sg * (lat - 0.075), sg * (lat + 0.075));
        }
      }
      // ligne de rive droite : continue, ou tiretée épaisse (T3) le long d'une voie parallèle
      const edge = (s) => t.mainEdgeAt(s);
      const hasPar = (s) => side > 0 && this.ramps.parallelWidth(s) > 0.5;
      for (let d = s0; d < s1; d += 4.5) {
        const de = Math.min(d + 4.5, s1);
        if (hasPar(d + 1)) {
          this.paintLine(P2, d, Math.min(d + 3, s1), (s) => sg * (edge(s) - 0.05), (s) => sg * (edge(s) + 0.3));
        } else {
          this.paintLine(P2, d, de, (s) => sg * (edge(s) - 0.2), (s) => sg * edge(s));
        }
      }
      // losanges de la voie réservée (voie de gauche, sens intérieur et extérieur)
      for (let d = Math.ceil(s0 / 150) * 150; d < s1 - 5; d += 150) {
        const c = CFG.INNER_EDGE + LW / 2;
        const half = (s) => 0.55 * (1 - Math.abs((s - d - 2.5) / 2.5));
        this.paintLine(P2, d, d + 5, (s) => sg * (c - half(s) - 0.08), (s) => sg * (c - half(s) + 0.08));
        this.paintLine(P2, d, d + 5, (s) => sg * (c + half(s) - 0.08), (s) => sg * (c + half(s) + 0.08));
      }
    }
    // flèches de sélection peintes dans la voie de droite avant chaque sortie (relevé Porte d'Orléans)
    for (const x of t.exits) {
      for (const dd of [210, 120]) {
        const d = x.s - dd;
        if (d < s0 || d + 5 > s1 || t.coverAt(d) || t.coverAt(d + 5)) continue;
        const c = (s) => t.mainEdgeAt(s) - LW / 2;
        const half = (s) => 0.55 * Math.max(0, 1 - (s - d - 3.2) / 1.8);
        this.paintLine(P2, d, d + 3.2, (s) => c(s) - 0.11, (s) => c(s) + 0.11, 0.016);
        this.paintLine(P2, d + 3.2, d + 5, (s) => c(s) - half(s), (s) => c(s) + half(s), 0.016);
      }
    }
    // joints de dilatation transversaux sur les ouvrages (viaducs, ponts)
    for (let d = Math.ceil(s0 / 42) * 42; d < s1; d += 42) {
      if (!(t.onViaduct(d) || t.onBridge(d))) continue;
      for (const sg of [1, -1]) {
        this.jointAt(P2, d, sg * CFG.INNER_EDGE, sg * t.mainEdgeAt(d));
      }
    }
    // bretelles : rives + zébras de musoir
    for (const r of rows) r._k = 0;
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      for (let slot = 0; slot < 2; slot++) {
        const oa = a.ramps[slot], ob = b.ramps[slot];
        if (!oa || !ob || oa.r !== ob.r) continue;
        const hf = (s) => lerp(oa.hr, ob.hr, (s - a.s) / (b.s - a.s));
        const outerA = (s) => lerp(a.Em + oa.gap + oa.w, b.Em + ob.gap + ob.w, (s - a.s) / (b.s - a.s));
        this.paintLine(P2, a.s, b.s, (s) => outerA(s) - 0.2, (s) => outerA(s), 0.015, hf);
        if (!oa.parallel && oa.gap > 0.35) {
          const innerA = (s) => lerp(a.Em + oa.gap, b.Em + ob.gap, (s - a.s) / (b.s - a.s));
          this.paintLine(P2, a.s, b.s, (s) => innerA(s), (s) => innerA(s) + 0.2, 0.015, hf);
          // zébras (bandes obliques) dans le musoir tant que l'écart < 4 m
          if (oa.gap < 4.2 && Math.abs(oa.hr - a.h) < 0.4) {
            const midL = a.Em + oa.gap * 0.5;
            this.paintLine(P2, a.s + 1, a.s + 2.2, midL - oa.gap * 0.45, midL + oa.gap * 0.45, 0.016);
          }
        }
      }
    }
  }

  // ---------- séparateur central : DBA + caniveau ----------
  buildMedian(ctx) {
    const { rows, B } = ctx;
    const c = rgb(0xd8d6cf), cd = rgb(0xb8b6ae);
    const prof = [[-MED, 0, cd], [-0.26, 0.08, c], [-0.1, 0.27, c], [-0.085, 0.82, c], [0.085, 0.82, c], [0.1, 0.27, c], [0.26, 0.08, c], [MED, 0, cd]];
    for (let k = 0; k < prof.length - 1; k++) {
      const a = prof[k], b = prof[k + 1];
      band(B.gba, rows, (r) => [a[0], r.h + a[1], a[2]], (r) => [b[0], r.h + b[1], b[2]], c, 4, 1);
    }
  }

  // ---------- un côté (sens intérieur à droite : side=+1) ----------
  buildSide(ctx, side) {
    const { rows, B, rand } = ctx;
    const t = this.track;
    const E = (r) => (side > 0 ? r.R : r.Lft);
    const H = (r) => (side > 0 ? r.RH : r.LH);
    const L = (v) => side * v;
    const trench = (r) => H(r) < -0.35 || r.cover;
    const via = (r) => r.viaduct && H(r) > 2;
    const emb = (r) => !trench(r) && !via(r) && H(r) > 0.35;
    const flat = (r) => !trench(r) && !via(r) && !emb(r);
    const gbaC = rgb(0xd2d0c8);

    // 1. dispositif de retenue : DBA simple en tranchée/couverture, glissière ailleurs
    const gbaProf = [[0.0, 0.0], [0.05, 0.08], [0.2, 0.25], [0.21, 0.82], [0.4, 0.82], [0.4, 0]];
    for (let k = 0; k < gbaProf.length - 1; k++) {
      const a = gbaProf[k], b = gbaProf[k + 1];
      band(B.gba, rows, (r) => (trench(r) ? [L(E(r) + 0.55 + a[0]), H(r) + a[1], gbaC] : null),
        (r) => (trench(r) ? [L(E(r) + 0.55 + b[0]), H(r) + b[1], gbaC] : null), gbaC, 4, 1);
    }
    // glissière métallique (lisse en W + poteaux)
    const steel = rgb(0xaeb3b8), steelD = rgb(0x7d8288);
    const gl = (r) => (flat(r) || emb(r));
    band(B.metal, rows, (r) => (gl(r) ? [L(E(r) + 0.75), H(r) + 0.48, steelD] : null), (r) => (gl(r) ? [L(E(r) + 0.7), H(r) + 0.6, steel] : null), steel, 4, 1);
    band(B.metal, rows, (r) => (gl(r) ? [L(E(r) + 0.7), H(r) + 0.6, steel] : null), (r) => (gl(r) ? [L(E(r) + 0.75), H(r) + 0.76, steelD] : null), steel, 4, 1);
    for (const r of rows) {
      if (!gl(r)) continue;
      boxAt(B.metal, r, L(E(r) + 0.85), H(r), 0.12, 0.72, 0.12, steelD);
    }

    // 2. mur de tranchée (béton tagué) jusqu'au niveau de la ville + couronnement
    const wallX = (r) => E(r) + 1.25;
    const topY = (r) => Math.max(H(r) + 0.95, 1.0 * smoothstep(0, -1.6, H(r)));
    const wallC = rgb(0xffffff);
    band(B.wall, rows, (r) => (trench(r) ? [L(wallX(r)), H(r), wallC] : null), (r) => (trench(r) ? [L(wallX(r)), topY(r), wallC] : null), wallC, 11, 7);
    // couronnement béton clair
    band(B.gba, rows, (r) => (trench(r) && !r.cover ? [L(wallX(r)), topY(r)] : null), (r) => (trench(r) && !r.cover ? [L(wallX(r) + 0.45), topY(r)] : null), gbaC, 4, 1);
    band(B.gba, rows, (r) => (trench(r) && !r.cover ? [L(wallX(r) + 0.45), topY(r)] : null), (r) => (trench(r) && !r.cover ? [L(wallX(r) + 0.45), Math.min(0, topY(r))] : null), gbaC, 4, 1);
    // lierre retombant en haut de certains murs
    const ivyOn = (r) => trench(r) && !r.cover && H(r) < -3 && ((Math.floor(r.s / 60) * 7 + (side > 0 ? 3 : 0)) % 5 < 2);
    band(B.ivy, rows, (r) => (ivyOn(r) ? [L(wallX(r) - 0.06), topY(r) - 0.1] : null), (r) => (ivyOn(r) ? [L(wallX(r) - 0.08), topY(r) - 1.6 - ((r.s * 13.7) % 1.3)] : null), rgb(0xffffff), 3, 3);
    // clôture grillagée en haut de tranchée
    const fenceOn = (r) => trench(r) && !r.cover && H(r) < -2;
    band(B.metal, rows, (r) => (fenceOn(r) ? [L(wallX(r) + 0.6), 0, rgb(0x4d5a52)] : null), (r) => (fenceOn(r) ? [L(wallX(r) + 0.6), 1.9, rgb(0x4d5a52)] : null), rgb(0x4d5a52), 3, 1);

    // 3. viaduc : parapet béton + garde-corps, corniche, écran transparent éventuel
    const parX = (r) => E(r) + 0.6;
    band(B.gba, rows, (r) => (via(r) ? [L(parX(r)), H(r)] : null), (r) => (via(r) ? [L(parX(r)), H(r) + 0.95] : null), gbaC, 4, 1);
    band(B.gba, rows, (r) => (via(r) ? [L(parX(r)), H(r) + 0.95] : null), (r) => (via(r) ? [L(parX(r) + 0.45), H(r) + 0.95] : null), gbaC, 4, 1);
    band(B.gba, rows, (r) => (via(r) ? [L(parX(r) + 0.45), H(r) + 0.95] : null), (r) => (via(r) ? [L(parX(r) + 0.45), H(r) - 1.7] : null), rgb(0xc6c3ba), 4, 2);
    band(B.metal, rows, (r) => (via(r) ? [L(parX(r) + 0.25), H(r) + 1.15, steel] : null), (r) => (via(r) ? [L(parX(r) + 0.25), H(r) + 1.22, steel] : null), steel, 4, 1);
    // garde-corps métallique complet : lisses haute et médiane + montants (relevé Porte Maillot)
    band(B.metal, rows, (r) => (via(r) ? [L(parX(r) + 0.25), H(r) + 1.5, steel] : null), (r) => (via(r) ? [L(parX(r) + 0.25), H(r) + 1.56, steel] : null), steel, 4, 1);
    band(B.metal, rows, (r) => (via(r) ? [L(parX(r) + 0.25), H(r) + 1.33, steelD] : null), (r) => (via(r) ? [L(parX(r) + 0.25), H(r) + 1.37, steelD] : null), steel, 4, 1);
    for (const r of rows) { if (via(r)) boxAt(B.metal, r, L(parX(r) + 0.25), H(r) + 0.95, 0.07, 0.62, 0.07, steelD); }

    // 4. talus enherbé
    band(B.grass, rows, (r) => (emb(r) ? [L(E(r) + 1.0), H(r)] : null), (r) => (emb(r) ? [L(E(r) + 1.0 + H(r) * 1.7), 0.02] : null), rgb(0xffffff), 6, 6);

    // 5. écrans antibruit (tronçons de 250 m, selon la densité bâtie riveraine)
    const noiseOn = (r) => {
      if (trench(r) || r.seine) return false;
      const blk = Math.floor(r.s / 250);
      const k = (blk * 2654435761 + (side > 0 ? 17 : 91)) >>> 0;
      return (k % 100) < (via(r) ? 45 : 60);
    };
    const nwX = (r) => (via(r) ? parX(r) + 0.2 : E(r) + 1.5);
    const nwY0 = (r) => (via(r) ? H(r) + 0.95 : H(r));
    const nwH = (r) => (via(r) ? 2.6 : 3.6);
    band(B.noise, rows, (r) => (noiseOn(r) ? [L(nwX(r)), nwY0(r)] : null), (r) => (noiseOn(r) ? [L(nwX(r)), nwY0(r) + nwH(r)] : null), rgb(0xffffff), 4, 4);

    // 5 bis. paroi de fond (terre) derrière les ouvrages en contrebas : aucun jour possible
    band(B.wall, rows, (r) => (r.h < -0.8 ? [L(E(r) + 1.75), Math.min(r.h, H(r)) - 0.3] : null), (r) => (r.h < -0.8 ? [L(E(r) + 1.75), -0.04] : null), rgb(0x8a857c), 11, 7);

    // 6. sol de la ville : grille colorée par l'occupation du sol réelle
    const offs = [0, 3, 8, 16, 28, 45, 70, 105, 150, 210, 290];
    const lu = this.scenery.landuse;
    const LUC = {
      wood: 0x4b6a3a, park: 0x6f9a4f, pitch: 0x7fae4a, cemetery: 0x8d9a7e, rail: 0x7d6e5f,
      urban: 0x8f8c86, water: 0x2f4552, null: 0x9a978f,
    };
    let prev = null;
    for (const r of rows) {
      let x0, y0;
      if (trench(r)) { x0 = wallX(r) + 0.45; y0 = Math.min(0, topY(r)); }
      else if (via(r)) { x0 = 0; y0 = 0; }
      else if (emb(r)) { x0 = E(r) + 1.0 + H(r) * 1.7; y0 = 0.02; }
      else { x0 = E(r) + 1.05; y0 = Math.min(H(r), 0.02); }
      const ids = [];
      for (let k = 0; k < offs.length; k++) {
        const lat = L(x0 + offs[k]);
        const p = P(r, lat, y0);
        let kind = k === 0 ? null : lu.at(p[0], p[2]);
        let y = k === 0 ? y0 : 0;
        if (kind === 'water') y = -3.6;
        const col = rgb(LUC[kind] ?? LUC.null);
        const jitter = 0.9 + ((Math.sin(p[0] * 0.13) + Math.cos(p[2] * 0.11)) * 0.05);
        ids.push(B.ground.v(p[0], y, p[2], p[0] / 12, p[2] / 12, shade(col, jitter)));
      }
      if (prev) for (let k = 0; k < ids.length - 1; k++) B.ground.quad(prev[k], prev[k + 1], ids[k + 1], ids[k]);
      prev = ids;
    }
  }

  // ---------- bretelles : séparations et murs entre chaussée et bretelle ----------
  buildRampStructures(ctx) {
    const { rows, B } = ctx;
    const gbaC = rgb(0xd2d0c8);
    for (let slot = 0; slot < 2; slot++) {
      const o = (r) => r.ramps[slot];
      const sep = (r) => { const q = o(r); return q && !q.parallel && q.gap > 1.3 ? q : null; };
      // muret / mur de soutènement entre la chaussée principale et la bretelle
      band(B.gba, rows,
        (r) => { const q = sep(r); return q ? [r.Em + q.gap * 0.5, Math.min(r.h, q.hr)] : null; },
        (r) => { const q = sep(r); return q ? [r.Em + q.gap * 0.5, Math.max(r.h, q.hr) + 0.85] : null; },
        gbaC, 4, 2);
      // fond de l'interstice côté bas (accotement jusqu'au mur)
      band(B.road, rows,
        (r) => { const q = sep(r); if (!q) return null; return q.hr >= r.h ? [r.Em + 0.5, r.h] : [r.Em + q.gap * 0.5, q.hr]; },
        (r) => { const q = sep(r); if (!q) return null; return q.hr >= r.h ? [r.Em + q.gap * 0.5, r.h] : [r.Em + q.gap - 0.5, q.hr]; },
        rgb(0xb8b8b8), 8, 8);
      // remblai/dalle couvrant l'interstice du côté le plus haut
      band(B.grass, rows,
        (r) => { const q = sep(r); return q && Math.abs(q.hr - r.h) > 0.6 ? [q.hr > r.h ? r.Em + q.gap * 0.5 : r.Em + 0.9, Math.max(q.hr, r.h)] : null; },
        (r) => { const q = sep(r); return q && Math.abs(q.hr - r.h) > 0.6 ? [q.hr > r.h ? r.Em + q.gap - 0.4 : r.Em + q.gap * 0.5, Math.max(q.hr, r.h)] : null; },
        rgb(0xffffff), 6, 6);
      // mur de la tranchée principale masqué par la bretelle : mur entre chaussée et bretelle haute
      band(B.wall, rows,
        (r) => { const q = sep(r); return q && q.hr - r.h > 0.6 ? [r.Em + q.gap * 0.5 - 0.02, r.h] : null; },
        (r) => { const q = sep(r); return q && q.hr - r.h > 0.6 ? [r.Em + q.gap * 0.5 - 0.02, q.hr] : null; },
        rgb(0xffffff), 6, 6);
    }
    // musoir : atténuateur de choc jaune/noir au point de divergence
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      for (const q of r.ramps) {
        if (q.parallel || q.gap < 1.3 || q.gap > 2.2 || q._n) continue;
        const prevR = rows[i - 1];
        if (prevR && prevR.ramps.some((x) => x.r === q.r && x.gap >= 1.3)) continue;
        q._n = true;
        boxAt(B.metal, r, r.Em + q.gap * 0.5, Math.min(r.h, q.hr), 0.9, 0.9, 2.2, rgb(0xf2c200));
        boxAt(B.metal, r, r.Em + q.gap * 0.5, Math.min(r.h, q.hr) + 0.9, 0.92, 0.12, 2.3, rgb(0x1a1a1a));
      }
    }
  }

  // ---------- couvertures (porte, bois) : plafond, parois, têtes ----------
  buildCovers(ctx) {
    const { rows, B, s0, len } = ctx;
    const t = this.track;
    const lightC = rgb(0xffffff);
    const ceilC = shade(rgb(0x6a6660), 1.3);
    const cov = (r) => r.cover;
    // plafond (béton sombre encrassé)
    band(B.gba, rows, (r) => (cov(r) ? [-(r.Lft + 1.25), r.h + CEIL] : null), (r) => (cov(r) ? [r.R + 1.25, r.h + CEIL] : null), ceilC, 4, 4);
    // dalle supérieure (place / boulevard de la porte, niveau ville)
    band(B.ground, rows, (r) => (cov(r) ? [-(r.Lft + 1.8), 0.08] : null), (r) => (cov(r) ? [r.R + 1.8, 0.08] : null), rgb(0x8a877f), 10, 10);
    // revêtement clair des parois (bandeau à hauteur des yeux)
    for (const side of [1, -1]) {
      const E = (r) => (side > 0 ? r.R : r.Lft);
      band(B.tiles, rows, (r) => (cov(r) ? [side * (E(r) + 1.2), r.h + 0.02] : null), (r) => (cov(r) ? [side * (E(r) + 1.2), r.h + CEIL] : null), shade(rgb(0xffffff), 1.45), 3, 3);
    }
    // rampes lumineuses + piles centrales + signaux d'affectation
    const p = this._p;
    for (let d = Math.ceil(s0 / 6) * 6; d < s0 + len; d += 6) {
      if (!t.coverAt(d)) continue;
      t.pointAt(d, p);
      const r = { x: p.x, z: p.z, rx: p.rx, rz: p.rz, tx: p.tx, tz: p.tz, h: p.y, s: d };
      for (const lat of [-6.2, -2.4, 2.4, 6.2]) boxAt(B.tlight, r, lat, p.y + CEIL - 0.12, 0.35, 0.08, 3.6, lightC);
      if (Math.round(d) % 12 < 6) for (const lat of [-6.5, 6.5]) this.groundQuad(B.tpool, r, lat, p.y + 0.04, 13, 13);
      if (Math.round(d) % 12 < 6) boxAt(B.gba, r, 0, p.y, 0.5, CEIL, 0.5, rgb(0xcfcbc2)); // poteaux sur TPC
      if (Math.round(d) % 120 < 6) {
        for (let l = 0; l < t.lanesAt(d); l++) {
          for (const side of [1, -1]) this.addSign(ctx, d, side * (CFG.INNER_EDGE + LW * (l + 0.5)), p.y + CEIL - 0.75, laneSignalTexture(this.T, true), 0.62, 0.62, side < 0);
        }
      }
    }
    // têtes de couverture : façade béton + corniche
    for (const c of t.covers) {
      for (const end of [c.s0, c.s1]) {
        const d = wrap(end - s0, t.length);
        if (d >= len) continue;
        t.pointAt(end, p);
        const r = { x: p.x, z: p.z, rx: p.rx, rz: p.rz, tx: p.tx, tz: p.tz, h: p.y, s: end };
        const E = t.edgeAt(end) + 2.5, W2 = E * 2 + 2;
        // tête de pont : rive de tablier en béton jusqu'au niveau de la ville
        const deckTop = Math.max(p.y + CEIL + 1.3, 0.25);
        boxAt(B.gba, r, 0, p.y + CEIL, W2, deckTop - p.y - CEIL, 0.9, rgb(0xc9c5bc), 3);
        boxAt(B.gba, r, 0, p.y + CEIL - 0.25, W2, 0.25, 1.0, rgb(0x9d998f), 3);   // larmier
        boxAt(B.gba, r, 0, deckTop, W2, 0.3, 0.45, rgb(0xb9b5ac), 3);              // bordure
        // garde-corps métallique à barreaudage (cf. ponts des portes)
        const rail = rgb(0x9aa0a4), yb = deckTop + 0.3;
        boxAt(B.metal, r, 0, yb + 1.0, W2, 0.07, 0.09, rail);
        boxAt(B.metal, r, 0, yb + 0.12, W2, 0.05, 0.06, rail);
        for (let x = -W2 / 2 + 0.6; x < W2 / 2; x += 0.6) boxAt(B.metal, r, x, yb, x % 3 < 0.6 ? 0.08 : 0.025, 1.02, 0.025, rail);
      }
    }
  }

  // ---------- dessous des viaducs : tablier + piles ----------
  buildViaductUnderside(ctx) {
    const { rows, B } = ctx;
    const via = (r) => r.viaduct;
    band(B.gba, rows, (r) => (via(r) ? [-(r.Lft + 1.05), r.h - 1.7] : null), (r) => (via(r) ? [r.R + 1.05, r.h - 1.7] : null), rgb(0x8f8c85), 4, 4);
    for (const r of rows) {
      if (!via(r) || Math.round(r.s) % 30 >= ROW) continue;
      if (r.h - 1.7 < 1.2) continue;
      for (const lat of [-(r.Lft * 0.55), r.R * 0.55]) boxAt(B.gba, r, lat, 0, 1.4, r.h - 1.7, 3.2, rgb(0xbdb9b0), 2);
      boxAt(B.gba, r, 0, r.h - 2.6, r.Lft + r.R, 0.9, 2.4, rgb(0xaeaaa1), 2); // chevêtre
    }
  }

  // ---------- éclairage : candélabres doubles sur le séparateur ----------
  buildLighting(ctx) {
    const { s0, len, B, glow } = ctx;
    const t = this.track, p = this._p;
    const mastC = rgb(0x7b8086);
    for (let d = Math.ceil(s0 / 34) * 34 + 7; d < s0 + len; d += 34) {
      if (t.coverAt(d)) continue;
      t.pointAt(d, p);
      const r = { x: p.x, z: p.z, rx: p.rx, rz: p.rz, tx: p.tx, tz: p.tz, h: p.y, s: d };
      cylinder(B.metal, p.x, p.y + 0.82, p.z, 0.13, 0.08, 11.2, 7, mastC);
      for (const side of [-1, 1]) {
        // crosse inclinée
        boxAt(B.metal, r, side * 1.25, p.y + 11.6, 2.5, 0.09, 0.09, mastC);
        boxAt(B.lamp, r, side * 2.55, p.y + 11.45, 0.75, 0.16, 0.36, [1, 1, 1]);
        glow.push(p.x + p.rx * side * 2.55, p.y + 11.3, p.z + p.rz * side * 2.55);
        this.groundQuad(B.pool, r, side * 6.5, p.y + 0.04, 15, 26);
      }
    }
    // candélabres simples en rive (bras en console au-dessus des voies de droite), hors tranchée
    for (let d = Math.ceil((s0 - 17) / 68) * 68 + 17; d < s0 + len; d += 68) {
      if (d < s0 || t.coverAt(d)) continue;
      t.pointAt(d, p);
      const r = { x: p.x, z: p.z, rx: p.rx, rz: p.rz, tx: p.tx, tz: p.tz, h: p.y, s: d };
      for (const side of [1, -1]) {
        const E = (side > 0 ? t.mainEdgeAt(d) + this.ramps.parallelWidth(d, p.y) : t.mainEdgeAt(d)) + 1.15;
        if (p.y < -0.5 || (t.onViaduct(d) && p.y > 2 && side < 0 && false)) continue;
        const bx = p.x + p.rx * side * E, bz = p.z + p.rz * side * E;
        cylinder(B.metal, bx, p.y, bz, 0.12, 0.07, 10.2, 6, mastC);
        boxAt(B.metal, r, side * (E - 1.1), p.y + 10.1, 2.3, 0.08, 0.08, mastC);
        boxAt(B.lamp, r, side * (E - 2.25), p.y + 9.95, 0.7, 0.15, 0.32, [1, 1, 1]);
        glow.push(p.x + p.rx * side * (E - 2.25), p.y + 9.8, p.z + p.rz * side * (E - 2.25));
        this.groundQuad(B.pool, r, side * (E - 4), p.y + 0.04, 12, 22);
      }
    }
  }

  // quad horizontal (halo lumineux au sol) centré sur (lat), w = largeur, l = longueur
  groundQuad(B, r, lat, y, w, l) {
    const c = [1, 1, 1], cx = r.x + r.rx * lat, cz = r.z + r.rz * lat;
    const ax = r.rx * w / 2, az = r.rz * w / 2, tx = r.tx * l / 2, tz = r.tz * l / 2;
    const a = B.v(cx - ax - tx, y, cz - az - tz, 0, 0, c), b = B.v(cx + ax - tx, y, cz + az - tz, 1, 0, c);
    const d = B.v(cx + ax + tx, y, cz + az + tz, 1, 1, c), e = B.v(cx - ax + tx, y, cz - az + tz, 0, 1, c);
    B.quad(a, b, d, e);
  }

  // ---------- eau (Seine, canaux) ----------
  buildWater(ctx) {
    const { rows, B } = ctx;
    const mid = rows[(rows.length / 2) | 0];
    for (const l of this.scenery.landuse.lines) {
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [ax, az] = l.pts[i], [bx, bz] = l.pts[i + 1];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const tt = clamp(((mid.x - ax) * dx + (mid.z - az) * dz) / L2, 0, 1);
        if (Math.hypot(ax + dx * tt - mid.x, az + dz * tt - mid.z) > 260) continue;
        const Ls = Math.sqrt(L2), nx = -dz / Ls, nz = dx / Ls, w = l.w / 2 + 6;
        const c = [1, 1, 1];
        const q = [B.water.v(ax + nx * w, -3.0, az + nz * w, 0, 0, c), B.water.v(bx + nx * w, -3.0, bz + nz * w, 1, 0, c), B.water.v(bx - nx * w, -3.0, bz - nz * w, 1, 1, c), B.water.v(ax - nx * w, -3.0, az - nz * w, 0, 1, c)];
        B.water.quad(q[0], q[1], q[2], q[3]);
        // quais
        for (const sgn of [1, -1]) {
          const ww = l.w / 2;
          const a0 = [ax + nx * ww * sgn, az + nz * ww * sgn], b0 = [bx + nx * ww * sgn, bz + nz * ww * sgn];
          const qc = rgb(0xb8ad98);
          B.gba.quad(B.gba.v(a0[0], -3.2, a0[1], 0, 0, qc), B.gba.v(b0[0], -3.2, b0[1], Ls / 4, 0, qc), B.gba.v(b0[0], 0.05, b0[1], Ls / 4, 1, qc), B.gba.v(a0[0], 0.05, a0[1], 0, 1, qc));
        }
      }
    }
  }

  // ---------- arbres (instanciés) : bois, parcs, hauts de talus ----------
  buildTrees(ctx) {
    const { rows, rand, group } = ctx;
    const T = this.T, t = this.track, lu = this.scenery.landuse;
    if (!this._treeGeo) this._treeGeo = makeTreeGeometry(T);
    if (!this._treeTrunk) this._treeTrunk = new T.CylinderGeometry(0.14, 0.22, 3.4, 5).translate(0, 1.7, 0);
    const spots = [];
    const pushSpot = (x, y, z, sc, bush = 0) => { if (spots.length < 150) spots.push([x, y, z, sc, bush]); };
    for (const r of rows) {
      for (const side of [1, -1]) {
        const E = side > 0 ? r.R : r.Lft, H = side > 0 ? r.RH : r.LH;
        // haut de tranchée / pied de talus : alignement dense (végétation du périph)
        if (rand() < 0.42) {
          const base = H < -0.35 ? E + 2.6 : H > 0.35 && !r.viaduct ? E + 1.6 + H * (0.4 + rand() * 1.1) : E + 3.2;
          const y = H < -0.35 ? 0 : H > 0.35 && !r.viaduct ? Math.max(0, H - (base - E - 1) / 1.7) : 0;
          if (!r.cover) { const p = P(r, side * (base + rand() * 3), y); pushSpot(p[0], p[1], p[2], 0.8 + rand() * 0.6); }
        }
        // broussailles et arbustes sur les talus et au pied des murs (relevé Châtillon / Brancion)
        if (!r.cover && !r.viaduct && H > -0.35 && rand() < 0.55) {
          const bx = E + 1.5 + rand() * 2.8 + (H > 0.35 ? H * 1.2 : 0);
          const p2 = P(r, side * bx, H > 0.35 ? Math.max(0, H - (bx - E - 1) / 1.7) : 0);
          pushSpot(p2[0], p2[1], p2[2], 0.28 + rand() * 0.34, 1);
        }
        // bois et parcs réels plus loin
        for (const off of [18, 34, 55, 80]) {
          if (rand() > 0.5) continue;
          const lat = side * (E + off + rand() * 12);
          const p = P(r, lat, 0);
          const k = lu.at(p[0], p[2]);
          const wood = t.woodAt(r.s);
          if (k === 'wood' || (wood && off < 60 && rand() < 0.8) || (k === 'park' && rand() < 0.6) || (k === 'cemetery' && rand() < 0.4)) pushSpot(p[0], 0, p[2], 0.9 + rand() * 0.8);
        }
      }
    }
    if (!spots.length) return;
    const trunks = new T.InstancedMesh(this._treeTrunk, this.mats.trunk, spots.length);
    const crowns = new T.InstancedMesh(this._treeGeo, this.mats.canopy, spots.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(), col = new T.Color(), up = new T.Vector3(0, 1, 0);
    spots.forEach(([x, y, z, s, bush], i) => {
      q.setFromAxisAngle(up, rand() * 6.28);
      const kind = bush ? 2 : rand(); // 70 % platanes/érables, 18 % peupliers élancés, 12 % arbres roussis
      const slim = kind > 0.7 && kind < 0.88;
      m4.compose(v.set(x, y, z), q, bush ? sc.set(s * 1.3, s * 0.75, s * 1.3) : slim ? sc.set(s * 0.62, s * (1.5 + rand() * 0.4), s * 0.62) : sc.set(s, s * (0.9 + rand() * 0.3), s));
      trunks.setMatrixAt(i, m4);
      crowns.setMatrixAt(i, m4);
      if (bush) col.setHSL(0.2 + rand() * 0.08, 0.3 + rand() * 0.2, 0.42 + rand() * 0.15);
      else if (kind >= 0.88) col.setHSL(0.07 + rand() * 0.06, 0.55 + rand() * 0.2, 0.55 + rand() * 0.12);
      else col.setHSL(0.19 + rand() * 0.1, 0.25 + rand() * 0.25, 0.62 + rand() * 0.25);
      crowns.setColorAt(i, col);
    });
    crowns.castShadow = true;
    group.add(trunks, crowns);
  }

  // ---------- silhouette lointaine procédurale (au-delà des données OSM) ----------
  // Au-delà des bâtiments OSM (> 270 m) : îlots continus façon Paris intra-muros
  // (immeubles de 6-8 niveaux, toits en zinc) côté Paris, tissu de banlieue en face.
  buildFarSkyline(ctx) {
    const { s0, len, rand } = ctx;
    const t = this.track, lu = this.scenery.landuse, p = {};
    const blocked = new Set(['wood', 'park', 'water', 'rail', 'pitch', 'cemetery']);
    for (const side of [1, -1]) {
      for (const d0 of [275, 335, 405, 490]) {
        let s = s0 + rand() * 6;
        while (s < s0 + len) {
          const w = 11 + rand() * 15;
          if (rand() < 0.12) { s += 14 + rand() * 6; continue; } // rue transversale
          const sm = s + w / 2;
          t.pointAt(sm, p);
          const dist = d0 + (rand() - 0.5) * 10, depth = 12 + rand() * 6;
          const cx = p.x + p.rx * side * (dist + depth / 2), cz = p.z + p.rz * side * (dist + depth / 2);
          s += w + (rand() < 0.15 ? 4 : 0.2);
          if (t.woodAt(sm)) continue;
          const k = lu.at(cx, cz);
          if (k && blocked.has(k)) continue;
          const r = rand();
          let fac, h;
          if (side > 0) {
            fac = r < 0.6 ? 1 : r < 0.8 ? 0 : r < 0.92 ? 4 : 2;
            h = fac === 2 ? 28 + rand() * 25 : 17 + rand() * 7;
          } else {
            fac = r < 0.3 ? 1 : r < 0.6 ? 4 : r < 0.82 ? 2 : 3;
            h = fac === 2 ? 22 + rand() * 30 : fac === 3 ? 25 + rand() * 40 : 12 + rand() * 12;
          }
          this.scenery.drawBuilding({ kind: 'box', cx, cz, w, d: depth, ang: Math.atan2(p.tz, p.tx), h, fac, seed: rand() }, ctx.B.fac, ctx.B.roof);
        }
      }
    }
  }

  // ============================================================
  // Signalisation et équipements
  // ============================================================
  addSign(ctx, s, lat, y, tex, w, h, reverse = false, yaw = 0) {
    const p = this._p;
    if (tex && tex.tex) tex = tex.tex;
    this.track.pointAt(s, p);
    // quad orienté vers les usagers qui arrivent (sens intérieur) ; reverse = sens extérieur
    const fx = reverse ? p.tx : -p.tx, fz = reverse ? p.tz : -p.tz; // normale
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const nx = fx * c + fz * sn, nz = fz * c - fx * sn;
    const ax = nz, az = -nx; // axe « droite » du panneau vu de face
    const cx = p.x + p.rx * lat, cz = p.z + p.rz * lat;
    if (!ctx.signs) ctx.signs = new Map();
    if (!ctx.signs.has(tex)) ctx.signs.set(tex, new Batch());
    const B = ctx.signs.get(tex), col = [1, 1, 1];
    const hw = w / 2, hh = h / 2;
    const a = B.v(cx - ax * hw, y - hh, cz - az * hw, 0, 0, col);
    const b = B.v(cx + ax * hw, y - hh, cz + az * hw, 1, 0, col);
    const d = B.v(cx + ax * hw, y + hh, cz + az * hw, 1, 1, col);
    const e = B.v(cx - ax * hw, y + hh, cz - az * hw, 0, 1, col);
    B.quad(a, b, d, e);
  }
  flushSigns(ctx) {
    if (!ctx.signs) return;
    for (const [tex, B] of ctx.signs) {
      const g = B.build(this.T);
      if (!g) continue;
      const mesh = new this.T.Mesh(g, this.signMat(tex));
      ctx.group.add(mesh);
      ctx.geoms.push(g);
    }
  }
  rowAt(s) {
    const p = {};
    this.track.pointAt(s, p);
    return { x: p.x, z: p.z, rx: p.rx, rz: p.rz, tx: p.tx, tz: p.tz, h: p.y, s };
  }
  // panneau avec dos métallique + supports
  postedPanel(ctx, s, lat, yBottom, panel, posts = 2, reverse = false) {
    const r = this.rowAt(s);
    const { w, h } = panel;
    this.addSign(ctx, s, lat, yBottom + h / 2, panel.tex, w, h, reverse);
    const off = reverse ? -0.07 : 0.07;
    boxAt(ctx.B.metal, this.rowAt(s + off), lat, yBottom, w, h, 0.05, rgb(0x6d7177), 1);
    const pr = this.rowAt(s + off * 2);
    const xs = posts === 1 ? [0] : [-w * 0.32, w * 0.32];
    for (const dx of xs) boxAt(ctx.B.metal, pr, lat + dx, r.h - 0.1, 0.11, yBottom - r.h + h * 0.8, 0.11, rgb(0x868b91));
  }

  buildFeatures(ctx) {
    const { s0, len, B } = ctx;
    const t = this.track, T = this.T, L = t.length;
    const F = this.features;
    // recherche dichotomique du premier équipement ≥ s0
    let lo = 0, hi = F.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (F[m].s < s0) lo = m + 1; else hi = m; }
    for (let i = lo; i < F.length && F[i].s < s0 + len; i++) {
      const f = F[i];
      const r = this.rowAt(f.s);
      const Em = t.mainEdgeAt(f.s);
      const rampW = this.ramps.parallelWidth(f.s, r.h);
      const Eo = Em + rampW;
      const trench = r.h < -0.35 || t.coverAt(f.s);
      const viad = !!t.onViaduct(f.s) && r.h > 2;
      // position latérale d'un panneau de bord : jamais dans le mur ni derrière le parapet
      const side = (w) => (trench ? Eo + 1.12 - w / 2 : viad ? Eo + 0.82 : Math.max(Eo + 1.3, Eo + 0.8 + w / 2));
      switch (f.type) {
        case 'gantry': {
          const nL = t.lanesAt(f.s);
          const panels = [];
          for (const c of f.cols) {
            if (!c.lines.length) continue;
            const st = bpStack(T, c.lines, c.right ? Math.min(LW + rampW, 4.6) - 0.3 : 0);
            const lat = c.right ? CFG.INNER_EDGE + LW * (nL - 0.5) + rampW / 2 : CFG.INNER_EDGE + (LW * (nL - 1)) / 2;
            panels.push({ tex: st.tex, w: st.w, h: st.h, lat });
          }
          if (panels.length === 2 && panels[0].lat + panels[0].w / 2 > panels[1].lat - panels[1].w / 2 - 0.2) {
            panels[0].lat = panels[1].lat - panels[1].w / 2 - 0.25 - panels[0].w / 2;
          }
          this.gantry(ctx, f.s, Eo, panels);
          break;
        }
        case 'bridgeSign': {
          // panneaux fixés sur la tête du pont de la porte (cf. « D 911 600 m / P<sup>te</sup> de CLICHY »)
          const nL = t.lanesAt(f.s);
          const st = bpStack(T, f.lines, 0);
          const lat = CFG.INNER_EDGE + LW * (nL - 0.5) + Math.max(0, rampW / 2);
          const yb = r.h + CEIL - 0.55;
          this.addSign(ctx, f.s, lat, yb + st.h / 2, st.tex, st.w, st.h);
          boxAt(B.metal, this.rowAt(f.s + 0.06), lat, yb, st.w, st.h, 0.05, rgb(0x6d7177));
          if (f.thru && f.thru.length) {
            const s2 = bpStack(T, f.thru, 0);
            const lat2 = Math.min(CFG.INNER_EDGE + (LW * (nL - 1)) / 2, lat - st.w / 2 - 0.3 - s2.w / 2);
            this.addSign(ctx, f.s, lat2, yb + s2.h / 2, s2.tex, s2.w, s2.h);
            boxAt(B.metal, this.rowAt(f.s + 0.06), lat2, yb, s2.w, s2.h, 0.05, rgb(0x6d7177));
          }
          break;
        }
        case 'gore': {
          // le panneau est planté dans le musoir (entre chaussée et bretelle)
          const q = this.ramps.at(f.s, r.h).find((o) => !o.parallel);
          const lat = q ? Em + q.gap * 0.5 : Eo + 1.4;
          const st = bpStack(T, f.lines, 0);
          const sc = Math.min(1, 3.0 / st.w);
          this.postedPanel(ctx, f.s, lat, Math.max(r.h, q ? q.hr : r.h) + 1.1, { tex: st.tex, w: st.w * sc, h: st.h * sc }, 2);
          break;
        }
        case 'limit': {
          const tex = speedLimitTexture(T, 50);
          if (f.median) {
            this.addSign(ctx, f.s, 0.45, r.h + 2.3, tex, 0.9, 0.9);
            this.addSign(ctx, f.s, -0.45, r.h + 2.3, tex, 0.9, 0.9, true);
            boxAt(B.metal, r, 0, r.h + 0.8, 0.08, 1.95, 0.08, rgb(0x868b91));
          } else {
            const lat = side(0.9);
            this.addSign(ctx, f.s, lat, r.h + 2.4, tex, 0.9, 0.9);
            boxAt(B.metal, this.rowAt(f.s + 0.06), lat, r.h, 0.08, 2.4, 0.08, rgb(0x868b91));
          }
          break;
        }
        case 'pmv': {
          this.gantry(ctx, f.s, Eo, [{ tex: f.vms.panel.tex, w: 7.2, h: 2.4, lat: CFG.INNER_EDGE + 2 * LW, vms: true }], true);
          break;
        }
        case 'hov': {
          // potence depuis le séparateur au-dessus de la voie de gauche
          const lat = CFG.INNER_EDGE + LW / 2;
          boxAt(B.metal, r, 0.0, r.h + 0.82, 0.25, 5.6, 0.25, rgb(0x868b91));
          boxAt(B.metal, r, lat / 2, r.h + 6.3, lat + 0.6, 0.22, 0.22, rgb(0x868b91));
          boxAt(B.metal, r, -lat / 2, r.h + 6.3, lat + 0.6, 0.22, 0.22, rgb(0x868b91));
          this.addSign(ctx, f.s, lat, r.h + 5.4, hovTexture(T, true), 1.25, 1.45);
          this.addSign(ctx, f.s, -lat, r.h + 5.4, hovTexture(T, true), 1.25, 1.45, true);
          break;
        }
        case 'radar': {
          const lat = trench ? Eo + 0.9 : side(0.6);
          const grey = rgb(0xc2c6ca), dark = rgb(0x16181a);
          const rr = this.rowAt(f.s - 0.36); // face vitrée tournée vers le trafic qui arrive
          if (f.tower) {
            // radar « tourelle » : fût de 4 m, vitres noires en partie haute
            boxAt(B.metal, r, lat, r.h, 0.62, 0.35, 0.62, rgb(0x5d6166));
            boxAt(B.metal, r, lat, r.h + 0.35, 0.5, 3.75, 0.5, grey);
            boxAt(B.metal, rr, lat, r.h + 2.7, 0.44, 0.9, 0.06, dark);
            boxAt(B.metal, r, lat, r.h + 4.1, 0.56, 0.1, 0.56, rgb(0x6a6e73));
            boxAt(B.metal, rr, lat, r.h + 1.6, 0.3, 0.3, 0.06, rgb(0xf2f2f2)); // étiquette
            for (const y of [0.6, 1.0]) boxAt(B.metal, rr, lat, r.h + y, 0.52, 0.12, 0.05, rgb(0xf2c500)); // bandes rétroréfléchissantes
          } else {
            // cabine classique sur mât
            boxAt(B.metal, r, lat, r.h, 0.16, 2.2, 0.16, grey);
            boxAt(B.metal, rr, lat, r.h + 0.5, 0.2, 0.5, 0.05, rgb(0xf2c500));
            boxAt(B.metal, r, lat, r.h + 2.05, 0.95, 1.15, 0.75, grey);
            boxAt(B.metal, rr, lat, r.h + 2.25, 0.8, 0.55, 0.06, dark);
            boxAt(B.metal, rr, lat + 0.28, r.h + 2.9, 0.2, 0.16, 0.06, rgb(0xe8e8e8)); // flash
            boxAt(B.metal, r, lat, r.h + 3.2, 1.0, 0.08, 0.85, rgb(0x6a6e73));
          }
          break;
        }
        case 'radarSign': {
          const rp = { tex: radarTexture(T, 50).tex, w: 1.5, h: 2.25 };
          this.postedPanel(ctx, f.s, side(1.5), r.h + 1.2, rp, 2);
          this.postedPanel(ctx, f.s + 25, 0.9, r.h + 1.3, { tex: rp.tex, w: 1.1, h: 1.65 }, 1); // rappel côté séparateur
          break;
        }
        case 'sos': {
          const lat = trench ? Eo + 0.85 : side(0.6);
          boxAt(B.metal, r, lat, r.h, 0.55, 1.35, 0.4, rgb(0xe8701a));
          boxAt(B.metal, r, lat, r.h + 1.35, 0.6, 0.08, 0.45, rgb(0xd0d0d0));
          this.addSign(ctx, f.s, lat, r.h + 1.95, sosTexture(T), 0.45, 0.6);
          break;
        }
        case 'pr': {
          if (t.coverAt(f.s)) break;
          this.addSign(ctx, f.s, 0.12, r.h + 1.05, prPlateTexture(T, f.km), 0.3, 0.38);
          break;
        }
      }
    }
  }

  // potence (panneau en encorbellement au-dessus de la voie de droite)
  cantilever(ctx, s, Eo, panel, r) {
    const B = ctx.B;
    const col = rgb(0x868b91);
    const postLat = Eo + 0.95;
    boxAt(B.metal, r, postLat, r.h, 0.3, 6.9, 0.3, col);
    const armLen = panel.w + 1.2;
    boxAt(B.metal, r, postLat - armLen / 2, r.h + 6.5, armLen, 0.25, 0.25, col);
    const lat = postLat - 0.6 - panel.w / 2;
    this.addSign(ctx, s, lat, r.h + 6.35 - panel.h / 2, panel.tex, panel.w, panel.h);
    boxAt(B.metal, this.rowAt(s + 0.08), lat, r.h + 6.35 - panel.h, panel.w, panel.h, 0.05, rgb(0x6d7177));
  }

  // portique treillis au-dessus du sens intérieur (+ PMV éventuel)
  // portique : 2 poteaux + poutre caisson (gris ou rouge minium), panneaux accrochés devant
  gantry(ctx, s, Eo, panels, isVMS = false) {
    const B = ctx.B, r = this.rowAt(s);
    const red = ((Math.floor(s / 997) * 7) % 3) === 0 && !isVMS;
    const col = red ? rgb(0x9b5a52) : rgb(0x8f979c), colD = red ? rgb(0x7d4640) : rgb(0x6f777c);
    const maxH = panels.reduce((m, p) => Math.max(m, p.h), 0);
    const bottom = r.h + 5.0;                       // gabarit sous panneaux
    const top = bottom + Math.max(maxH, 1.2);       // dessus de la poutre = haut des panneaux
    const xs = [0.75, Eo + 1.0];
    for (const x of xs) {
      const y0 = r.h + (x < 1 ? 0.82 : 0);
      boxAt(B.metal, r, x, y0, 0.4, top - y0 + 0.1, 0.4, col);
      boxAt(B.metal, r, x, y0, 0.7, 0.18, 0.7, colD);
    }
    const span = xs[1] - xs[0] + 0.4, cx = (xs[0] + xs[1]) / 2;
    boxAt(B.metal, r, cx, top - 0.75, span, 0.75, 0.55, col);          // poutre caisson
    boxAt(B.metal, this.rowAt(s - 0.3), cx, top - 0.05, span, 0.08, 0.1, colD); // lisse haute
    for (const p of panels) {
      const y = p.vms ? top - 0.4 - p.h / 2 : bottom + p.h / 2 + (maxH - p.h);
      this.addSign(ctx, s - 0.4, p.lat, y, p.tex, p.w, p.h);
      boxAt(B.metal, this.rowAt(s - 0.34), p.lat, y - p.h / 2, p.w, p.h, 0.05, rgb(0x5e6268));
      if (p.vms) boxAt(B.metal, this.rowAt(s - 0.18), p.lat, y - p.h / 2 - 0.15, p.w + 0.3, p.h + 0.3, 0.3, rgb(0x2f3236));
    }
  }

  // ---------- PMV : temps de parcours réalistes / messages d'événements ----------
  updateVMS(playerS, force = false) {
    const t = this.track, L = t.length;
    this._vmsT = (this._vmsT || 0) + 1;
    if (!force && this._vmsT % 20) return;
    const now = performance.now();
    for (const v of this.vms) {
      const d = wrap(v.s - playerS, L);
      if (d > 1400) continue;
      if (v.override > now) continue;
      // destinations : portes majeures à ~2, ~5 et ~9 km
      const majors = ['Porte Maillot', 'Porte de la Chapelle', 'Porte de Bagnolet', 'Porte de Bercy', "Porte d'Italie", "Porte d'Orléans", 'Porte de Saint-Cloud', 'Porte de Clichy', 'Porte de Vincennes', 'Porte de Sèvres', 'Porte de la Villette', "Porte d'Auteuil"];
      const ahead = t.portes.filter((p) => majors.includes(p.name)).map((p) => ({ p, d: wrap(p.s - v.s, L) })).filter((o) => o.d > 1200).sort((a, b) => a.d - b.d).slice(0, 3);
      const abbr = (n) => n.replace(/^Porte (de la |de l'|de |d'|du |des )?/i, (m) => 'PTE ' + (m.match(/(de la |de l'|du |des )/i)?.[0] || '')).toUpperCase().replace('SAINT-', 'ST-');
      const slow = 0.85 + 0.3 * Math.sin(v.s * 0.001 + now * 0.00002);
      const lines = ahead.map((o) => `${abbr(o.p.name)}\t${Math.max(1, Math.round((o.d / 1000) / (38 * slow) * 60))} MN`);
      v.panel.setText(lines);
    }
  }

  setVMSAhead(playerS, lines) {
    let best = null, bestD = Infinity;
    for (const v of this.vms) {
      const d = wrap(v.s - playerS, this.track.length);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best) {
      best.panel.setText([...lines, ''].slice(0, 3));
      best.override = performance.now() + 60000;
    }
  }
}
