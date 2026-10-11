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
const HEAVY = ['bus', 'fourgon', 'livraison', 'depanneuse', 'municipal', 'camionnette', 'trafic', 'semi', 'cargo'];
const EMERG_IDS = ['police', 'samu', 'pompiers'];

// niveaux de trafic : 0 fluide · 1 dense · 2 heure de pointe (très bouché)
export const TRAFFIC_LEVELS = [
  { key: 'fluide', label: 'Fluide', countMul: 0.75, cap: 44, winA: 420, winB: 160, onc: 1, moto: 0.10, inter: 0.55, gap0: 0.6, jamEvery: [3600, 6000], jamLen: [160, 300], jamSev: [0.4, 0.7], jamMin: 6, vms: 52, startV: 48, pExit: 0.10, entryEvery: 9, emergEvery: [110, 200] },
  { key: 'dense', label: 'Dense', countMul: 1.6, cap: 80, winA: 400, winB: 140, onc: 1.4, moto: 0.15, inter: 0.78, gap0: 0.72, jamEvery: [1500, 3200], jamLen: [280, 560], jamSev: [0.65, 0.95], jamMin: 3, vms: 29, startV: 40, pExit: 0.16, entryEvery: 4.5, emergEvery: [80, 150] },
  { key: 'bouche', label: 'Heure de pointe', countMul: 5.2, cap: 150, winA: 280, winB: 90, onc: 2.6, moto: 0.24, inter: 0.93, gap0: 0.86, jamEvery: [700, 1500], jamLen: [380, 780], jamSev: [0.88, 1.0], jamMin: 0, vms: 12, startV: 24, pExit: 0.2, entryEvery: 2.6, emergEvery: [60, 120] },
];

// personnalités de conduite
const PERSONAS = {
  normal: { T: 1, v0: 1, lc: 1, accept: 1, dur: 1.6 },
  presse: { T: 0.72, v0: 1.12, lc: 2.4, accept: 0.62, dur: 1.0 },
  dimanche: { T: 1.55, v0: 0.85, lc: 0.35, accept: 1.45, dur: 2.3 },
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
  get reserved() { return this.level === 2; } // voie de gauche réservée (covoiturage, taxis, bus, secours)

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
    const q = this.level === 2 ? Math.max(this.quality, 0.75) : this.quality;
    const day = this.level === 2 ? 1 : this.dayFactor;
    return {
      density: (1 + lap * CFG.LAP_DENSITY_GAIN) * LV.countMul,
      speederFrac: clamp((this.level === 2 ? 0.02 : 0.05) + lap * CFG.LAP_SPEEDER_GAIN, 0, 0.3),
      motoFrac: clamp(LV.moto + lap * CFG.LAP_MOTO_GAIN, 0, 0.45),
      count: Math.min(Math.round(CFG.NPC_BASE_COUNT * LV.countMul * (1 + lap * CFG.LAP_DENSITY_GAIN) * q * day), Math.round(LV.cap * Math.max(this.quality, 0.75))),
    };
  }

  localDensity(s) {
    const w = wave1(s * 0.00045 + this.time * 0.004, 3.7);
    const w2 = wave1(this.time * 0.01, 8.2);
    if (this.level === 2) return clamp(0.92 + w * 0.12 + w2 * 0.06, 0.8, 1.12);
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
    const personaKey = SPORT_IDS.includes(id) ? 'presse' : r < 0.18 ? 'presse' : r < 0.32 ? 'dimanche' : 'normal';
    const persona = PERSONAS[personaKey];
    const heavy = HEAVY.includes(id);
    const sport = SPORT_IDS.includes(id) || (m.sport && this.rand() < 0.5);
    let v0;
    if (sport || this.rand() < this.params().speederFrac) v0 = MS(82 + this.rand() * 32);
    else if (heavy) v0 = MS(42 + this.rand() * 10);
    else v0 = MS(44 + this.rand() * 16);
    v0 *= persona.v0;
    return {
      id, bundle: null, s, v: v0 * 0.9, v0,
      lane: 1, laneFrom: 1, laneTo: 1, laneT: 1, laneDur: persona.dur,
      mode: 'lane', gap: 0, gapFrom: 0, gapTo: 0, gapT: 1,
      len: m.dims[0], wid: m.dims[1], heavy,
      persona, personaKey, aggro: sport ? 0.85 : personaKey === 'presse' ? 0.75 : this.rand() * 0.55,
      eligible: !!(m.taxi || id === 'bus' || m.emergency || this.rand() < 0.28), // covoiturage, taxis, bus
      blinker: 0, hazardT: 0, brakeFlash: 0, panicAt: 200 + this.rand() * 900,
      yaw: 0, yieldOff: 0, passed: false,
      ramp: null, rampBlend: 0, exitPlan: null, decided: null, hornCd: 2 + this.rand() * 6, stuckT: 0,
      lat: 0, y: null, acc: 0,
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
      ? LV.winA * (init ? 0.04 + this.rand() * 0.96 : (this.level === 2 ? 0.72 : 0.55) + this.rand() * (this.level === 2 ? 0.28 : 0.45))
      : -LV.winB * (init ? 0.2 + this.rand() * 0.8 : 0.6 + this.rand() * 0.4)), this.track.length);
    const npc = this.makeNPC(id, s);
    const interfile = isMoto && this.rand() < LV.inter;
    const nl = this.laneCount(s);
    let lane;
    if (interfile) lane = 0;
    else if (npc.v0 > MS(70)) lane = this.rand() < 0.7 ? 0 : 1;
    else if (npc.heavy) lane = this.rand() < 0.65 ? 3 : 2;
    else lane = 1 + ((this.rand() * 3) | 0);
    if (lane > nl - 1) lane = Math.max(0, nl - 1 - ((this.rand() * Math.min(2, nl)) | 0));
    if (this.reserved && lane === 0 && !npc.eligible && nl > 2) lane = 1;
    if (this.reserved && npc.eligible && !interfile && this.rand() < 0.55) lane = 0;
    npc.lane = npc.laneFrom = npc.laneTo = lane;
    if (interfile) {
      npc.mode = 'interfile';
      const g = this.rand() < LV.gap0 ? 0 : this.gapMaxAt(s);
      npc.gap = npc.gapFrom = npc.gapTo = g;
    }
    npc.lat = this.computeLat(npc);
    const lim = Math.min(this.localLimit(s, interfile ? 1 : lane), this.baseLimit(s, interfile ? 1 : lane));
    npc.v = Math.min(npc.v, interfile ? Math.max(lim + MS(15), MS(22)) : lim);
    if (this.collides(npc, npc.lat)) return null;
    npc.bundle = this.acquire(id);
    this.npcs.push(npc);
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
    npc.lat = this.computeLat(npc);
    if (this.collides(npc, npc.lat)) return;
    npc.bundle = this.acquire(id);
    this.npcs.push(npc);
  }

  // véhicule de secours qui remonte par le corridor (entre voie 1 et voie 2)
  spawnEmergency(playerS) {
    const id = pick(this.rand, EMERG_IDS);
    const s = wrap(playerS - this.LV.winB * 0.95, this.track.length);
    const npc = this.makeNPC(id, s, { mode: 'emerg', eligible: true });
    npc.v0 = this.level === 2 ? MS(58) : MS(95);
    npc.v = npc.v0 * 0.8;
    npc.lat = interfileCenter(0);
    npc.persona = PERSONAS.normal;
    npc.bundle = this.acquire(id);
    npc.bundle.sirenOn = true;
    this.npcs.push(npc);
    this.sfx.push({ type: 'sirenStart', npc });
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
    const laneLat = lerp(laneCenter(n.laneFrom), laneCenter(n.laneTo), n.laneT) + n.yieldOff;
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
    const tries = this.level === 2 ? 6 : this.level === 1 ? 3 : 1;
    for (let k = 0; k < tries && this.npcs.length < target; k++) {
      if (this.rand() < 0.4) this.spawnNPC(playerS, this.rand() < (player.v > MS(20) ? 0.72 : 0.5));
    }
    if (this.ramps) {
      this.entryT = (this.entryT ?? 2) - dt;
      if (this.entryT <= 0) { this.entryT = LV.entryEvery * (0.5 + this.rand()); if (this.npcs.length < target * 1.15) this.spawnEntry(playerS); }
    }
    this.emergT = (this.emergT ?? lerp(LV.emergEvery[0], LV.emergEvery[1], this.rand()) * 0.5) - dt;
    if (this.emergT <= 0 && !this.npcs.some((n) => n.mode === 'emerg')) {
      this.emergT = lerp(LV.emergEvery[0], LV.emergEvery[1], this.rand());
      this.spawnEmergency(playerS);
    }

    // pré-calcul des positions latérales
    for (const n of this.npcs) n.lat = this.computeLat(n);
    const rel = (npc) => loopDelta(npc.s, playerS, L);
    this.npcs.sort((a, b) => rel(a) - rel(b));
    const playerObs = { s: playerS, lat: player.lat, v: player.v, len: player.len, wid: player.wid, isPlayer: true };
    const emergs = this.npcs.filter((n) => n.mode === 'emerg');
    this.motoBehindPlayer = false;
    this.emergBehindPlayer = null;
    for (const e of emergs) {
      const d = loopDelta(playerS, e.s, L);
      if (d > 0 && d < 110) this.emergBehindPlayer = { npc: e, dist: d };
    }
    const wet = this.wet;

    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      const myLat = n.lat;
      const special = n.mode === 'interfile' || n.mode === 'emerg';

      // — leader (même couloir) —
      let leader = null, gap = 1e9;
      for (let j = 0; j < this.npcs.length; j++) {
        if (j === i) continue;
        const o = this.npcs[j];
        const d = loopDelta(o.s, n.s, L);
        if (d <= 0.1 || d > 130) continue;
        const sp = special || o.mode === 'interfile' || o.mode === 'emerg';
        const thr = sp ? (o.wid + n.wid) / 2 + 0.15 : (o.wid + n.wid) / 2 + 0.55;
        if (Math.abs(o.lat - myLat) < thr) {
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

      // — vitesse désirée —
      const laneForLim = special ? 1 : n.lane;
      const lim = Math.min(this.localLimit(n.s, laneForLim), n.mode === 'emerg' ? Infinity : this.baseLimit(n.s, n.mode === 'interfile' ? n.gapTo : n.laneTo));
      let v0 = Math.min(n.v0 * (1 - 0.12 * wet), lim);
      if (n.mode === 'interfile') v0 = Math.min(n.v0, Math.max(lim + MS(this.level === 2 ? 22 : 18), MS(this.level === 2 ? 28 : 25)));
      if (n.mode === 'emerg') v0 = n.v0;
      if (n.mode === 'exit' || n.mode === 'enter') v0 = Math.min(v0, this.rampSpeed(n));
      if (n.exitPlan && n.mode === 'lane') v0 = Math.min(v0, this.exitApproachSpeed(n));
      n.panicAt -= n.v * dt;
      if (n.panicAt < 0) { n.panicAt = 500 + this.rand() * 1400; n.brakeFlash = 0.9 + this.rand() * 0.8; }
      if (n.brakeFlash > 0) { n.brakeFlash -= dt; v0 = Math.min(v0, n.v * 0.55); }

      // — IDM —
      const free = Math.max(1 - Math.pow(n.v / Math.max(v0, 0.1), 4), -2);
      let acc;
      const Tg = CFG.IDM_T * n.persona.T * (1 + 0.35 * wet);
      if (leader) {
        const dv = n.v - leader.v;
        const s0 = this.level === 2 ? 1.6 : CFG.IDM_S0;
        const sStar = s0 + Math.max(0, n.v * Tg + (n.v * dv) / (2 * Math.sqrt(CFG.IDM_A * CFG.IDM_B)));
        acc = CFG.IDM_A * (free - Math.pow(sStar / Math.max(gap, 0.5), 2));
      } else acc = CFG.IDM_A * free;
      if (v0 < 0.3 && n.v < 0.4) acc = Math.min(acc, 0);
      acc = clamp(acc, -8.5 * (1 - 0.25 * wet), 3.2);
      // warnings : gros freinage à l'approche d'un ralentissement
      if (acc < -3.2 && n.v > MS(30) && n.hazardT <= 0 && this.rand() < 0.6 && n.mode === 'lane') n.hazardT = 3 + this.rand() * 4;
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
        } else if (this.level >= 1 && n.v < MS(8) && near && this.rand() < (this.level === 2 ? 0.05 : 0.02)) {
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
      let targetYaw = n.laneT < 1 ? -(laneCenter(n.laneTo) - laneCenter(n.laneFrom)) * 0.035 * Math.sin(n.laneT * Math.PI) / (n.laneDur / 1.6) : 0;
      if (n.mode === 'interfile' && n.gapT < 1) targetYaw = -(interfileCenter(n.gapTo) - interfileCenter(n.gapFrom)) * 0.05 * Math.sin(n.gapT * Math.PI);
      if ((n.mode === 'exit' || n.mode === 'enter') && n.rampBlend > 0 && n.rampBlend < 1) targetYaw = (n.mode === 'exit' ? -0.06 : 0.06) * Math.sin(n.rampBlend * Math.PI);
      n.yaw = lerp(n.yaw, targetYaw + (n.mode === 'interfile' ? Math.sin(this.time * 2.2 + n.s) * 0.02 : 0), Math.min(1, dt * 6));
    }

    // recyclage hors fenêtre / fin de bretelle
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      const d = loopDelta(n.s, playerS, L);
      if (n.gone || d > LV.winA + 60 || d < -LV.winB - 60) {
        this.release(n.bundle);
        this.npcs.splice(i, 1);
      }
    }

    // — sens extérieur (décoratif) —
    while (this.oncoming.length < CFG.ONCOMING_COUNT * LV.onc * this.quality) {
      const id = pickWeighted(this.rand, CAR_IDS, CAR_W);
      this.oncoming.push({
        id, bundle: this.acquire(id),
        s: wrap(playerS + this.rand() * 700 - 100, L),
        v: this.level === 2 ? MS(6 + this.rand() * 26) : MS(40 + this.rand() * 25),
        lane: (this.rand() * (this.track.lanesAt ? this.track.lanesAt(playerS) : CFG.LANES)) | 0,
        len: CATALOG[id].dims[0],
      });
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
      n.laneT = Math.min(1, n.laneT + dt / n.laneDur);
      if (n.laneT >= 1) { n.lane = n.laneTo; n.laneFrom = n.laneTo; if (!n.exitPlan) n.blinker = 0; n.laneDur = n.persona.dur; }
    } else {
      // voie réservée en heure de pointe : les non-autorisés la quittent
      if (this.reserved && n.lane === 0 && !n.eligible && this.laneCount(n.s) > 2 && this.rand() < dt * 0.8) {
        if (this.gapOK(n, 1, playerObs, 0.8)) this.startLaneChange(n, 1);
      } else if (n.lane > right) {
        if (this.gapOK(n, n.lane - 1, playerObs, 0.6)) this.startLaneChange(n, n.lane - 1);
      } else if (this.rand() < dt * (0.12 + n.aggro * 0.3) * n.persona.lc) {
        this.considerLaneChange(n, leader, gap, playerObs);
      }
    }
    // fermeture de voie devant → rabattement obligatoire
    if (this.laneClosedAt(n.s, n.laneTo, 170) && n.laneT >= 1) {
      const dir = n.laneTo >= 3 ? -1 : (n.laneTo <= 0 ? 1 : (this.laneClosedAt(n.s, n.laneTo - 1, 170) ? 1 : -1));
      this.startLaneChange(n, clamp(n.laneTo + dir, 0, CFG.LANES - 1));
    }
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
          if (dj < 70) n.laneDur = 0.85; // changement de voie de dernière seconde
          this.startLaneChange(n, n.lane + 1);
        } else if (dj < 25 && n.lane < right - 1) { n.exitPlan = null; n.blinker = 0; } // sortie ratée
      } else if (n.laneT >= 1 && n.lane === right) {
        const o = this.ramps.one(n.exitPlan.r, n.s, 0);
        if (o && o.w > n.wid + 0.4 && o.gap < 1.2 && this.rampFree(n, n.exitPlan.r)) {
          n.mode = 'exit'; n.ramp = n.exitPlan.r; n.rampBlend = 0; n.blinker = 1;
        }
      }
    }
  }

  isBusyExit(j) {
    if (this.level === 0) return false;
    const h = Math.abs(Math.sin(j.s * 12.9898) * 43758.5453) % 1;
    return h < (this.level === 2 ? 0.55 : 0.3);
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
    if (n.rampBlend < 1) n.rampBlend = Math.min(1, n.rampBlend + dt / 2.0);
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
      const accept = (remain < 30 ? 0.42 : 0.9) * n.persona.accept; // force un peu pour s'insérer
      const right = this.rightLane(n.s);
      if (this.gapOK(n, right, playerObs, accept, true)) {
        n.lane = n.laneFrom = n.laneTo = right; n.laneT = 1;
        n.merging = true; n.rampBlend = 0.999;
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
    for (const target of options) {
      if (this.laneClosedAt(n.s, target, 120)) continue;
      if (this.gapOK(n, target, playerObs, n.persona.accept)) {
        // « queue de poisson » des pressés : changement court
        n.laneDur = n.personaKey === 'presse' && this.rand() < 0.4 ? 0.9 : n.persona.dur;
        this.startLaneChange(n, target);
        return;
      }
    }
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
      if (Math.abs(loopDelta(o.s, n.s, this.track.length)) < 80 && !check(o, o.lat)) return false;
    }
    if (!check(playerObs, playerObs.lat)) return false;
    return true;
  }

  startLaneChange(n, target) {
    if (target === n.laneTo) return;
    n.laneFrom = n.lane;
    n.laneTo = target;
    n.laneT = 0;
    n.blinker = target > n.lane ? 1 : -1;
  }

  // ---------- placement (poignées instanciées) ----------------------------
  place() {
    const track = this.track;
    const p = this._p;
    for (const n of this.npcs) {
      track.pointAt(n.s, p);
      const lat = n.lat = this.computeLat(n);
      const h = n.bundle;
      const g = h.group;
      g.position.set(p.x + p.rx * lat, n.y ?? p.y, p.z + p.rz * lat);
      g.rotation.set(0, Math.atan2(p.tx, p.tz) + n.yaw, n.mode === 'interfile' ? -n.yaw * 6 : 0);
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
    const n0 = Math.round(this.params().count * (this.level === 2 ? 0.9 : 0.6));
    for (let i = 0; i < n0 * 3 && this.npcs.length < n0; i++) this.spawnNPC(playerS, this.rand() < 0.78, true);
  }
}
