// ============================================================
// Périph' Rush — génération streamée du monde
// Le périphérique est découpé en segments de 100 m générés/détruits
// autour du joueur. Tout le décor statique d'un segment est fusionné
// en très peu de draw calls (1 mesh « béton/métal » vertex-colored,
// 1 route, 1 sol, 1 immeubles, 2 arbres, panneaux).
// ============================================================

import { CFG, ROAD_OUTER } from './config.js';
import { rng, mergeGeoms, colorize, xform, wrap, pick } from './utils.js';
import { exitPanelTexture, gantryPanelTexture, peripheriqueCartouche, speedLimitTexture, VMSPanel } from './signs.js';

const ROAD_HALF = 18.4;          // demi-largeur du ruban de chaussée (2×4 voies + séparateur)
const GROUND_Y = 0;              // niveau « ville » ; la route plonge en tranchée sous 0

// ---------- textures canvas partagées --------------------------------
function roadTexture(THREE) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const c = cv.getContext('2d');
  const px = (x) => ((x + ROAD_HALF) / (ROAD_HALF * 2)) * 1024;
  // asphalte + grain
  c.fillStyle = '#4b4f57';
  c.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    c.fillRect(Math.random() * 1024, Math.random() * 256, 2, 2);
  }
  // traces de roulement plus sombres au centre des voies
  for (const side of [-1, 1]) {
    for (let l = 0; l < CFG.LANES; l++) {
      const cx = side * (CFG.INNER_EDGE + CFG.LANE_WIDTH * (l + 0.5));
      for (const o of [-0.8, 0.8]) {
        const g = c.createLinearGradient(px(cx + o) - 14, 0, px(cx + o) + 14, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(10,10,14,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(px(cx + o) - 14, 0, 28, 256);
      }
    }
  }
  // zone du séparateur central
  c.fillStyle = '#53565c';
  c.fillRect(px(-CFG.INNER_EDGE), 0, px(CFG.INNER_EDGE) - px(-CFG.INNER_EDGE), 256);
  // marquages : rive continue + pointillés (3 m plein / 7 m vide sur 10 m = 256 px)
  const line = (x, w) => { c.fillRect(px(x) - w / 2, 0, w, 256); };
  const dashes = (x, w) => { c.fillRect(px(x) - w / 2, 0, w, Math.round(256 * 0.3)); };
  c.fillStyle = '#e2e6ea';
  for (const side of [-1, 1]) {
    line(side * CFG.INNER_EDGE, 4);
    line(side * (CFG.INNER_EDGE + CFG.LANE_WIDTH * CFG.LANES), 4);
    for (let l = 1; l < CFG.LANES; l++) dashes(side * (CFG.INNER_EDGE + CFG.LANE_WIDTH * l), 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function facadeTextures(THREE) {
  const day = document.createElement('canvas');
  day.width = day.height = 256;
  const d = day.getContext('2d');
  const glow = document.createElement('canvas');
  glow.width = glow.height = 256;
  const g = glow.getContext('2d');
  d.fillStyle = '#ffffff'; d.fillRect(0, 0, 256, 256);          // base blanche (teintée par vertex color)
  g.fillStyle = '#000000'; g.fillRect(0, 0, 256, 256);
  const rand = rng(1234);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const x = 12 + i * 40, y = 12 + j * 40;
      d.fillStyle = 'rgba(52,64,84,0.72)';
      d.fillRect(x, y, 24, 30);
      d.fillStyle = 'rgba(255,255,255,0.25)';
      d.fillRect(x, y, 24, 4);
      if (rand() < 0.34) {
        g.fillStyle = ['#ffd28a', '#ffe9bd', '#cfe0ff'][(rand() * 3) | 0];
        g.fillRect(x + 2, y + 2, 20, 26);
      }
    }
  }
  // coin réservé (toits) : uni sombre
  d.fillStyle = '#3a3d41'; d.fillRect(248, 248, 8, 8);
  g.fillStyle = '#000'; g.fillRect(248, 248, 8, 8);
  const mk = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { day: mk(day), glow: mk(glow) };
}

// panneau : plane + texture (cache par texture)
function makePanel(THREE, tex, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelMat(THREE, tex));
  return m;
}
const _panelMats = new Map();
function panelMat(THREE, tex) {
  if (!_panelMats.has(tex)) _panelMats.set(tex, new THREE.MeshBasicMaterial({ map: tex }));
  return _panelMats.get(tex);
}

// ============================================================
export class World {
  constructor(THREE, scene, track) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.chunks = new Map();      // index → { group, geoms[] }
    this.pending = [];
    this.mats = this.makeMaterials();
    this.vms = [];                // panneaux à messages variables
    const vmsCount = 6;
    for (let i = 0; i < vmsCount; i++) {
      this.vms.push({ s: (track.length / vmsCount) * i + 900, panel: new VMSPanel(THREE) });
    }
    this.buildLandmarks();
    this._v = new THREE.Vector3();
  }

  makeMaterials() {
    const T = this.T;
    const facade = facadeTextures(T);
    return {
      road: new T.MeshPhongMaterial({ map: roadTexture(T), shininess: 6, specular: 0x111111 }),
      // DoubleSide : les profils extrudés (GBA, murs, tunnels) sont vus des deux côtés
      concrete: new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }),
      lamp: new T.MeshBasicMaterial({ color: 0x3a3f45 }),
      building: new T.MeshLambertMaterial({
        vertexColors: true, map: facade.day, emissiveMap: facade.glow,
        emissive: 0xffffff, emissiveIntensity: 0,
      }),
      trunk: new T.MeshLambertMaterial({ color: 0x5a4632 }),
      canopy: new T.MeshLambertMaterial({ color: 0x4e7a3a }),
      ground: new T.MeshLambertMaterial({ vertexColors: true }),
      water: new T.MeshPhongMaterial({ color: 0x3d5a6e, shininess: 90, specular: 0x668899 }),
      tunnelLight: new T.MeshBasicMaterial({ color: 0xfff1c8 }),
      dark: new T.MeshBasicMaterial({ color: 0x0c0e11 }),
    };
  }

  // matériaux à exposer à l'ambiance
  ambienceHooks() {
    return { roadMat: this.mats.road, buildingMat: this.mats.building, lampMat: this.mats.lamp, tunnelLightMat: this.mats.tunnelLight };
  }

  // ---------- monuments parisiens (silhouettes stylisées) ------------
  buildLandmarks() {
    const T = this.T;
    const lat0 = 48.8590, lon0 = 2.3400;
    const mLat = 111132, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const at = (lat, lon) => ({ x: (lon - lon0) * mLon, z: -(lat - lat0) * mLat });
    const g = [];
    const box = (w, h, d, col, x, z, y = 0) => g.push(colorize(T, xform(new T.BoxGeometry(w, h, d), { x, y: y + h / 2, z }), col));
    // Tour Eiffel (48.8584, 2.2945) : fût effilé en 3 tronçons + antenne
    {
      const p = at(48.8584, 2.2945);
      box(124, 60, 124, 0x6e5a48, p.x, p.z);
      box(70, 55, 70, 0x6e5a48, p.x, p.z, 58);
      box(34, 90, 34, 0x64523f, p.x, p.z, 110);
      box(12, 110, 12, 0x5a4a3a, p.x, p.z, 196);
      box(3, 26, 3, 0x4a3d30, p.x, p.z, 304);
    }
    // Sacré-Cœur (48.8867, 2.3431)
    {
      const p = at(48.8867, 2.3431);
      box(90, 34, 60, 0xe8e4da, p.x, p.z, 40);   // butte + basilique
      g.push(colorize(T, xform(new T.SphereGeometry(20, 10, 8), { x: p.x, y: 92, z: p.z }), 0xf0ece2));
      g.push(colorize(T, xform(new T.SphereGeometry(9, 8, 6), { x: p.x - 28, y: 82, z: p.z + 8 }), 0xf0ece2));
      g.push(colorize(T, xform(new T.SphereGeometry(9, 8, 6), { x: p.x + 28, y: 82, z: p.z + 8 }), 0xf0ece2));
      box(10, 40, 10, 0xe8e4da, p.x + 40, p.z - 10, 60);
    }
    // Tour Montparnasse (48.8421, 2.3220)
    { const p = at(48.8421, 2.3220); box(48, 210, 30, 0x2c3138, p.x, p.z); }
    // La Défense (48.8905, 2.2410) : grappe de tours
    {
      const p = at(48.8905, 2.2410);
      const rand = rng(42);
      for (let i = 0; i < 7; i++) {
        box(40 + rand() * 30, 120 + rand() * 110, 40 + rand() * 25,
          [0x5b6b7d, 0x6d7f92, 0x49586a, 0x7d8ea0][(rand() * 4) | 0],
          p.x + (rand() - 0.5) * 600, p.z + (rand() - 0.5) * 500);
      }
      // Grande Arche
      box(100, 100, 20, 0xd8dde2, p.x - 80, p.z + 300);
    }
    // Tours Mercuriales à Bagnolet (48.8646, 2.4180)
    { const p = at(48.8646, 2.4180); box(30, 90, 30, 0x4c6a86, p.x - 25, p.z); box(30, 90, 30, 0x4c6a86, p.x + 25, p.z); }
    // Dôme des Invalides (48.8551, 2.3126)
    {
      const p = at(48.8551, 2.3126);
      box(50, 30, 50, 0xd9d4c8, p.x, p.z);
      g.push(colorize(T, xform(new T.SphereGeometry(16, 10, 8), { x: p.x, y: 44, z: p.z }), 0xc9a94a));
    }
    const geom = mergeGeoms(this.T, g);
    const mat = new this.T.MeshLambertMaterial({ vertexColors: true, fog: true });
    const mesh = new this.T.Mesh(geom, mat);
    this.scene.add(mesh);
  }

  // ---------- gestion du streaming -------------------------------------
  chunkIndex(s) { return Math.floor(wrap(s, this.track.length) / CFG.CHUNK_LEN); }
  chunkCount() { return Math.ceil(this.track.length / CFG.CHUNK_LEN); }

  update(playerS) {
    const n = this.chunkCount();
    const cur = this.chunkIndex(playerS);
    const want = new Set();
    for (let i = -CFG.CHUNKS_BEHIND; i <= CFG.CHUNKS_AHEAD; i++) want.add(((cur + i) % n + n) % n);
    // supprimer les segments hors fenêtre
    for (const [idx, chunk] of this.chunks) {
      if (!want.has(idx)) {
        this.scene.remove(chunk.group);
        chunk.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
        for (const g of chunk.geoms) g.dispose();
        this.chunks.delete(idx);
      }
    }
    // construire au plus 1 segment par frame (anti à-coups)
    for (const idx of want) {
      if (!this.chunks.has(idx)) {
        this.buildChunk(idx);
        break;
      }
    }
  }

  prebuild(playerS) { // construction synchrone au chargement
    const n = this.chunkCount();
    const cur = this.chunkIndex(playerS);
    for (let i = -CFG.CHUNKS_BEHIND; i <= CFG.CHUNKS_AHEAD; i++) {
      const idx = ((cur + i) % n + n) % n;
      if (!this.chunks.has(idx)) this.buildChunk(idx);
    }
  }

  // ---------- construction d'un segment ---------------------------------
  buildChunk(idx) {
    const T = this.T, track = this.track;
    const s0 = idx * CFG.CHUNK_LEN;
    const len = Math.min(CFG.CHUNK_LEN, track.length - s0);
    const rand = rng(idx * 7919 + 13);
    const group = new T.Group();
    const geoms = [];
    const statics = [];   // fusion béton/métal/poteaux (vertex colors)
    const p = {};

    const zone = track.zoneAt(s0 + len / 2);
    const flags = zone.flags;
    const tunnel = track.inTunnel(s0 + 2) || track.inTunnel(s0 + len - 2);
    const bridge = track.onBridge(s0 + len / 2);
    const rows = Math.floor(len / 10) + 1;

    // — ruban de chaussée (les deux sens) —
    {
      const pos = [], uv = [], idb = [];
      for (let r = 0; r < rows; r++) {
        const s = s0 + r * 10;
        track.pointAt(s, p);
        for (const side of [-1, 1]) {
          pos.push(p.x + p.rx * ROAD_HALF * side, p.y, p.z + p.rz * ROAD_HALF * side);
          uv.push(side < 0 ? 0 : 1, s / CFG.ROAD_TEX_REPEAT);
        }
      }
      for (let r = 0; r < rows - 1; r++) {
        const a = r * 2, b = r * 2 + 1, c2 = r * 2 + 2, d = r * 2 + 3;
        idb.push(a, b, c2, b, d, c2);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idb);
      geo.computeVertexNormals();
      const mesh = new T.Mesh(geo, this.mats.road);
      group.add(mesh);
      geoms.push(geo);
    }

    // — profils continus le long du tracé —
    // séparateur GBA central
    statics.push(this.ribbon(s0, len, [
      [-0.55, 0, 0x8b8f94], [-0.45, 0.55, 0x94989d], [-0.14, 0.82, 0x9da1a6],
      [0.14, 0.82, 0x9da1a6], [0.45, 0.55, 0x94989d], [0.55, 0, 0x8b8f94],
    ], 10));
    if (!bridge) {
      // glissières métalliques extérieures des deux côtés
      for (const side of [1, -1]) {
        const x = ROAD_HALF - 0.5;
        statics.push(this.ribbon(s0, len, [
          [side * x, 0.5, 0xa9adb3], [side * (x + 0.12), 0.66, 0xb9bdc3], [side * x, 0.82, 0xa9adb3],
        ], 10, true));
      }
    } else {
      // parapets de pont + Seine
      for (const side of [1, -1]) {
        const x = ROAD_HALF - 0.3;
        statics.push(this.ribbon(s0, len, [
          [side * x, 0, 0x9a9ea3], [side * (x + 0.3), 0.6, 0xa5a9ae], [side * (x + 0.3), 1.15, 0xb0b4b9], [side * x, 1.15, 0xa5a9ae],
        ], 10));
      }
      track.pointAt(s0 + len / 2, p);
      // la Seine : bande d'eau de la largeur du fleuve, orientée selon la route
      const wgeo = new T.PlaneGeometry(560, 150).rotateX(-Math.PI / 2);
      wgeo.rotateY(Math.atan2(p.tx, p.tz) + Math.PI / 2);
      wgeo.translate(p.x, p.y - 8.5, p.z);
      const water = new T.Mesh(wgeo, this.mats.water);
      group.add(water);
      geoms.push(wgeo);
      // berges/quais de part et d'autre du fleuve (le long de l'axe de la route)
      for (const off of [-110, 110]) {
        statics.push(colorize(T, xform(new T.BoxGeometry(560, 7, 40), {
          x: p.x + p.tx * off, y: p.y - 5, z: p.z + p.tz * off,
          ry: Math.atan2(p.tx, p.tz) + Math.PI / 2,
        }), 0x8a877e));
      }
    }

    // murs / tranchée / tunnel
    const roadDepth = -track.zoneAt(s0).alt; // >0 si en contrebas
    if (tunnel) {
      this.buildTunnel(s0, len, rows, statics, group, geoms, track);
    } else if (roadDepth > 2.2 || flags.includes('W')) {
      // murs de soutènement / antibruit des deux côtés
      const h = Math.max(roadDepth + 1.2, 3.6);
      const isNoise = flags.includes('W') && roadDepth <= 2.2;
      const colA = isNoise ? 0x7f8b7a : 0xa39a8c, colB = isNoise ? 0x93a08c : 0xb2a898;
      for (const side of [1, -1]) {
        const x = ROAD_HALF + 0.3;
        statics.push(this.ribbon(s0, len, [
          [side * x, 0, colA], [side * (x + 0.35), h * 0.6, colB], [side * (x + 0.2), h, colA],
        ], 10));
      }
    }

    // lampadaires doubles sur le séparateur (tous les 25 m) — pas en tunnel
    const lampHeads = [];
    if (!tunnel) {
      for (let d = 12; d < len; d += 25) {
        const s = s0 + d;
        track.pointAt(s, p);
        const mast = xform(new T.CylinderGeometry(0.09, 0.13, 9.5, 6), { x: p.x, y: p.y + 4.75, z: p.z });
        statics.push(colorize(T, mast, 0x51565c));
        for (const side of [-1, 1]) {
          const arm = xform(new T.BoxGeometry(0.08, 0.08, 2.6), { x: p.x + p.rx * side * 1.3, y: p.y + 9.3, z: p.z + p.rz * side * 1.3, ry: Math.atan2(p.rx, p.rz) });
          statics.push(colorize(T, arm, 0x51565c));
          const head = xform(new T.BoxGeometry(0.5, 0.12, 0.22), { x: p.x + p.rx * side * 2.6, y: p.y + 9.2, z: p.z + p.rz * side * 2.6, ry: Math.atan2(p.tx, p.tz) });
          lampHeads.push(head);
        }
      }
    }

    // — sorties / échangeurs aux portes —
    for (const porte of track.portes) {
      const dS = wrap(porte.s - s0, track.length);
      // pont de l'échangeur au niveau de la porte
      if (dS < len) this.buildOverpass(porte.s, statics, group, geoms);
      // bretelle de sortie (60 m avant la porte)
      const dExit = wrap(porte.s - 80 - s0, track.length);
      if (dExit < len && !tunnel) this.buildExitRamp(porte.s - 80, group, geoms, statics);
      // panneau « sortie 400 m »
      const dPre = wrap(porte.s - 420 - s0, track.length);
      if (dPre < len && !tunnel) {
        this.addSign(group, geoms, s0 + dPre, exitPanelTexture(T, porte.name, '400 m'), 4.6, 2.0, ROAD_OUTER + 2.2, 3.2);
      }
      const dAt = wrap(porte.s - 110 - s0, track.length);
      if (dAt < len && !tunnel) {
        this.addSign(group, geoms, s0 + dAt, exitPanelTexture(T, porte.name), 4.6, 1.6, ROAD_OUTER + 2.6, 3.0);
      }
      // cartouche BD PÉRIPHÉRIQUE + limite 50 après la porte
      const dPost = wrap(porte.s + 160 - s0, track.length);
      if (dPost < len && !tunnel) {
        this.addSign(group, geoms, s0 + dPost, peripheriqueCartouche(T), 2.6, 0.6, ROAD_OUTER + 1.6, 2.4);
        this.addSign(group, geoms, s0 + dPost, speedLimitTexture(T), 0.85, 0.85, ROAD_OUTER + 1.6, 3.4);
      }
    }

    // — portique directionnel (~1 sur 7 segments) —
    if (!tunnel && rand() < 0.15) {
      const sG = s0 + 30 + rand() * 40;
      const next = track.nextPorte(sG + 500);
      const lines = [
        { text: next.porte.name, arrow: 'up' },
        { text: pick(rand, ['PARIS-CENTRE', 'BOULEVARD PÉRIPHÉRIQUE', 'AUTRES DIRECTIONS']), small: true },
      ];
      if (rand() < 0.5) lines.push({ text: pick(rand, ['LILLE', 'BORDEAUX · NANTES', 'LYON', 'METZ · NANCY', 'ROUEN', 'CRÉTEIL', 'AÉROPORT CDG']), badge: pick(rand, ['A1', 'A6', 'A3', 'A4', 'A13', 'A86']) },);
      this.buildGantry(sG, gantryPanelTexture(T, lines), statics, group, geoms);
    }
    // — PMV —
    for (const v of this.vms) {
      const dV = wrap(v.s - s0, track.length);
      if (dV < len && !tunnel) this.buildGantry(s0 + dV, v.panel.tex, statics, group, geoms, true);
    }

    // — sol urbain + immeubles + arbres hors tunnel/pont —
    if (!tunnel && !bridge) {
      this.buildGround(s0, len, rows, group, geoms, flags);
      if (flags.includes('B')) this.buildBuildings(s0, len, rand, group, geoms, roadDepth);
      if (flags.includes('T') || rand() < 0.3) this.buildTrees(s0, len, rand, group, geoms, flags.includes('T') ? 46 : 10, roadDepth);
    }

    // fusion des statiques
    if (statics.length) {
      const merged = mergeGeoms(T, statics);
      const mesh = new T.Mesh(merged, this.mats.concrete);
      group.add(mesh);
      geoms.push(merged);
      for (const s of statics) s.dispose();
    }
    if (lampHeads.length) {
      const merged = mergeGeoms(T, lampHeads);
      const mesh = new T.Mesh(merged, this.mats.lamp);
      group.add(mesh);
      geoms.push(merged);
      for (const s of lampHeads) s.dispose();
    }

    this.scene.add(group);
    this.chunks.set(idx, { group, geoms });
  }

  // ruban extrudé le long du tracé : profil = [[x, y, couleur], …]
  ribbon(s0, len, profile, step = 10, doubleSide = false) {
    const T = this.T, track = this.track;
    const p = {};
    const rows = Math.floor(len / step) + 1;
    const pos = [], col = [], idxA = [];
    const c = new T.Color();
    for (let r = 0; r < rows; r++) {
      track.pointAt(s0 + r * step, p);
      for (const [x, y, hex] of profile) {
        pos.push(p.x + p.rx * x, p.y + y, p.z + p.rz * x);
        c.setHex(hex);
        col.push(c.r, c.g, c.b);
      }
    }
    const m = profile.length;
    for (let r = 0; r < rows - 1; r++) {
      for (let i = 0; i < m - 1; i++) {
        const a = r * m + i, b = a + 1, d = a + m, e = a + m + 1;
        idxA.push(a, b, d, b, e, d);
        if (doubleSide) idxA.push(a, d, b, b, e, d);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setIndex(idxA);
    geo.computeVertexNormals();
    return geo;
  }

  buildTunnel(s0, len, rows, statics, group, geoms, track) {
    const T = this.T;
    // parois + plafond (béton sombre encrassé, bandeau clair à mi-hauteur)
    for (const side of [1, -1]) {
      statics.push(this.ribbon(s0, len, [
        [side * (ROAD_HALF - 0.2), 0, 0x4e4a45], [side * (ROAD_HALF + 0.1), 1.4, 0x8f8b84], [side * (ROAD_HALF + 0.1), 2.6, 0x6e6a64], [side * (ROAD_HALF - 0.1), 5.4, 0x47433e],
      ], 10));
    }
    statics.push(this.ribbon(s0, len, [
      [-(ROAD_HALF + 0.1), 5.4, 0x3b3833], [0, 5.7, 0x413e39], [ROAD_HALF + 0.1, 5.4, 0x3b3833],
    ], 10));
    // rampes lumineuses au plafond
    const lights = [];
    const p = {};
    for (let d = 5; d < len; d += 10) {
      track.pointAt(s0 + d, p);
      for (const side of [-1, 1]) {
        lights.push(xform(new T.BoxGeometry(0.3, 0.06, 2.2), {
          x: p.x + p.rx * side * 8, y: p.y + 5.32, z: p.z + p.rz * side * 8, ry: Math.atan2(p.tx, p.tz),
        }));
      }
    }
    const lg = mergeGeoms(T, lights);
    const lm = new T.Mesh(lg, this.mats.tunnelLight);
    group.add(lm);
    geoms.push(lg);
    for (const l of lights) l.dispose();
    // portail d'entrée/sortie
    for (const t of track.tunnels) {
      for (const end of [t.s0, t.s1]) {
        const d = wrap(end - s0, track.length);
        if (d < len) {
          track.pointAt(end, p);
          const face = xform(new T.BoxGeometry(ROAD_HALF * 2 + 4, 4, 0.8), {
            x: p.x, y: p.y + 7.4, z: p.z, ry: Math.atan2(p.tx, p.tz),
          });
          statics.push(colorize(T, face, 0x8a867f));
          for (const side of [-1, 1]) {
            const wing = xform(new T.BoxGeometry(0.8, 9.5, 6), {
              x: p.x + p.rx * side * (ROAD_HALF + 0.6), y: p.y + 4.7, z: p.z + p.rz * side * (ROAD_HALF + 0.6), ry: Math.atan2(p.tx, p.tz),
            });
            statics.push(colorize(T, wing, 0x938f88));
          }
        }
      }
    }
  }

  buildOverpass(s, statics, group, geoms) {
    const T = this.T, track = this.track;
    const p = {};
    track.pointAt(s, p);
    const ry = Math.atan2(p.rx, p.rz); // le pont croise la route
    const deckY = p.y + 6.2;
    statics.push(colorize(T, xform(new T.BoxGeometry(12, 1.1, ROAD_HALF * 2 + 26), { x: p.x, y: deckY, z: p.z, ry }), 0x9a948b));
    statics.push(colorize(T, xform(new T.BoxGeometry(12.4, 0.9, 1), { x: p.x + p.tx * 0, y: deckY + 0.9, z: p.z, ry }), 0xa6a098));
    for (const side of [-1, 1]) {
      statics.push(colorize(T, xform(new T.BoxGeometry(10, 6.2, 1.6), {
        x: p.x + p.rx * side * (ROAD_HALF + 5), y: p.y + 3.1, z: p.z + p.rz * side * (ROAD_HALF + 5), ry,
      }), 0x8f8b84));
    }
  }

  buildExitRamp(sExit, group, geoms, statics) {
    const T = this.T, track = this.track;
    const p = {};
    const pos = [], uv = [], idxA = [];
    const L = 70, rowsr = 8;
    for (let r = 0; r <= rowsr; r++) {
      const t = r / rowsr;
      const s = sExit + t * L;
      track.pointAt(s, p);
      const spread = 4.5 * (t < 0.5 ? t * 2 : 1) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      const x0 = ROAD_OUTER, x1 = ROAD_OUTER + Math.max(spread, 0.01);
      pos.push(p.x + p.rx * x0, p.y + 0.02, p.z + p.rz * x0);
      pos.push(p.x + p.rx * x1, p.y + 0.02, p.z + p.rz * x1);
      uv.push(0.62, s / 10, 0.66, s / 10); // bande d'asphalte utilisée comme texture
    }
    for (let r = 0; r < rowsr; r++) {
      const a = r * 2;
      idxA.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idxA);
    geo.computeVertexNormals();
    group.add(new T.Mesh(geo, this.mats.road));
    geoms.push(geo);
  }

  buildGantry(s, tex, statics, group, geoms, isVMS = false) {
    const T = this.T, track = this.track;
    const p = {};
    track.pointAt(s, p);
    const ry = Math.atan2(p.tx, p.tz);
    for (const side of [-1, 1]) {
      statics.push(colorize(T, xform(new T.BoxGeometry(0.35, 6.4, 0.35), {
        x: p.x + p.rx * side * (ROAD_HALF - 1), y: p.y + 3.2, z: p.z + p.rz * side * (ROAD_HALF - 1),
      }), 0x6a6f75));
    }
    statics.push(colorize(T, xform(new T.BoxGeometry(0.3, 0.5, ROAD_HALF * 2 - 2), { x: p.x, y: p.y + 6.4, z: p.z, ry: ry + Math.PI / 2 }), 0x6a6f75));
    const panel = makePanel(T, tex, isVMS ? 6 : 7.5, isVMS ? 1.9 : 2.6);
    // au-dessus du sens intérieur (côté droit du séparateur)
    panel.position.set(p.x + p.rx * 8, p.y + 5.2, p.z + p.rz * 8);
    panel.rotation.y = ry + Math.PI;
    group.add(panel);
  }

  addSign(group, geoms, s, tex, w, h, lateral, height) {
    const T = this.T, track = this.track;
    const p = {};
    track.pointAt(s, p);
    const panel = makePanel(T, tex, w, h);
    panel.position.set(p.x + p.rx * lateral, p.y + height, p.z + p.rz * lateral);
    panel.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
    group.add(panel);
    // mât
    const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, height, 5), this.mats.concrete);
    colorize(T, pole.geometry, 0x7a7f85);
    pole.position.set(p.x + p.rx * lateral, p.y + height / 2, p.z + p.rz * lateral);
    group.add(pole);
    geoms.push(pole.geometry);
  }

  buildGround(s0, len, rows, group, geoms, flags) {
    const T = this.T, track = this.track;
    const p = {};
    const pos = [], col = [], idxA = [];
    const c = new T.Color(flags.includes('T') ? 0x51663f : 0x6a6d68);
    const c2 = new T.Color(flags.includes('T') ? 0x47593a : 0x5e615c);
    for (let r = 0; r < rows; r++) {
      track.pointAt(s0 + r * 10, p);
      const gy = GROUND_Y + 0.15;
      for (const [x, cc] of [[-260, c2], [-ROAD_HALF - 1.5, c], [ROAD_HALF + 1.5, c], [260, c2]]) {
        // colonnes proches : au niveau de la route ; lointaines : niveau ville
        pos.push(p.x + p.rx * x, Math.abs(x) > ROAD_HALF + 3 ? gy : p.y + 0.12, p.z + p.rz * x);
        col.push(cc.r, cc.g, cc.b);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (const off of [0, 2]) {
        const a = r * 4 + off;
        idxA.push(a, a + 1, a + 4, a + 1, a + 5, a + 4);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setIndex(idxA);
    geo.computeVertexNormals();
    group.add(new T.Mesh(geo, this.mats.ground));
    geoms.push(geo);
  }

  buildBuildings(s0, len, rand, group, geoms, roadDepth) {
    const T = this.T, track = this.track;
    const p = {};
    const g = [];
    const parisTints = [0xefe6d4, 0xf4ecdd, 0xe4dbc9, 0xdcd2bf];
    const outTints = [0xc3c9d0, 0xb4bbc3, 0xd0cabf, 0xa8afb7, 0xd8d4cc];
    const n = 2 + (rand() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const s = s0 + rand() * len;
      track.pointAt(s, p);
      const side = rand() < 0.45 ? 1 : -1; // 1 = côté Paris (droite)
      const dist = 30 + rand() * 45;
      const w = 14 + rand() * 22, d = 12 + rand() * 16;
      const h = side === 1 ? 15 + rand() * 12 : 10 + rand() * (rand() < 0.25 ? 38 : 18);
      const tint = side === 1 ? pick(rand, parisTints) : pick(rand, outTints);
      const bx = p.x + p.rx * side * dist, bz = p.z + p.rz * side * dist;
      const geo = new T.BoxGeometry(w, h, d);
      // UV façades à l'échelle (fenêtres ~3,3 m) ; toits sur le texel sombre
      const uvA = geo.getAttribute('uv');
      for (let v = 0; v < uvA.count; v++) {
        const face = Math.floor(v / 4);
        if (face === 2 || face === 3) { uvA.setXY(v, 0.984, 0.984); continue; }
        const du = (face < 2 ? d : w) / 3.3, dv = h / 3.3;
        uvA.setXY(v, uvA.getX(v) * du, uvA.getY(v) * dv);
      }
      xform(geo, { x: bx, y: GROUND_Y + h / 2, z: bz, ry: rand() * Math.PI });
      colorize(T, geo, tint);
      g.push(geo);
    }
    if (!g.length) return;
    const merged = mergeGeoms(T, g);
    group.add(new T.Mesh(merged, this.mats.building));
    geoms.push(merged);
    for (const gg of g) gg.dispose();
  }

  buildTrees(s0, len, rand, group, geoms, count, roadDepth) {
    const T = this.T, track = this.track;
    if (!this._treeGeo) {
      this._treeTrunk = new T.CylinderGeometry(0.14, 0.2, 2.4, 5);
      this._treeGeo = new T.IcosahedronGeometry(1.7, 1);
    }
    const p = {};
    const trunks = new T.InstancedMesh(this._treeTrunk, this.mats.trunk, count);
    const crowns = new T.InstancedMesh(this._treeGeo, this.mats.canopy, count);
    const m4 = new T.Matrix4();
    const q = new T.Quaternion();
    const sc = new T.Vector3();
    const v = new T.Vector3();
    const col = new T.Color();
    for (let i = 0; i < count; i++) {
      const s = s0 + rand() * len;
      track.pointAt(s, p);
      const side = rand() < 0.5 ? 1 : -1;
      const dist = ROAD_HALF + 6 + rand() * 60;
      v.set(p.x + p.rx * side * dist, GROUND_Y, p.z + p.rz * side * dist);
      const h = 0.8 + rand() * 0.9;
      m4.compose(v.clone().setY(GROUND_Y + 1.2 * h), q, sc.set(h, h, h));
      trunks.setMatrixAt(i, m4);
      m4.compose(v.clone().setY(GROUND_Y + (2.6 + rand()) * h), q, sc.set(h * (0.8 + rand() * 0.5), h * (0.9 + rand() * 0.4), h));
      crowns.setMatrixAt(i, m4);
      col.setHSL(0.26 + rand() * 0.08, 0.35 + rand() * 0.2, 0.3 + rand() * 0.12);
      crowns.setColorAt(i, col);
    }
    crowns.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    group.add(trunks, crowns);
  }

  // texte du PMV le plus proche devant le joueur
  setVMSAhead(playerS, lines) {
    let best = null, bestD = Infinity;
    for (const v of this.vms) {
      const d = wrap(v.s - playerS, this.track.length);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best) best.panel.setText(lines);
  }
}
