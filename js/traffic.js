// ============================================================
// Périph' Rush — IA de trafic (v16)
// Suivi IDM, changements de voie avec clignotant, personnalités
// (normal / pressé / « du dimanche »), motos en interfile, bouchons
// et ondes accordéon selon le niveau, voie de gauche réservée en
// heure de pointe, insertions depuis les bretelles d'entrée et
// sorties par les bretelles (files d'attente aux sorties chargées),
// véhicules de secours avec corridor, warnings, klaxons.
// Rendu : poignées instanciées (fleet.js).
// ============================================================

import { CFG, MS, laneCenter, interfileCenter } from './config.js';
import { CATALOG, TRAFFIC_IDS } from './vehicles.js';
import { rng, clamp, lerp, wrap, loopDelta, wave1, pickWeighted, pick, smoothstep } from './utils.js';

const CAR_IDS = TRAFFIC_IDS.filter((id) => CATALOG[id].kind !== 'moto');
const CAR_W = CAR_IDS.map((id) => CATALOG[id].w);
const MOTO_IDS = TRAFFIC_IDS.filter((id) => CATALOG[id].kind === 'moto');
const MOTO_W = MOTO_IDS.map((id) => CATALOG[id].w);
const SPORT_IDS = ['furia'];
const HEAVY = ['bus', 'fourgon', 'livraison', 'depanneuse', 'municipal', 'camionnette', 'trafic', 'semi', 'semi_pv', 'semi_cit', 'semi_frigo', 'cargo', 'pro_btp', 'pro_loc', 'pro_demen'];
const EMERG_IDS = ['police', 'police', 'police', 'samu', 'smur', 'pompiers', 'crs'];

// niveaux de trafic : 0 fluide · 1 chargé · 3 dense (accordéon) · 2 heure de pointe (très bouché)
// (l'indice 3 a été ajouté en v19 : l'ordre d'affichage est 0, 1, 3, 2)
export const TRAFFIC_LEVELS = [
  { key: 'fluide', label: 'Fluide', countMul: 0.75, cap: 44, winA: 420, winB: 160, onc: 1, moto: 0.10, inter: 0.68, gap0: 0.6, jamEvery: [3600, 6000], jamLen: [160, 300], jamSev: [0.4, 0.7], jamMin: 6, vms: 52, startV: 48, pExit: 0.10, entryEvery: 6, emergEvery: [110, 200] },
  { key: 'charge', label: 'Chargé', countMul: 1.6, cap: 80, winA: 400, winB: 140, onc: 1.4, moto: 0.15, inter: 0.8, gap0: 0.72, jamEvery: [1500, 3200], jamLen: [280, 560], jamSev: [0.65, 0.95], jamMin: 3, vms: 29, startV: 40, pExit: 0.16, entryEvery: 3.4, emergEvery: [80, 150] },
  { key: 'bouche', label: 'Heure de pointe', countMul: 5.2, cap: 150, winA: 280, winB: 90, onc: 2.6, moto: 0.24, inter: 0.9, gap0: 0.86, jamEvery: [700, 1500], jamLen: [380, 780], jamSev: [0.88, 1.0], jamMin: 0, vms: 12, startV: 24, pExit: 0.2, entryEvery: 2.1, emergEvery: [60, 120] },
  // v19 : très chargé mais ça roule — coups de frein soudains (ondes de freinage qui remontent la file)
  // puis ça repart vite, sans arrêt prolongé
  { key: 'accordeon', label: 'Dense', countMul: 3.1, cap: 120, winA: 330, winB: 115, onc: 2.0, moto: 0.2, inter: 0.85, gap0: 0.8, jamEvery: [1400, 2600], jamLen: [160, 320], jamSev: [0.55, 0.8], jamMin: 10, vms: 24, startV: 36, pExit: 0.18, entryEvery: 2.5, emergEvery: [70, 140] },
];
export const TRAFFIC_ORDER = [0, 1, 3, 2];

// personnalités de conduite
// dur : durée du changement de voie (s) ; aLat : accélération latérale max (m/s²)
const PERSONAS = {
  normal: { T: 1, v0: 1, lc: 1, accept: 1, dur: 2.7, aLat: 2.9 },
  presse: { T: 0.72, v0: 1.12, lc: 2.4, accept: 0.62, dur: 1.9, aLat: 4.0 },
  dimanche: { T: 1.55, v0: 0.85, lc: 0.35, accept: 1.45, dur: 3.4, aLat: 2.1 },
  // v22 : livreurs pressés et chauffards — collent, déboîtent à gauche comme à droite, se rabattent sec
  zigzag: { T: 0.5, v0: 1, lc: 7, accept: 0.36, dur: 1.25, aLat: 4.8 },
};

export class Traffic {
  constructor(THREE, scene, track, factory, fleet) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.factory = factory;
    this.fleet = fleet;
    this.rand = rng(20260710);
    this.npcs = [];
    this.oncoming = [];
    this.jams = [];
    this.closures = [];
    this.slowZones = [];
    this.sfx = [];          // klaxons, sirènes… (consommés par game.js → audio)
    this.lap = 0;
    this.time = 0;
    this.nextJamAt = 2500;
    this.level = 1;
    this.wet = 0;
    this.dayFactor = 1;     // densité selon l'heure (nuit plus calme)
    this.quality = 1;
    this._p = {};
  }

  get LV() { return TRAFFIC_LEVELS[this.level] || TRAFFIC_LEVELS[1]; }
  get reserved() { return this.level === 2; }
  get busy() { return this.level === 2 || this.level === 3; } // très chargé (pointe ou accordéon)

  // ---------- poignées de rendu -----------------------------------------
  acquire(id) {
    const m = CATALOG[id];
    const color = m.cols[(this.rand() * m.cols.length) | 0];
    return this.fleet.add(id, { color });
  }
  release(h) { if (h) this.fleet.remove(h); }

  // ---------- difficulté --------------------------------------------------
  params() {
    const lap = this.lap, LV = this.LV;
    const q = this.busy ? Math.max(this.quality, 0.75) : this.quality;
    const day = this.busy ? 1 : this.dayFactor;
    return {
      density: (1 + lap * CFG.LAP_DENSITY_GAIN) * LV.countMul,
      speederFrac: clamp((this.busy ? 0.03 : 0.05) + lap * CFG.LAP_SPEEDER_GAIN, 0, 0.3),
      chauffardFrac: clamp((this.busy ? 0.035 : 0.05) + lap * 0.015, 0, 0.12),
      motoFrac: clamp(LV.moto + lap * CFG.LAP_MOTO_GAIN, 0, 0.45),
      count: Math.min(Math.round(CFG.NPC_BASE_COUNT * LV.countMul * (1 + lap * CFG.LAP_DENSITY_GAIN) * q * day), Math.round(LV.cap * Math.max(this.quality, 0.75))),
    };
  }

  localDensity(s) {
    const w = wave1(s * 0.00045 + this.time * 0.004, 3.7);
    const w2 = wave1(this.time * 0.01, 8.2);
    if (this.level === 2) return clamp(0.92 + w * 0.12 + w2 * 0.06, 0.8, 1.12);
    if (this.level === 3) return clamp(0.9 + w * 0.12 + w2 * 0.08, 0.78, 1.12);
    return clamp(0.55 + w * 0.45 + w2 * 0.2, 0.08, 1.35);
  }

  // congestion de fond : zones lentes (dense), ondes accordéon avec arrêts (pointe)
  baseLimit(s, lane) {
    if (this.level === 0) return Infinity;
    const t = this.time;
    if (this.level === 1) {
      const c = smoothstep(0.15, 0.85, 0.5 + 0.5 * wave1(s * 0.0011 + t * 0.012, 5.3));
      return lerp(MS(52), MS(24 + lane * 2), c);
    }
    if (this.level === 3) {
      // ondes de freinage courtes qui remontent la file (~18 km/h) : on freine fort,
      // on descend vers 10-20 km/h puis ça relance aussitôt vers 45-50 km/h
      const g = 0.5 + 0.5 * wave1(s * 0.0006 + t * 0.004, 4.4);
      const ph = (s + t * 5.2) / (300 + 120 * g) + lane * 0.37 + 0.5 * wave1(s * 0.0003, 9.1);
      const x = ph - Math.floor(ph);                 // 0..1 dans l'onde
      const dip = x < 0.16 ? smoothstep(0, 0.05, x) * (1 - smoothstep(0.07, 0.16, x)) : 0;
      return lerp(MS(46 + g * 6), MS(9 + g * 9 + lane * 1.5), dip);
    }
    const ph = (s + t * 4.6) / 330 + lane * 0.55 + 0.6 * wave1(s * 0.0004, 2.1);
    const f = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
    const g = 0.5 + 0.5 * wave1(s * 0.0007 + t * 0.003, 7.7);
    let v = Math.max(0, MS(-8) + MS(30 + g * 16) * smoothstep(0.05, 0.95, f));
    if (lane === 0) v = Math.max(v, MS(28 + g * 14)); // voie réservée : ça roule
    return v;
  }

  laneCount(s) { return this.track.lanesAt ? Math.min(this.track.lanesAt(s), this.track.lanesAt(s + 120)) : CFG.LANES; }
  rightLane(s) { return Math.max(0, this.laneCount(s) - 1); }

  get ramps() { return this.track.ramps; }
  rampOf(j, kind) {
    if (!this._rampMap) {
      this._rampMap = new Map();
      for (const r of this.ramps?.list || []) if (r.j) this._rampMap.set(r.j, r);
    }
    const r = this._rampMap.get(j);
    return r && r.kind === kind ? r : null;
  }
  rampGeom(n) {
    const p = this._p;
    this.track.pointAt(n.s, p);
    return this.ramps.one(n.ramp, n.s, p.y);
  }

  // ---------- apparition --------------------------------------------------
  pickId(isMoto) {
    const P = this.params();
    if (isMoto) return pickWeighted(this.rand, MOTO_IDS, MOTO_W);
    if (this.rand() < P.speederFrac * 0.35) return pick(this.rand, SPORT_IDS);
    return pickWeighted(this.rand, CAR_IDS, CAR_W);
  }

  makeNPC(id, s, extra = {}) {
    const m = CATALOG[id];
    const r = this.rand();
    // v22 : zigzagueurs — la plupart des fourgons de livraison, quelques chauffards en voiture
    const zz = !extra.mode && m.kind !== 'moto' && !m.emergency && (m.zz ? this.rand() < 0.8
      : !HEAVY.includes(id) && m.kind !== 'bus' && this.rand() < this.params().chauffardFrac);
    const personaKey = zz || SPORT_IDS.includes(id) ? 'presse' : r < 0.18 ? 'presse' : r < 0.32 ? 'dimanche' : 'normal';
    const persona = zz ? PERSONAS.zigzag : PERSONAS[personaKey];
    const heavy = HEAVY.includes(id);
    const sport = SPORT_IDS.includes(id) || (m.sport && this.rand() < 0.5);
    let v0;
    if (zz) v0 = m.zz ? MS(70 + this.rand() * 16) : MS(84 + this.rand() * 30);
    else if (sport || this.rand() < this.params().speederFrac) v0 = MS(82 + this.rand() * 32);
    else if (heavy) v0 = MS(42 + this.rand() * 10);
    else v0 = MS(44 + this.rand() * 16);
    if (m.slow) v0 = MS(40 + this.rand() * 8);   // auto-école : prudente
    v0 *= persona.v0;
    // style de freinage : la grande majorité anticipe et freine en douceur ; une minorité
    // freine tard et fort (plus fréquente chez les pressés) ; de rares conducteurs
    // « erratiques » donnent des coups de frein sans raison
    const rb = this.rand();
    const lateP = personaKey === 'presse' ? 0.38 : personaKey === 'dimanche' ? 0.06 : 0.16;
    const style = zz ? 'tardif' : m.slow ? 'doux' : rb < 0.035 ? 'erratique' : rb < 0.035 + lateP ? 'tardif' : 'doux';
    return {
      zz,
      style, b: style === 'tardif' ? 4.2 + this.rand() * 0.8 : style === 'erratique' ? 3.0 : 1.5 + this.rand() * 0.5,
      id, bundle: null, s, v: v0 * 0.9, v0,
      lane: 1, laneFrom: 1, laneTo: 1, laneT: 1, laneDur: persona.dur,
      mode: 'lane', gap: 0, gapFrom: 0, gapTo: 0, gapT: 1,
      len: m.dims[0], wid: m.dims[1], heavy,
      persona, personaKey, aggro: zz ? 0.97 : m.slow ? 0.1 : sport ? 0.85 : personaKey === 'presse' ? 0.75 : this.rand() * 0.55,
      eligible: !!(m.taxi || id === 'bus' || m.emergency || this.rand() < 0.28), // covoiturage, taxis, bus
      blinker: 0, hazardT: 0, brakeFlash: 0, panicAt: 1500 + this.rand() * 4000,
      yaw: 0, yieldOff: 0, passed: false,
      ramp: null, rampBlend: 0, exitPlan: null, decided: null, hornCd: 2 + this.rand() * 6, stuckT: 0,
      lat: 0, latT: 0, y: null, acc: 0,
      // dynamique : cap (rad, + vers la droite), braquage, roulis/tangage suspendus, inclinaison moto
      h: 0, steer: 0, latAcc: 0, roll: 0, rollV: 0, pitch: 0, pitchV: 0, lean: 0,
      wb: m.wb || m.dims[0] * 0.6, moto: m.kind === 'moto',
      aLat: (m.kind === 'moto' ? 1.6 : HEAVY.includes(id) ? 0.6 : 1) * persona.aLat,
      ...extra,
    };
  }

  collides(npc, lat) {
    for (const o of this.npcs) {
      if (Math.abs(loopDelta(o.s, npc.s, this.track.length)) < (o.len + npc.len) / 2 + 3.5 + Math.min(npc.v, 15) * 0.6
        && Math.abs(o.lat - lat) < ((o.mode === 'interfile' || npc.mode === 'interfile') ? 1.2 : 2.4)) return true;
    }
    return false;
  }

  spawnNPC(playerS, ahead, init = false) {
    const P = this.params(), LV = this.LV;
    const isMoto = this.rand() < P.motoFrac;
    const id = this.pickId(isMoto);
    const s = wrap(playerS + (ahead
      ? LV.winA * (init ? 0.04 + this.rand() * 0.96 : (this.busy ? 0.72 : 0.55) + this.rand() * (this.busy ? 0.28 : 0.45))
      : -LV.winB * (init ? 0.2 + this.rand() * 0.8 : 0.6 + this.rand() * 0.4)), this.track.length);
    const npc = this.makeNPC(id, s);
    const interfile = isMoto && this.rand() < LV.inter;
    const nl = this.laneCount(s);
    let lane;
    if (interfile) lane = 0;
    else if (npc.zz) lane = (this.rand() * 4) | 0;
    else if (npc.v0 > MS(70)) lane = this.rand() < 0.7 ? 0 : 1;
    else if (npc.heavy) lane = this.rand() < 0.65 ? 3 : 2;
    else lane = 1 + ((this.rand() * 3) | 0);
    if (lane > nl - 1) lane = Math.max(0, nl - 1 - ((this.rand() * Math.min(2, nl)) | 0));
    if (this.reserved && lane === 0 && !npc.eligible && nl > 2) lane = 1;
    if (this.reserved && npc.eligible && !interfile && this.rand() < 0.55) lane = 0;
    npc.lane = npc.laneFrom = npc.laneTo = lane;
    // motos dans leur voie : calées sur le tiers gauche, plutôt vives
    if (isMoto && !interfile) { npc.laneOff = -0.45 - this.rand() * 0.25; npc.lc = 1.6; }
    if (interfile) {
      npc.mode = 'interfile';
      const g = this.rand() < LV.gap0 ? 0 : this.gapMaxAt(s);
      npc.gap = npc.gapFrom = npc.gapTo = g;
    }
    npc.lat = npc.latT = this.computeLat(npc);
    const lim = Math.min(this.localLimit(s, interfile ? 1 : lane), this.baseLimit(s, interfile ? 1 : lane));
    npc.v = Math.min(npc.v, interfile ? Math.max(lim + MS(15), MS(22)) : lim);
    if (this.collides(npc, npc.lat)) return null;
    npc.bundle = this.acquire(id);
    if (CATALOG[id].emergency) npc.bundle.sirenOn = false;   // motards en patrouille : feux éteints
    this.npcs.push(npc);
    // v22 : les motards de la police patrouillent en binôme
    if (id === 'police_moto' && interfile && !this._pairing) {
      this._pairing = true;
      const s2 = wrap(s - 14 - this.rand() * 8, this.track.length);
      const n2 = this.makeNPC(id, s2);
      Object.assign(n2, { mode: 'interfile', gap: npc.gap, gapFrom: npc.gap, gapTo: npc.gap, v: npc.v, v0: npc.v0, lane: 0, laneFrom: 0, laneTo: 0 });
      n2.lat = n2.latT = this.computeLat(n2);
      if (!this.collides(n2, n2.lat)) { n2.bundle = this.acquire(id); n2.bundle.sirenOn = false; this.npcs.push(n2); }
      this._pairing = false;
    }
    return npc;
  }

  // voiture qui arrive par une bretelle d'entrée (hors de vue, devant)
  spawnEntry(playerS) {
    const L = this.track.length, LV = this.LV;
    const cands = this.track.entries.filter((e) => {
      const d = wrap(e.s - playerS, L);
      return d > 150 && d < LV.winA + 120 && this.rampOf(e, 'E');
    });
    if (!cands.length) return;
    const e = pick(this.rand, cands), r = this.rampOf(e, 'E');
    const s = wrap(e.s - (40 + this.rand() * 150), L);
    if (wrap(s - playerS, L) < 110 || wrap(s - playerS, L) > LV.winA) return;
    const id = this.pickId(this.rand() < 0.08);
    const npc = this.makeNPC(id, s, { mode: 'enter', ramp: r, rampBlend: 1 });
    const right = this.rightLane(e.s);
    npc.lane = npc.laneFrom = npc.laneTo = right;
    npc.v = MS(28 + this.rand() * 14);
    npc.lat = npc.latT = this.computeLat(npc);
    if (this.collides(npc, npc.lat)) return;
    npc.bundle = this.acquire(id);
    this.npcs.push(npc);
  }

  // file d'attente à une sortie chargée : la bretelle est pleine et la file
  // déborde sur la voie de droite du périph (créée hors de vue, devant)
  spawnExitQueue(playerS) {
    if (!this.ramps || this.level === 0) return;
    const L = this.track.length;
    const nx = this.track.nextExit(wrap(playerS + 120, L));
    if (!nx.exit || nx.dist > this.LV.winA - 40) return;
    const j = nx.exit, r = this.rampOf(j, 'X');
    if (!r || !this.isBusyExit(j)) return;
    if (this._queued === j) return;          // une seule fois par passage
    this._queued = j;
    const want = this.level === 2 ? 14 : this.level === 3 ? 10 : 6;
    const spill = this.level === 2 ? 5 : this.level === 3 ? 3 : 0; // véhicules qui attendent sur la voie de droite
    let sq = wrap(j.s + r.div * 0.8, L);
    let onR = 0, onL = 0;
    for (let k = 0; k < 40; k++) {
      const dp = loopDelta(sq, playerS, L);
      if (dp < 110) break;                   // jamais sous les yeux du joueur
      if (dp > this.LV.winA + 40) { sq = wrap(sq - 7, L); continue; } // hors fenêtre de simulation
      const onRamp = loopDelta(sq, j.s, L) > -r.par + 6;
      if (onRamp ? onR >= want : onL >= spill) { if (!onRamp) break; sq = wrap(sq - 7, L); continue; }
      const id = this.pickId(this.rand() < 0.06);
      const npc = this.makeNPC(id, sq, onRamp ? { mode: 'exit', ramp: r, rampBlend: 1 } : {});
      const right = this.rightLane(sq);
      npc.lane = npc.laneFrom = npc.laneTo = right;
      npc.exitPlan = { j, r, busy: true };
      npc.decided = j;
      npc.blinker = 1;
      npc.v = 0;
      npc.lat = npc.latT = this.computeLat(npc);
      // pas de test de collision entre véhicules de la file (espacement maîtrisé) : seulement le reste du trafic
      const clash = this.npcs.some((o) => !o.exitPlan && Math.abs(loopDelta(o.s, npc.s, L)) < (o.len + npc.len) / 2 + 1.5 && Math.abs(o.lat - npc.lat) < 2.2);
      if (!clash) { npc.bundle = this.acquire(id); this.npcs.push(npc); if (onRamp) onR++; else onL++; }
      sq = wrap(sq - npc.len - 2.2 - this.rand() * 1.8, L);
    }
  }

  // véhicule de secours qui remonte par le corridor (entre voie 1 et voie 2)
  spawnEmergency(playerS) {
    const id = pick(this.rand, EMERG_IDS);
    // les CRS circulent en convoi (2 à 4 fourgons, parfois ouvert par une voiture de police)
    const convoy = id === 'crs' ? (this.rand() < 0.4 ? ['police', 'crs', 'crs', 'crs'] : ['crs', 'crs', 'crs']).slice(0, 2 + ((this.rand() * 3) | 0)) : [id];
    const v0 = this.level === 2 ? MS(58) : this.level === 3 ? MS(72) : MS(95);
    convoy.forEach((cid, k) => {
      const s = wrap(playerS - this.LV.winB * 0.8 - k * 15, this.track.length);
      const npc = this.makeNPC(cid, s, { mode: 'emerg', eligible: true });
      npc.v0 = v0 * (1 - k * 0.01);
      npc.v = npc.v0 * 0.8;
      npc.lat = npc.latT = interfileCenter(0);
      npc.persona = PERSONAS.normal;
      npc.convoy = k;
      npc.bundle = this.acquire(cid);
      npc.bundle.sirenOn = true;
      this.npcs.push(npc);
      if (k === 0) this.sfx.push({ type: 'sirenStart', npc });
    });
  }

  gapMaxAt(s) {
    if (!this.track.lanesAt) return 1;
    return Math.min(this.track.lanesAt(s), this.track.lanesAt(s + 160)) < 3 ? 0 : 1;
  }

  // position latérale (repère de la chaussée principale)
  computeLat(n) {
    if (n.mode === 'interfile') {
      const base = n.gapT >= 1 ? interfileCenter(n.gapTo) : lerp(interfileCenter(n.gapFrom), interfileCenter(n.gapTo), smoothstep(0, 1, n.gapT));
      return base + n.yieldOff;
    }
    if (n.mode === 'emerg') return interfileCenter(0);
    const laneLat = lerp(laneCenter(n.laneFrom), laneCenter(n.laneTo), n.laneT) + n.yieldOff + (n.laneOff || 0);
    if ((n.mode === 'exit' || n.mode === 'enter') && n.ramp) {
      const o = this.rampGeom(n);
      if (!o) return laneLat;
      n.y = o.hr;
      const rl = this.track.mainEdgeAt(n.s) + o.gap + o.w * 0.5;
      return lerp(laneLat, rl, smoothstep(0, 1, n.rampBlend));
    }
    n.y = null;
    return laneLat;
  }
  latOf(n) { return n.lat; }

  // le couloir d'interfile visé est-il libre (autre moto proche) ?
  gapFree(n, gap) {
    for (const o of this.npcs) {
      if (o === n || o.mode !== 'interfile') continue;
      if (o.gapTo !== gap && o.gapFrom !== gap) continue;
      const d = loopDelta(o.s, n.s, this.track.length);
      if (d > -12 && d < 18) return false;
    }
    return true;
  }

  // vitesse cible locale (bouchons, fermetures, chantiers)
  localLimit(s, lane) {
    let lim = Infinity;
    for (const j of this.jams) {
      const d = loopDelta(s, j.s, this.track.length);
      if (d > -j.len / 2 && d < j.len / 2) {
        const ease = Math.sin(Math.min(j.age / 4, 1) * Math.PI / 2) * Math.min(1, Math.max(0, (j.life - j.age) / 6));
        const laneEase = 1 - (this.level === 2 ? 0.12 : 0.35) * Math.abs(Math.sin(j.age * 0.5 + lane * 1.8));
        let floor = MS(this.LV.jamMin + lane * (this.level === 2 ? 1.2 : 2.4));
        if (this.reserved && lane === 0) floor = MS(14);
        lim = Math.min(lim, Math.max(0, lerp(MS(50), floor, j.sev * ease * laneEase)));
      }
    }
    for (const z of this.slowZones) {
      const d = wrap(s - z.s0, this.track.length);
      if (d < wrap(z.s1 - z.s0, this.track.length)) lim = Math.min(lim, z.v);
    }
    return lim;
  }

  laneClosedAt(s, lane, lookahead = 0) {
    for (const c of this.closures) {
      const d = wrap(c.s0 - s, this.track.length);
      const inside = wrap(s - c.s0, this.track.length) < wrap(c.s1 - c.s0, this.track.length);
      if ((inside || d < lookahead) && c.lanes.includes(lane)) return true;
    }
    return false;
  }

  // ---------- mise à jour principale --------------------------------------
  update(dt, player, events) {
    this.time += dt;
    this.sfx.length = 0;
    const track = this.track;
    const L = track.length;
    const playerS = player.s;
    const LV = this.LV;
    this.closures = (events ? events.closures : []).concat(this.track.laneDrops || []);
    this.slowZones = events ? events.slowZones : [];
    this.oppZones = events && events.oppZones ? events.oppZones : [];

    // bouchons fantômes
    this.nextJamAt -= Math.max(player.v, MS(8)) * dt;
    if (this.nextJamAt <= 0) {
      this.jams.push({
        s: wrap(playerS + 700 + this.rand() * 900, L),
        len: lerp(LV.jamLen[0], LV.jamLen[1], this.rand()),
        sev: lerp(LV.jamSev[0], LV.jamSev[1], this.rand()),
        age: 0, life: (this.level === 2 ? 40 : 26) + this.rand() * 30,
      });
      this.nextJamAt = lerp(LV.jamEvery[0], LV.jamEvery[1], this.rand()) / (1 + this.lap * CFG.LAP_DENSITY_GAIN);
    }
    for (const j of this.jams) { j.age += dt; j.s = wrap(j.s - dt * 1.2, L); }
    this.jams = this.jams.filter((j) => j.age < j.life);

    // population, entrées, secours
    const laneK = Math.max(0.6, this.laneCount(playerS) / CFG.LANES);
    const target = Math.round(this.params().count * this.localDensity(playerS) * laneK);
    const tries = this.level === 2 ? 6 : this.level === 3 ? 5 : this.level === 1 ? 3 : 1;
    for (let k = 0; k < tries && this.npcs.length < target; k++) {
      if (this.rand() < 0.4) this.spawnNPC(playerS, this.rand() < (player.v > MS(20) ? 0.72 : 0.5));
    }
    if (this.ramps) {
      this.entryT = (this.entryT ?? 2) - dt;
      if (this.entryT <= 0) { this.entryT = LV.entryEvery * (0.5 + this.rand()); if (this.npcs.length < target * 1.2) this.spawnEntry(playerS); }
      this.queueT = (this.queueT ?? 0) - dt;
      if (this.queueT <= 0) { this.queueT = 1.5; this.spawnExitQueue(playerS); }
    }
    this.emergT = (this.emergT ?? lerp(LV.emergEvery[0], LV.emergEvery[1], this.rand()) * 0.5) - dt;
    if (this.emergT <= 0 && !this.npcs.some((n) => n.mode === 'emerg')) {
      this.emergT = lerp(LV.emergEvery[0], LV.emergEvery[1], this.rand());
      this.spawnEmergency(playerS);
    }

    // pré-calcul des positions latérales
    for (const n of this.npcs) n.latT = this.computeLat(n); // trajectoire visée ; n.lat = position réelle
    const rel = (npc) => loopDelta(npc.s, playerS, L);
    this.npcs.sort((a, b) => rel(a) - rel(b));
    // positions relatives figées pour cette image : la recherche du meneur ne parcourt
    // que les véhicules situés devant (tableau trié), au lieu de tout le trafic
    const relArr = this.npcs.map(rel);
    const playerObs = { s: playerS, lat: player.lat, v: player.v, len: player.len, wid: player.wid, isPlayer: true };
    const emergs = this.npcs.filter((n) => n.mode === 'emerg' || n.mode === 'chase');
    this.motoBehindPlayer = false;
    this.emergBehindPlayer = null;
    for (const e of emergs) {
      const d = loopDelta(playerS, e.s, L);
      if (d > 0 && d < 110) this.emergBehindPlayer = { npc: e, dist: d };
    }
    const wet = this.wet;

    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (n.mode === 'chase') continue; // motard en poursuite : piloté par police.js
      const myLat = n.lat;
      const myMoving = Math.abs(n.latT - n.lat) > 0.4;
      const special = n.mode === 'interfile' || n.mode === 'emerg';

      // — leader (même couloir) —
      let leader = null, gap = 1e9;
      for (let j = Math.max(0, i - 4); j < this.npcs.length; j++) {
        if (j === i) continue;
        if (relArr[j] - relArr[i] > 140) break;
        const o = this.npcs[j];
        const d = loopDelta(o.s, n.s, L);
        if (d <= 0.1 || d > 130) continue;
        const sp = special || o.mode === 'interfile' || o.mode === 'emerg' || o.mode === 'chase';
        const thr = sp ? (o.wid + n.wid) / 2 + 0.15 : (o.wid + n.wid) / 2 + 0.55;
        // couloir occupé maintenant, couloir visé pendant un déport, et
        // véhicule devant qui se rabat dans notre couloir (on lui laisse la place)
        const hit = Math.abs(o.lat - myLat) < thr
          || (myMoving && Math.abs(o.lat - n.latT) < thr && d < 45)
          || (Math.abs(o.latT - o.lat) > 0.4 && Math.abs(o.latT - myLat) < thr - 0.2 && d < 30);
        // fermeture à franchir : on laisse s'insérer « en fermeture éclair » le véhicule arrêté devant
        const zip = !hit && n.mode === 'lane' && o.mergeReq != null && o.mergeReq === n.laneTo && n.laneT >= 1 && d < 24
          && Math.abs(o.lat - myLat) < 4.4 && !(n.personaKey === 'presse' && n.aggro > 0.8);
        if (hit || zip) {
          const g = d - (o.len + n.len) / 2;
          if (g < gap) { gap = g; leader = o; }
        }
      }
      {
        const d = loopDelta(playerObs.s, n.s, L);
        const thr = special ? (playerObs.wid + n.wid) / 2 + 0.2 : (playerObs.wid + n.wid) / 2 + 0.55;
        if (d > 0.1 && d < 130 && Math.abs(playerObs.lat - myLat) < thr) {
          const g = d - (playerObs.len + n.len) / 2;
          if (g < gap) { gap = g; leader = playerObs; }
        }
      }

      // fermeture de voie (accident, travaux, voie supprimée) : obstacle fixe
      if (n.mode === 'lane') {
        for (const c of this.closures) {
          if (!c.lanes.includes(n.lane) || (n.laneT < 1 && !c.lanes.includes(n.laneTo) && n.laneT > 0.5)) continue;
          const d = loopDelta(c.s0, n.s, L);
          if (d > 0 && d < 140) {
            const g2 = d - n.len / 2 - 1.5;
            if (g2 < gap) { gap = Math.max(0.3, g2); leader = { v: 0, s: c.s0, len: 0, wid: 0 }; }
          }
        }
      }

      // — vitesse désirée —
      const laneForLim = special ? 1 : n.lane;
      // ondes de ralentissement de fond : elles ne concernent que les véhicules en peloton
      // (quelqu'un devant à moins de ~45 m) — personne ne freine sur une route dégagée
      const inPlatoon = n.mode !== 'lane' || (leader && gap < 45);
      const lim = Math.min(this.localLimit(n.s, laneForLim), n.mode === 'emerg' || !inPlatoon ? Infinity : this.baseLimit(n.s, n.mode === 'interfile' ? n.gapTo : n.laneTo));
      let v0 = Math.min(n.v0 * (1 - 0.12 * wet), lim);
      if (n.mode === 'interfile') v0 = Math.min(n.v0, Math.max(lim + MS(this.level === 2 ? 22 : 18), MS(this.level === 2 ? 28 : 25)));
      if (n.mode === 'emerg') v0 = n.v0;
      if (n.mode === 'exit' || n.mode === 'enter') v0 = Math.min(v0, this.rampSpeed(n));
      if (n.exitPlan && n.mode === 'lane') v0 = Math.min(v0, this.exitApproachSpeed(n));
      if (n.reactCd > 0) n.reactCd -= dt;
      if (n.blockT > 0) { // conducteur vexé : il cale sa vitesse sous la vôtre et ne cède pas
        n.blockT -= dt;
        const dp = loopDelta(n.s, playerS, L);
        if (dp > 0 && dp < 40) v0 = Math.min(v0, Math.max(MS(15), player.v - 2.5));
        else n.blockT = 0;
      }
      // coups de frein inexpliqués : seulement les rares conducteurs erratiques, espacés
      if (n.style === 'erratique' && n.mode === 'lane' && n.v > MS(25)) {
        n.panicAt -= n.v * dt;
        if (n.panicAt < 0) { n.panicAt = 2500 + this.rand() * 5000; n.brakeFlash = 0.6 + this.rand() * 0.6; }
      }
      if (n.brakeFlash > 0) { n.brakeFlash -= dt; v0 = Math.min(v0, n.v * 0.7); }

      // — IDM —
      let free = Math.max(1 - Math.pow(n.v / Math.max(v0, 0.1), 4), -2);
      // accélération de confort : relances franches en trafic dense (on « recolle » vite)
      const A = CFG.IDM_A * (this.level === 3 ? 1.25 : 1) * (n.heavy ? 0.7 : 1) * (n.personaKey === 'presse' ? 1.15 : n.personaKey === 'dimanche' ? 0.85 : 1);
      // ralentir vers une vitesse cible plus basse (bouchon annoncé, zone lente) : décélération
      // de confort propre au conducteur, pas un coup de frein
      if (free < 0 && n.mode !== 'emerg' && !(n.brakeFlash > 0)) free = Math.max(free, -(n.b * (n.style === 'tardif' ? 0.9 : 0.55)) / A);
      let acc;
      const Tg = CFG.IDM_T * n.persona.T * (1 + 0.35 * wet) * (n.style === 'tardif' ? 0.85 : 1);
      if (leader) {
        const dv = n.v - leader.v;
        const s0 = this.level === 2 ? 1.6 : this.level === 3 ? 1.9 : CFG.IDM_S0;
        const sStar = s0 + Math.max(0, n.v * Tg + (n.v * dv) / (2 * Math.sqrt(A * (n.b || CFG.IDM_B))));
        acc = A * (free - Math.pow(sStar / Math.max(gap, 0.5), 2));
      } else acc = A * free;
      if (v0 < 0.3 && n.v < 0.4) acc = Math.min(acc, 0);
      acc = clamp(acc, -8.5 * (1 - 0.25 * wet), 3.2);
      // temps de réaction / douceur : la pédale ne passe pas instantanément d'un extrême à l'autre
      // (le freinage peut s'établir vite, l'accélération reprend progressivement)
      // mise en freinage progressive pour les conducteurs doux (sauf urgence : distance très courte)
      const urgent = leader && gap < Math.max(4, n.v * 0.6);
      const onset = urgent || n.style !== 'doux' || n.brakeFlash > 0 ? 24 : 7;
      acc = acc < n.acc ? Math.max(acc, n.acc - onset * dt) : Math.min(acc, n.acc + 5.5 * dt);
      // warnings : gros freinage à l'approche d'un ralentissement
      if (acc < -3.2 && n.v > MS(30) && n.hazardT <= 0 && this.rand() < (n.style === 'tardif' ? 0.7 : 0.45) && n.mode === 'lane') n.hazardT = 3 + this.rand() * 4;
      if (n.hazardT > 0) n.hazardT -= dt;
      n.acc = acc;
      n.v = Math.max(0, n.v + acc * dt);
      n.s = wrap(n.s + n.v * dt, L);

      // — klaxons —
      n.hornCd -= dt;
      if (leader === playerObs && gap < 7 && n.v < MS(12) && player.v < n.v0 * 0.5) n.stuckT += dt; else n.stuckT = Math.max(0, n.stuckT - dt);
      if (n.hornCd <= 0) {
        const near = Math.abs(loopDelta(n.s, playerS, L)) < 90;
        if (n.stuckT > 2.2 && near) {
          this.sfx.push({ type: n.mode === 'emerg' ? 'airhorn' : CATALOG[n.id].kind === 'moto' ? 'mhorn' : 'horn', s: n.s, lat: n.lat });
          if (n.mode === 'interfile') this.motoBehindPlayer = true;
          n.hornCd = 2.5 + this.rand() * 3;
        } else if (this.level >= 1 && n.v < MS(8) && near && this.rand() < (this.level === 2 ? 0.05 : this.level === 3 ? 0.035 : 0.02)) {
          this.sfx.push({ type: 'horn', s: n.s, lat: n.lat, far: true });
          n.hornCd = 8 + this.rand() * 12;
        } else n.hornCd = 1 + this.rand() * 2;
      }
      if (n.mode === 'interfile' && leader === playerObs && gap < 14) this.motoBehindPlayer = true;

      // — modes —
      if (n.mode === 'lane') this.updateLaneMode(n, leader, gap, playerObs, dt);
      else if (n.mode === 'interfile') this.updateInterfile(n, dt);
      else if (n.mode === 'exit') this.updateExit(n, dt);
      else if (n.mode === 'enter') this.updateEnter(n, playerObs, dt);

      // corridor pour les secours
      let yt = 0;
      for (const e of emergs) {
        const d = loopDelta(e.s, n.s, L); // <0 : secours derrière n
        if (e !== n && d > -130 && d < 12) {
          if (n.mode === 'lane') yt = n.laneTo === 0 ? -0.75 : n.laneTo === 1 ? 1.0 : 0.45;
          else if (n.mode === 'interfile' && n.gapTo === 0) {
            if (n.gapT >= 1 && this.gapMaxAt(n.s) >= 1 && this.gapFree(n, 1)) { n.gapFrom = 0; n.gapTo = 1; n.gapT = 0; }
            else yt = -1.2;
          }
        }
      }
      n.yieldOff = lerp(n.yieldOff, yt, Math.min(1, dt * 1.3));

      // lacet visuel
      this.dynamics(n, dt);
    }
    this.resolveOverlaps(playerObs);

    // recyclage hors fenêtre / fin de bretelle
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      const d = loopDelta(n.s, playerS, L);
      if (n.mode === 'chase' && !n.gone) continue;
      if (n.gone || d > LV.winA + 60 || d < -LV.winB - 60) {
        this.release(n.bundle);
        this.npcs.splice(i, 1);
      }
    }

    // — sens extérieur (décoratif) —
    while (this.oncoming.length < CFG.ONCOMING_COUNT * LV.onc * this.quality) {
      const id = pickWeighted(this.rand, CAR_IDS, CAR_W);
      const so = wrap(playerS + this.rand() * 700 - 100, L);
      const laneO = (this.rand() * (this.track.lanesAt ? this.track.lanesAt(playerS) : CFG.LANES)) | 0;
      if (this.oncoming.some((q) => q.lane === laneO && Math.abs(loopDelta(q.s, so, L)) < 14)) break;
      this.oncoming.push({
        id, bundle: this.acquire(id),
        s: so,
        v: this.level === 2 ? MS(6 + this.rand() * 26) : this.level === 3 ? MS(18 + this.rand() * 30) : MS(40 + this.rand() * 25),
        lane: laneO,
        len: CATALOG[id].dims[0],
      });
    }
    // sens extérieur : suivi simple par voie (ils roulent vers les s décroissants)
    for (const o of this.oncoming) {
      o.v0 = o.v0 ?? o.v;
      let gap = 1e9, lead = null;
      for (const q of this.oncoming) {
        if (q === o || q.lane !== o.lane) continue;
        const d = loopDelta(o.s, q.s, L) - (o.len + q.len) / 2; // q devant o si o.s > q.s
        if (d > -0.5 && d < gap) { gap = d; lead = q; }
      }
      let want = lead ? Math.min(o.v0, lead.v + (gap - 6) * 0.5) : o.v0;
      for (const z of this.oppZones) if (wrap(o.s - z.s0, L) < wrap(z.s1 - z.s0, L)) want = Math.min(want, MS(16)); // curiosité
      o.v = Math.max(0, o.v + clamp(want - o.v, -6 * dt, 2 * dt));
      if (lead && gap < 1.5) o.v = Math.min(o.v, lead.v);
    }
    for (let i = this.oncoming.length - 1; i >= 0; i--) {
      const o = this.oncoming[i];
      o.s = wrap(o.s - o.v * dt, L);
      const d = loopDelta(o.s, playerS, L);
      if (d < -120 || d > 850) {
        this.release(o.bundle);
        this.oncoming.splice(i, 1);
      }
    }

    this.place(player);
  }

  // ---------- voie normale : changements, plan de sortie ------------------
  updateLaneMode(n, leader, gap, playerObs, dt) {
    const L = this.track.length;
    const right = this.rightLane(n.s);
    if (n.laneT < 1) {
      // un changement de voie ne progresse que si le véhicule avance (pas de glissade latérale à l'arrêt)
      n.signalT = (n.signalT || 0) - dt;
      // arrêté en plein déport : on termine au pas (ou on renonce en première moitié, cf. ci-dessous)
      n.stopMidT = n.v < 0.8 && n.signalT <= 0 ? (n.stopMidT || 0) + dt : 0;
      const moveF = n.signalT > 0 ? 0 : Math.max(clamp((n.v - 0.3) / 4.5, 0, 1), n.stopMidT > 1.5 ? 0.35 : 0);
      n.laneT = Math.min(1, n.laneT + (dt / n.laneDur) * moveF);
      // on s'engage franchement ou on renonce : en première moitié, si la place se referme, retour dans sa voie
      n.lcCheck = (n.lcCheck || 0) - dt;
      if (!n.forced && n.laneT < 0.5 && n.lcCheck <= 0) {
        n.lcCheck = 0.2;
        if (!this.gapOK(n, n.laneTo, playerObs, 0.42 * n.persona.accept)) this.abortLaneChange(n);
      }
      if (n.laneT >= 1) { n.lane = n.laneTo; n.laneFrom = n.laneTo; n.forced = false; if (!n.exitPlan) n.blinker = 0; n.laneDur = n.persona.dur; }
    } else {
      // voie réservée en heure de pointe : les non-autorisés la quittent
      if (this.reserved && n.lane === 0 && !n.eligible && this.laneCount(n.s) > 2 && this.rand() < dt * 0.8) {
        if (this.gapOK(n, 1, playerObs, 0.8)) this.startLaneChange(n, 1);
      } else if (n.lane > right) {
        if (this.gapOK(n, n.lane - 1, playerObs, 0.6)) this.startLaneChange(n, n.lane - 1);
      } else if (!(n.blockT > 0) && n.v > 3 && this.rand() < dt * (0.1 + n.aggro * 0.26) * n.persona.lc * (this.busy && !n.zz ? 0.5 : 1)) {
        // changements de confort seulement en roulant (jamais dans une file arrêtée)
        this.considerLaneChange(n, leader, gap, playerObs);
      }
    }
    // fermeture de voie devant → rabattement obligatoire, en fermeture éclair si ça bouchonne
    n.mergeReq = null;
    if (this.laneClosedAt(n.s, n.laneTo, 170) && n.laneT >= 1) {
      const dir = n.laneTo >= 3 ? -1 : (n.laneTo <= 0 ? 1 : (this.laneClosedAt(n.s, n.laneTo - 1, 170) ? 1 : -1));
      const target = clamp(n.laneTo + dir, 0, CFG.LANES - 1);
      const close = n.v < 3;
      n.mergeWait = close ? (n.mergeWait || 0) + dt : Math.max(0, (n.mergeWait || 0) - dt);
      if (close) n.mergeReq = target;
      n.blinker = dir;
      const accept = Math.max(0.22, 0.55 - (n.mergeWait || 0) * 0.06);
      if (this.gapOK(n, target, playerObs, accept, close)) { this.startLaneChange(n, target); n.forced = true; n.laneDur = Math.min(n.laneDur, 2.2); }
    } else n.mergeWait = 0;
    // — sorties —
    if (!this.ramps || CATALOG[n.id].kind === 'moto' && n.mode !== 'lane') return;
    const nx = this.track.nextExit(n.s);
    if (nx.exit && nx.exit !== n.decided && nx.dist < 480 && nx.dist > 200) {
      n.decided = nx.exit;
      const r = this.rampOf(nx.exit, 'X');
      const pE = this.LV.pExit + (n.lane >= right - 1 ? 0.12 : 0) + (n.heavy ? 0.05 : 0);
      if (r && this.rand() < pE) n.exitPlan = { j: nx.exit, r, busy: this.isBusyExit(nx.exit) };
    }
    if (n.exitPlan) {
      const dj = loopDelta(n.exitPlan.j.s, n.s, L); // >0 : sortie devant
      if (dj < -40) { n.exitPlan = null; n.blinker = 0; return; }
      if (dj < 320) n.blinker = 1;
      if (n.laneT >= 1 && n.lane < right) {
        // se rabattre à droite, de plus en plus pressé
        const urg = clamp(1 - dj / 300, 0, 1);
        const accept = lerp(1, 0.45, urg) * n.persona.accept;
        if (this.rand() < dt * (1.2 + urg * 4) && this.gapOK(n, n.lane + 1, playerObs, accept)) {
          if (dj < 70) n.laneDur = 1.6; // changement de voie de dernière seconde
          this.startLaneChange(n, n.lane + 1);
          n.forced = dj < 120;
        } else if (dj < 25 && n.lane < right - 1) { n.exitPlan = null; n.blinker = 0; } // sortie ratée
      } else if (n.laneT >= 1 && n.lane === right) {
        const o = this.ramps.one(n.exitPlan.r, n.s, 0);
        if (o && o.w > n.wid + 0.4 && o.g < 1.2 && this.rampFree(n, n.exitPlan.r)) {
          n.mode = 'exit'; n.ramp = n.exitPlan.r; n.rampBlend = 0; n.blinker = 1;
        }
      }
    }
  }

  isBusyExit(j) {
    if (this.level === 0) return false;
    const h = Math.abs(Math.sin(j.s * 12.9898) * 43758.5453) % 1;
    return h < (this.level === 2 ? 0.55 : this.level === 3 ? 0.4 : 0.3);
  }
  // voie de décélération / bretelle libre devant le véhicule ?
  rampFree(n, r) {
    for (const o of this.npcs) {
      if (o === n || o.ramp !== r) continue;
      const d = loopDelta(o.s, n.s, this.track.length);
      if (d > -(o.len + n.len) / 2 - 3 && d < (o.len + n.len) / 2 + 4 + n.v * 0.6) return false;
    }
    return true;
  }
  exitApproachSpeed(n) {
    // attente en voie de droite si la bretelle est saturée
    const L = this.track.length, dj = loopDelta(n.exitPlan.j.s, n.s, L);
    if (n.lane !== this.rightLane(n.s) || dj > 160) return Infinity;
    return this.rampFree(n, n.exitPlan.r) || dj > 90 ? Infinity : MS(6);
  }
  rampSpeed(n) {
    const o = this.rampGeom(n);
    if (!o) return MS(40);
    if (n.mode === 'exit') {
      if (n.exitPlan?.busy && o.t > 0.25) return this.level === 2 ? MS(5 + 10 * (0.5 + 0.5 * Math.sin(this.time * 0.35 + n.s * 0.01))) : MS(16);
      return o.vv > 0 ? MS(38) : MS(46);
    }
    // entrée : on attend en bout de voie d'accélération si personne ne laisse passer
    if (o.vv < 0) {
      const remain = n.ramp.par + n.ramp.taper * 0.6 + o.vv;
      if (remain < 14) return MS(Math.max(0, remain - 4));
    }
    return MS(48);
  }

  updateExit(n, dt) {
    if (n.rampBlend < 1) n.rampBlend = Math.min(1, n.rampBlend + dt / 3.0);
    else n.blinker = 0;
    const o = this.rampGeom(n);
    if (!o || o.t > 0.9) n.gone = true; // a quitté le périphérique
  }

  updateEnter(n, playerObs, dt) {
    const o = this.rampGeom(n);
    if (!o) { n.mode = 'lane'; n.ramp = null; n.rampBlend = 0; return; }
    if (n.rampBlend < 1 && n.merging) {
      n.rampBlend = Math.max(0, n.rampBlend - dt / n.laneDur);
      if (n.rampBlend <= 0) { n.mode = 'lane'; n.ramp = null; n.merging = false; n.blinker = 0; }
      return;
    }
    if (o.parallel && o.vv < 0) {
      n.blinker = -1;
      const remain = n.ramp.par + n.ramp.taper * 0.6 + o.vv;
      // priorité aux véhicules qui entrent : on force le passage, de plus en plus au bout de la voie
      const accept = (remain < 40 ? 0.2 : remain < 80 ? 0.35 : 0.55) * n.persona.accept;
      n.mergeReq = this.rightLane(n.s);
      const right = this.rightLane(n.s);
      if (this.gapOK(n, right, playerObs, accept, true)) {
        n.lane = n.laneFrom = n.laneTo = right; n.laneT = 1;
        n.merging = true; n.rampBlend = 0.999;
        n.laneDur = 1.4 + this.rand() * 0.9; // insertion franche
      }
    }
  }

  updateInterfile(n, dt) {
    const gmax = this.gapMaxAt(n.s);
    if (n.gapT < 1) {
      n.gapT = Math.min(1, n.gapT + dt / 2.2);
      if (n.gapT >= 1) { n.gapFrom = n.gapTo; n.gap = n.gapTo; }
    } else if (n.gapTo > gmax) {
      n.gapFrom = n.gapTo; n.gapTo = 0; n.gapT = 0;
    } else if (gmax >= 1 && this.rand() < dt * 0.025) {
      const want = this.rand() < this.LV.gap0 ? 0 : 1;
      if (want !== n.gapTo && this.gapFree(n, want)) { n.gapFrom = n.gapTo; n.gapTo = want; n.gapT = 0; }
    }
  }

  considerLaneChange(n, leader, gap, playerObs) {
    const right = this.rightLane(n.s);
    if (n.zz) { this.zigzag(n, leader, gap, playerObs, right); return; }
    const wantFaster = leader && gap < 45 && leader.v < n.v0 * 0.82;
    const wantLeft = n.aggro > 0.7 && n.lane > 0;
    const wantRight = n.aggro < 0.3 && n.lane < right && this.rand() < 0.3;
    // courtoisie : laisser s'insérer une voiture en bout de voie d'accélération
    let courtesy = false;
    if (n.lane === right && n.lane > 0) {
      for (const o of this.npcs) {
        if (o.mode !== 'enter') continue;
        const d = loopDelta(o.s, n.s, this.track.length);
        if (d > -5 && d < 60) { courtesy = this.rand() < (n.personaKey === 'dimanche' ? 0.8 : n.personaKey === 'presse' ? 0.15 : 0.5); break; }
      }
    }
    if (!wantFaster && !wantLeft && !wantRight && !courtesy) return;
    const options = [];
    if (n.lane > 0 && !(this.reserved && n.lane - 1 === 0 && !n.eligible)) options.push(n.lane - 1);
    if (n.lane < right && !courtesy && !n.exitPlan) options.push(n.lane + 1);
    if (n.exitPlan) return;
    // intérêt réel du changement (MOBIL simplifié) : la voie visée doit avancer mieux
    const here = leader && gap < 60 ? Math.min(leader.v, n.v0) : n.v0;
    for (const target of options) {
      if (this.laneClosedAt(n.s, target, 120)) continue;
      const tl = this.laneLeader(n, target, playerObs);
      const there = tl && tl.gap < 60 ? Math.min(tl.o.v, n.v0) : n.v0;
      const keepRight = target > n.lane && (wantRight || courtesy);
      const need = keepRight ? -1.2 : (n.personaKey === 'presse' ? 1.0 : 2.2) + (this.busy ? 1.2 : 0);
      if (there - here < need) continue;
      if (tl && tl.gap < Math.max(8, n.v * 1.2)) continue; // pas de place pour s'y installer
      if (this.gapOK(n, target, playerObs, n.persona.accept)) {
        // « queue de poisson » des pressés : changement court
        n.laneDur = n.personaKey === 'presse' && this.rand() < 0.4 ? 1.5 : n.persona.dur;
        this.startLaneChange(n, target);
        return;
      }
    }
  }

  // v22 : zigzagueur — dès qu'il est gêné, il déboîte du côté qui avance le mieux (à droite aussi),
  // accepte des créneaux courts et se rabattra sec devant celui qu'il vient de dépasser
  zigzag(n, leader, gap, playerObs, right) {
    if (n.exitPlan) return;
    const here = leader && gap < 80 ? Math.min(leader.v, n.v0) : n.v0;
    if (!(leader && gap < 70 && leader.v < n.v0 * 0.95)) return;
    let best = null;
    for (const target of [n.lane - 1, n.lane + 1]) {
      if (target < 0 || target > right) continue;
      if (this.reserved && target === 0 && !n.eligible) continue;
      if (this.laneClosedAt(n.s, target, 120)) continue;
      const tl = this.laneLeader(n, target, playerObs);
      const there = tl && tl.gap < 70 ? Math.min(tl.o.v, n.v0) : n.v0;
      if (there - here < 0.3 && !(tl && tl.gap > gap + 12)) continue;
      if (tl && tl.gap < Math.max(6, n.v * 0.7)) continue;
      const score = there + (target < n.lane ? 0.4 : 0) + this.rand() * 0.8;
      if (!best || score > best.score) best = { target, score };
    }
    if (best && this.gapOK(n, best.target, playerObs, n.persona.accept)) {
      n.laneDur = n.persona.dur * (0.85 + this.rand() * 0.3);
      this.startLaneChange(n, best.target);
      n.signalT = this.rand() < 0.5 ? 0.05 : 0.25;   // clignotant au dernier moment… ou pas du tout
      if (this.rand() < 0.35) n.blinker = 0;
    }
  }

  // ---------- klaxon / appel de phares du joueur ---------------------------
  // Le conducteur devant réagit selon son tempérament : il s'écarte, s'en
  // moque, pile d'un coup (« coup de frein ») ou devient agressif (bouche le
  // passage, klaxonne en retour). Jamais systématique : sinon trop facile.
  playerSignal(kind, player) {
    const L = this.track.length;
    let target = null, best = 1e9;
    const range = kind === 'flash' ? 55 : 35;
    for (const n of this.npcs) {
      if (n.mode !== 'lane' && n.mode !== 'interfile') continue;
      const d = loopDelta(n.s, player.s, L);
      if (d <= 0 || d > range || Math.abs(n.lat - player.lat) > 1.7) continue;
      if (d < best) { best = d; target = n; }
    }
    if (!target) return null;
    const n = target;
    if (n.reactCd > 0) return null;          // déjà sollicité il y a peu : il ne change pas d'avis
    n.reactCd = 5 + this.rand() * 4;
    const r = this.rand();
    const P = n.personaKey === 'dimanche' ? [0.42, 0.75, 0.97] : n.personaKey === 'presse' ? [0.1, 0.38, 0.7] : [0.28, 0.72, 0.88];
    let type = r < P[0] ? 'move' : r < P[1] ? 'ignore' : r < P[2] ? 'brake' : 'block';
    if (n.mode === 'interfile') type = r < 0.4 ? 'ignore' : 'move';
    if (type === 'move') {
      if (n.mode === 'interfile') { n.yieldOff = (n.yieldOff || 0) + 0.6; type = 'ignore'; }
      else {
        const right = this.rightLane(n.s);
        const playerObs = { s: player.s, lat: player.lat, v: player.v, len: player.len, wid: player.wid, isPlayer: true };
        const opts = n.laneTo < right ? [n.laneTo + 1, n.laneTo - 1] : [n.laneTo - 1];
        const ok = opts.find((t) => t >= 0 && t <= right && n.laneT >= 1 && !this.laneClosedAt(n.s, t, 80) && this.gapOK(n, t, playerObs, 0.7));
        if (ok != null) { this.startLaneChange(n, ok); n.signalT = 0.3; }
        else type = 'ignore';
      }
    }
    if (type === 'brake') { n.brakeFlash = 0.6 + this.rand() * 0.6; n.hazardT = 0; }
    if (type === 'block') {
      n.blockT = 5 + this.rand() * 5;      // reste devant, ralentit pour vous embêter
      this.sfx.push({ type: n.moto ? 'mhorn' : 'horn', s: n.s, lat: n.lat });
    } else if (type === 'ignore' && this.rand() < 0.25) this.sfx.push({ type: n.moto ? 'mhorn' : 'horn', s: n.s, lat: n.lat });
    return type;
  }

  // meneur dans une voie donnée (devant n)
  laneLeader(n, lane, playerObs) {
    const L = this.track.length, c = laneCenter(lane);
    let best = null;
    const test = (o) => {
      if (o === n) return;
      const d = loopDelta(o.s, n.s, L);
      if (d <= 0 || d > 90) return;
      if (Math.abs(o.lat - c) > 1.6 && Math.abs((o.latT ?? o.lat) - c) > 1.0) return;
      const g = d - (o.len + n.len) / 2;
      if (!best || g < best.gap) best = { o, gap: g };
    };
    for (const o of this.npcs) if (o.mode !== 'exit') test(o);
    if (playerObs) test(playerObs);
    return best;
  }

  abortLaneChange(n) {
    const f = n.laneFrom;
    n.laneFrom = n.laneTo;
    n.laneTo = f;
    n.lane = f;
    n.laneT = 1 - n.laneT;
    n.laneDur = Math.min(n.laneDur, 2.0);
    n.blinker = 0;
    n.forced = true; // on ne renonce qu'une fois : retour franc dans sa voie
  }

  gapOK(n, lane, playerObs, accept = 1, fromRamp = false) {
    const lat = laneCenter(lane);
    const check = (o, oLat) => {
      const d = loopDelta(o.s, n.s, this.track.length);
      if (Math.abs(oLat - lat) > (o.wid + n.wid) / 2 + 0.5) return true;
      if (d > 0) return d - (o.len + n.len) / 2 > (n.v * 0.9 + 4) * accept;
      return -d - (o.len + n.len) / 2 > Math.max(fromRamp ? 3 : 6, ((o.v - n.v) * 1.4 + 5) * accept);
    };
    for (const o of this.npcs) {
      if (o === n || o.mode === 'exit' || o.mode === 'enter' && !o.merging) continue;
      if (Math.abs(loopDelta(o.s, n.s, this.track.length)) < 80 && (!check(o, o.lat) || (Math.abs(o.latT - o.lat) > 0.4 && !check(o, o.latT)))) return false;
    }
    if (!check(playerObs, playerObs.lat)) return false;
    return true;
  }

  startLaneChange(n, target) {
    if (target === n.laneTo) return;
    n.laneFrom = n.lane;
    n.laneTo = target;
    n.laneT = 0;
    n.forced = false;
    n.lcCheck = 0.35;
    // clignotant AVANT de se déporter (les pressés le mettent au dernier moment)
    n.signalT = n.personaKey === 'presse' ? 0.3 + this.rand() * 0.4 : 0.7 + this.rand() * 0.7;
    n.blinker = target > n.lane ? 1 : -1;
  }

  // ---------- dynamique du véhicule ----------------------------------------
  // Modèle « bicyclette » : le conducteur vise la trajectoire (latT) par
  // poursuite pure ; braquage borné par l'accélération latérale admise et
  // par la vitesse de rotation du volant ; le cap fait avancer le véhicule
  // de côté (pas de translation latérale « magique »). Roulis et tangage
  // passent par une suspension amortie ; la moto s'incline dans le virage.
  dynamics(n, dt) {
    const v = Math.max(n.v, 0.9);
    const err = n.latT - n.lat;
    const look = Math.max(6, v * 1.6);
    const hd = Math.atan2(err * 1.15, look);
    const wb = n.wb;
    let dDes = Math.atan((2 * wb * Math.sin(hd - n.h)) / look);
    const aMax = n.mode === 'emerg' ? 4 : n.mode === 'chase' ? 6.5 : n.aLat * (1 - 0.3 * this.wet);
    const dMax = Math.min(0.5, Math.atan((aMax * wb) / (v * v)));
    dDes = clamp(dDes, -dMax, dMax);
    const rate = n.moto ? 1.5 : n.heavy ? 0.6 : 0.85;   // vitesse de braquage (rad/s aux roues)
    n.steer += clamp(dDes - n.steer, -rate * dt, rate * dt);
    // cinématique avec la VRAIE vitesse : à l'arrêt, ni lacet ni déplacement latéral
    const vr = Math.max(n.v, 0);
    const hDot = (vr / wb) * Math.tan(n.steer);
    n.h = clamp(n.h + hDot * dt, -0.32, 0.32);
    n.lat += vr * Math.sin(n.h) * dt;
    // quasi à l'arrêt mais à cheval (corridor des secours, fin de déport) : on se recale
    // en avançant au pas, volant braqué — jamais plus de quelques secondes entre deux voies
    if (n.v < 0.8 && Math.abs(err) > 0.25 && n.mode !== 'exit' && n.mode !== 'enter') {
      n.creepT = (n.creepT || 0) + dt;
      if (n.creepT > (Math.abs(n.yieldOff) > 0.2 ? 0.3 : 1.2)) {
        const st = Math.sign(err) * Math.min(Math.abs(err), 0.45 * dt);
        n.lat += st;
        n.h += (clamp(err * 0.12, -0.12, 0.12) - n.h) * Math.min(1, dt * 3);
        n.steer += (clamp(err * 0.3, -0.45, 0.45) - n.steer) * Math.min(1, dt * 3);
      }
    } else n.creepT = 0;
    if (Math.abs(err) < 0.02 && Math.abs(n.h) < 0.002) { n.h *= 0.9; n.steer *= 0.9; }
    const latAcc = vr * hDot;
    n.latAcc = lerp(n.latAcc, latAcc, Math.min(1, dt * 8));
    if (n.moto) {
      // contre-braquage / inclinaison d'équilibre + léger louvoiement à basse vitesse
      const weave = n.v < 4 ? Math.sin(this.time * 3 + n.s) * 0.05 * (1 - n.v / 4) : 0;
      const leanT = Math.atan(n.latAcc / 9.81) + weave;
      n.lean += (leanT - n.lean) * Math.min(1, dt * 7);
      n.pitch += (-n.acc * 0.006 - n.pitch) * Math.min(1, dt * 6);
      return;
    }
    // suspension : ressort-amortisseur sur le roulis et le tangage
    const kR = n.heavy ? 0.024 : 0.015, kP = n.heavy ? 0.009 : 0.011;
    const rT = clamp(-n.latAcc * kR, -0.08, 0.08), pT = clamp(-n.acc * kP, -0.04, 0.07);
    const w = 9, z = 0.55;
    n.rollV += ((rT - n.roll) * w * w - 2 * z * w * n.rollV) * dt;
    n.roll += n.rollV * dt;
    n.pitchV += ((pT - n.pitch) * w * w - 2 * z * w * n.pitchV) * dt;
    n.pitch += n.pitchV * dt;
  }

  // ---------- garde-fou : aucun véhicule ne doit en traverser un autre -------
  resolveOverlaps(playerObs) {
    const L = this.track.length;
    const list = this.npcs;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const ds = loopDelta(b.s, a.s, L); // > 0 : b devant a
        const lon = (a.len + b.len) / 2 + 0.35 - Math.abs(ds);
        if (lon <= 0) { if (ds > 0) break; else continue; }
        const latOv = (a.wid + b.wid) / 2 + 0.1 - Math.abs(b.lat - a.lat);
        if (latOv <= 0) continue;
        // celui qui se déporte renonce et se remet dans son couloir ;
        // sinon le suiveur recule et cale sa vitesse sur celle du meneur
        const aMoving = Math.abs(a.latT - a.lat) > 0.25, bMoving = Math.abs(b.latT - b.lat) > 0.25;
        const mover = aMoving && !bMoving ? a : bMoving && !aMoving ? b : null;
        if (mover && latOv < 0.9) {
          const other = mover === a ? b : a;
          const sgn = Math.sign(mover.lat - other.lat) || 1;
          mover.lat += sgn * latOv;
          mover.h *= 0.3; mover.steer = 0;
          if (mover.mode === 'lane' && mover.laneT < 1 && !mover.forced) this.abortLaneChange(mover);
          continue;
        }
        const lead = ds > 0 ? b : a, foll = ds > 0 ? a : b;
        foll.s = wrap(lead.s - Math.sign(ds || 1) * 0 - ((a.len + b.len) / 2 + 0.36), L);
        foll.v = Math.min(foll.v, lead.v);
      }
    }
  }

  // ---------- placement (poignées instanciées) ----------------------------
  place() {
    const track = this.track;
    const p = this._p;
    for (const n of this.npcs) {
      track.pointAt(n.s, p);
      const lat = n.lat;
      const h = n.bundle;
      const g = h.group;
      g.position.set(p.x + p.rx * lat, (n.y ?? p.y) + (n.moto ? 0 : -Math.abs(n.roll) * 0.15), p.z + p.rz * lat);
      g.rotation.order = 'YXZ';
      // cap : + à gauche dans le repère du véhicule ; roulis de caisse / inclinaison de la moto
      g.rotation.set(n.pitch, Math.atan2(p.tx, p.tz) - n.h, n.moto ? n.lean : n.roll);
      h.steer = -n.steer;
      h.speed = n.v;
      h.brake.visible = n.acc < -0.9 || n.brakeFlash > 0 || n.v < 0.4;
      h.blink = n.hazardT > 0 ? 2 : n.blinker;
    }
    for (const o of this.oncoming) {
      track.pointAt(o.s, p);
      const lat = -laneCenter(o.lane);
      const g = o.bundle.group;
      g.position.set(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
      g.rotation.set(0, Math.atan2(p.tx, p.tz) + Math.PI, 0);
      o.bundle.speed = o.v;
      o.bundle.steer = 0;
      o.bundle.brake.visible = o.v < MS(10);
    }
  }

  setNightGlows(on) { this.fleet.night = on; }

  jamAhead(playerS) {
    for (const j of this.jams) {
      const d = wrap(j.s - playerS, this.track.length);
      if (d < 1500 && j.age < j.life * 0.7) return { dist: d, jam: j };
    }
    return null;
  }

  reset(playerS) {
    for (const n of this.npcs) this.release(n.bundle);
    for (const o of this.oncoming) this.release(o.bundle);
    this.npcs = [];
    this.oncoming = [];
    this.jams = [];
    this.lap = 0;
    this.time = 0;
    this.entryT = 2;
    this.emergT = undefined;
    this.nextJamAt = lerp(this.LV.jamEvery[0], this.LV.jamEvery[1], this.rand()) * 0.6;
    const n0 = Math.round(this.params().count * (this.busy ? 0.9 : 0.6));
    for (let i = 0; i < n0 * 3 && this.npcs.length < n0; i++) this.spawnNPC(playerS, this.rand() < 0.78, true);
  }
}
