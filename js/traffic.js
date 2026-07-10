// ============================================================
// Périph' Rush — IA de trafic sur voies
// Suivi de véhicule type IDM, changements de voie lisibles avec
// clignotant, motos en interfile, chauffards rares, vagues de
// densité, bouchons fantômes qui redémarrent, insertion aux portes.
// Le sens extérieur (décor) circule en face du séparateur.
// ============================================================

import { CFG, MS, laneCenter, interfileCenter } from './config.js';
import { CATALOG, TRAFFIC_IDS } from './vehicles.js';
import { rng, clamp, lerp, wrap, loopDelta, wave1, pickWeighted, pick } from './utils.js';

const CAR_IDS = TRAFFIC_IDS.filter((id) => CATALOG[id].kind !== 'moto');
const CAR_W = CAR_IDS.map((id) => CATALOG[id].w);
const MOTO_IDS = TRAFFIC_IDS.filter((id) => CATALOG[id].kind === 'moto');
const MOTO_W = MOTO_IDS.map((id) => CATALOG[id].w);
const SPORT_IDS = ['rs6', 'm5', 'c63s'];

export class Traffic {
  constructor(THREE, scene, track, factory) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.factory = factory;
    this.rand = rng(20260710);
    this.npcs = [];
    this.oncoming = [];
    this.pool = new Map(); // id → bundles libres
    this.jams = [];        // bouchons fantômes {s, len, sev, age, life}
    this.closures = [];    // fournies par events.js
    this.slowZones = [];
    this.lap = 0;
    this.time = 0;
    this.nextJamAt = 2500;
    this._v = new THREE.Vector3();
  }

  // ---------- pool de véhicules -----------------------------------------
  acquire(id) {
    const free = this.pool.get(id);
    if (free && free.length) {
      const b = free.pop();
      b.group.visible = true;
      return b;
    }
    const m = CATALOG[id];
    const color = m.cols[(this.rand() * m.cols.length) | 0];
    const dirt = this.rand() < 0.3 ? (this.rand() < 0.5 ? 1 : 2) : 0;
    const b = this.factory.build(id, { color, dirt });
    b.id = id;
    this.scene.add(b.group);
    return b;
  }
  release(b) {
    b.group.visible = false;
    b.brake.visible = false;
    if (!this.pool.has(b.id)) this.pool.set(b.id, []);
    const free = this.pool.get(b.id);
    if (free.length < 4) free.push(b);
    else { this.scene.remove(b.group); }
  }

  // ---------- difficulté --------------------------------------------------
  params() {
    const lap = this.lap;
    return {
      density: 1 + lap * CFG.LAP_DENSITY_GAIN,
      speederFrac: clamp(0.05 + lap * CFG.LAP_SPEEDER_GAIN, 0, 0.3),
      motoFrac: clamp(0.13 + lap * CFG.LAP_MOTO_GAIN, 0, 0.4),
      count: Math.min(Math.round(CFG.NPC_BASE_COUNT * (1 + lap * CFG.LAP_DENSITY_GAIN) * this.quality), 46),
    };
  }
  quality = 1; // réduit par la qualité adaptative

  // densité locale : vagues lentes le long de l'anneau (parfois vide, parfois dense)
  localDensity(s) {
    const w = wave1(s * 0.00045 + this.time * 0.004, 3.7);      // vagues spatiales lentes
    const w2 = wave1(this.time * 0.01, 8.2);                     // respiration globale
    return clamp(0.55 + w * 0.45 + w2 * 0.2, 0.08, 1.35);
  }

  // ---------- apparition --------------------------------------------------
  spawnNPC(playerS, ahead) {
    const P = this.params();
    const isMoto = this.rand() < P.motoFrac;
    let id;
    if (isMoto) id = pickWeighted(this.rand, MOTO_IDS, MOTO_W);
    else if (this.rand() < P.speederFrac * 0.35) id = pick(this.rand, SPORT_IDS);
    else id = pickWeighted(this.rand, CAR_IDS, CAR_W);
    const m = CATALOG[id];

    const s = wrap(playerS + (ahead
      ? CFG.TRAFFIC_WINDOW_AHEAD * (0.12 + this.rand() * 0.88)
      : -CFG.TRAFFIC_WINDOW_BEHIND * (0.5 + this.rand() * 0.5)), this.track.length);

    // vitesse désirée : la plupart ~50 km/h, poids lourds moins, chauffards bien plus
    const sport = SPORT_IDS.includes(id) || (m.sport && this.rand() < 0.5);
    const heavy = ['bus', 'fourgon', 'livraison', 'depanneuse', 'municipal', 'camionnette', 'trafic'].includes(id);
    let v0;
    if (sport || this.rand() < this.params().speederFrac) v0 = MS(82 + this.rand() * 32);
    else if (heavy) v0 = MS(42 + this.rand() * 10);
    else v0 = MS(44 + this.rand() * 16);

    const interfile = isMoto && this.rand() < 0.75;
    // voie : les rapides à gauche, les lents à droite
    let lane;
    if (interfile) lane = -1;
    else if (v0 > MS(70)) lane = this.rand() < 0.7 ? 0 : 1;
    else if (heavy) lane = this.rand() < 0.65 ? 3 : 2;
    else lane = 1 + ((this.rand() * 3) | 0);

    const npc = {
      id, bundle: this.acquire(id),
      s, v: v0 * (0.85 + this.rand() * 0.15), v0,
      lane: interfile ? 0 : lane, laneFrom: lane, laneTo: lane, laneT: 1,
      interfile, gap: this.rand() < 0.6 ? 0 : 1,
      len: m.dims[0], wid: m.dims[1],
      aggro: sport ? 0.85 : this.rand() * 0.6,
      blinker: 0, brakeFlash: 0, panicAt: 200 + this.rand() * 900,
      yaw: 0, passed: false, merging: false,
    };
    // collision d'apparition : ne pas naître sur quelqu'un
    for (const o of this.npcs) {
      if (Math.abs(loopDelta(o.s, npc.s, this.track.length)) < (o.len + npc.len) / 2 + 6
        && Math.abs(this.latOf(o) - this.latOf(npc)) < 2.4) {
        this.release(npc.bundle);
        return null;
      }
    }
    this.npcs.push(npc);
    return npc;
  }

  latOf(npc) {
    if (npc.interfile) return interfileCenter(npc.gap);
    return lerp(laneCenter(npc.laneFrom), laneCenter(npc.laneTo), npc.laneT);
  }

  // vitesse cible locale (bouchons, fermetures, chantiers)
  localLimit(s, lane) {
    let lim = Infinity;
    for (const j of this.jams) {
      const d = loopDelta(s, j.s, this.track.length);
      if (d > -j.len / 2 && d < j.len / 2) {
        const ease = Math.sin(Math.min(j.age / 4, 1) * Math.PI / 2) * Math.min(1, Math.max(0, (j.life - j.age) / 6));
        // par voie décalée pour que ça « rampe » toujours quelque part
        const laneEase = 1 - 0.35 * Math.abs(Math.sin(j.age * 0.5 + lane * 1.8));
        lim = Math.min(lim, lerp(MS(50), MS(4 + lane * 2.4), j.sev * ease * laneEase));
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
    const track = this.track;
    const L = track.length;
    const playerS = player.s;
    this.closures = events ? events.closures : [];
    this.slowZones = events ? events.slowZones : [];

    // bouchons fantômes : naissance/vieillissement
    this.nextJamAt -= player.v * dt;
    if (this.nextJamAt <= 0) {
      this.jams.push({
        s: wrap(playerS + 900 + this.rand() * 800, L),
        len: 260 + this.rand() * 320,
        sev: 0.6 + this.rand() * 0.35,
        age: 0, life: 26 + this.rand() * 30,
      });
      this.nextJamAt = 1600 + this.rand() * 2600 / this.params().density;
    }
    for (const j of this.jams) { j.age += dt; j.s = wrap(j.s - dt * 1.2, L); } // remonte le flux
    this.jams = this.jams.filter((j) => j.age < j.life);

    // population cible selon vagues locales
    const target = Math.round(this.params().count * this.localDensity(playerS));
    if (this.npcs.length < target && this.rand() < 0.35) this.spawnNPC(playerS, this.rand() < 0.72);
    // tri par s relatif pour le suivi
    const rel = (npc) => loopDelta(npc.s, playerS, L);
    this.npcs.sort((a, b) => rel(a) - rel(b));

    // le joueur comme obstacle virtuel
    const playerObs = { s: playerS, lat: player.lat, v: player.v, len: player.len, wid: player.wid };

    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      const myLat = this.latOf(n);

      // — recherche du leader (même couloir) —
      let leader = null, gap = 1e9;
      for (let j = 0; j < this.npcs.length; j++) {
        if (j === i) continue;
        const o = this.npcs[j];
        const d = loopDelta(o.s, n.s, L);
        if (d <= 0.1 || d > 130) continue;
        if (Math.abs(this.latOf(o) - myLat) < (o.wid + n.wid) / 2 + 0.55) {
          const g = d - (o.len + n.len) / 2;
          if (g < gap) { gap = g; leader = o; }
        }
      }
      // le joueur aussi
      {
        const d = loopDelta(playerObs.s, n.s, L);
        if (d > 0.1 && d < 130 && Math.abs(playerObs.lat - myLat) < (playerObs.wid + n.wid) / 2 + 0.55) {
          const g = d - (playerObs.len + n.len) / 2;
          if (g < gap) { gap = g; leader = playerObs; }
        }
      }

      // — vitesse désirée locale —
      let v0 = Math.min(n.v0, this.localLimit(n.s, n.interfile ? 1 : n.lane));
      if (n.interfile) v0 = Math.min(n.v0, Math.max(this.localLimit(n.s, 1) + MS(18), MS(25)));
      // freinage panique aléatoire (à lire par le joueur !)
      n.panicAt -= n.v * dt;
      if (n.panicAt < 0) { n.panicAt = 500 + this.rand() * 1400; n.brakeFlash = 0.9 + this.rand() * 0.8; }
      if (n.brakeFlash > 0) { n.brakeFlash -= dt; v0 = Math.min(v0, n.v * 0.55); }

      // — IDM —
      let acc;
      if (leader) {
        const dv = n.v - leader.v;
        const sStar = CFG.IDM_S0 + Math.max(0, n.v * CFG.IDM_T + (n.v * dv) / (2 * Math.sqrt(CFG.IDM_A * CFG.IDM_B)));
        acc = CFG.IDM_A * (1 - Math.pow(n.v / Math.max(v0, 0.1), 4) - Math.pow(sStar / Math.max(gap, 0.5), 2));
      } else {
        acc = CFG.IDM_A * (1 - Math.pow(n.v / Math.max(v0, 0.1), 4));
      }
      acc = clamp(acc, -8.5, 3.2);
      n.v = Math.max(0, n.v + acc * dt);
      n.s = wrap(n.s + n.v * dt, L);
      n.bundle.brake.visible = acc < -0.9;

      // — changements de voie —
      if (!n.interfile) {
        if (n.laneT < 1) {
          n.laneT = Math.min(1, n.laneT + dt / 1.6);
          if (n.laneT >= 1) { n.lane = n.laneTo; n.laneFrom = n.laneTo; n.blinker = 0; }
        } else if (this.rand() < dt * (0.12 + n.aggro * 0.3)) {
          this.considerLaneChange(n, leader, gap, playerObs);
        }
        // fermeture de voie devant → rabattement obligatoire
        if (this.laneClosedAt(n.s, n.laneTo, 170) && n.laneT >= 1) {
          const dir = n.laneTo >= 3 ? -1 : (n.laneTo <= 0 ? 1 : (this.laneClosedAt(n.s, n.laneTo - 1, 170) ? 1 : -1));
          this.startLaneChange(n, clamp(n.laneTo + dir, 0, CFG.LANES - 1));
          v0 = Math.min(v0, MS(32));
        }
      } else {
        // interfile : slalom léger + changement de couloir occasionnel
        if (this.rand() < dt * 0.06) n.gap = n.gap === 0 ? 1 : 0;
      }

      // lacet visuel
      const targetYaw = n.laneT < 1 ? (laneCenter(n.laneTo) - laneCenter(n.laneFrom)) * 0.035 * Math.sin(n.laneT * Math.PI) : 0;
      n.yaw = lerp(n.yaw, targetYaw + (n.interfile ? Math.sin(this.time * 2.2 + n.s) * 0.02 : 0), Math.min(1, dt * 6));
    }

    // recyclage hors fenêtre
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const d = loopDelta(this.npcs[i].s, playerS, L);
      if (d > CFG.TRAFFIC_WINDOW_AHEAD + 60 || d < -CFG.TRAFFIC_WINDOW_BEHIND - 60) {
        this.release(this.npcs[i].bundle);
        this.npcs.splice(i, 1);
      }
    }

    // — sens extérieur (décoratif) —
    while (this.oncoming.length < CFG.ONCOMING_COUNT * this.quality) {
      const id = pickWeighted(this.rand, CAR_IDS, CAR_W);
      this.oncoming.push({
        id, bundle: this.acquire(id),
        s: wrap(playerS + this.rand() * 700 - 100, L),
        v: MS(40 + this.rand() * 25),
        lane: (this.rand() * CFG.LANES) | 0,
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

  considerLaneChange(n, leader, gap, playerObs) {
    // envie : leader lent devant, ou chauffard qui veut la voie de gauche
    const wantFaster = leader && gap < 45 && leader.v < n.v0 * 0.82;
    const wantLeft = n.aggro > 0.7 && n.lane > 0;
    const wantRight = n.aggro < 0.3 && n.lane < CFG.LANES - 1 && this.rand() < 0.3;
    if (!wantFaster && !wantLeft && !wantRight) return;
    const options = [];
    if (n.lane > 0) options.push(n.lane - 1);
    if (n.lane < CFG.LANES - 1) options.push(n.lane + 1);
    for (const target of options) {
      if (this.laneClosedAt(n.s, target, 120)) continue;
      if (this.gapOK(n, target, playerObs)) {
        this.startLaneChange(n, target);
        return;
      }
    }
  }

  gapOK(n, lane, playerObs) {
    const lat = laneCenter(lane);
    const check = (o, oLat) => {
      const d = loopDelta(o.s, n.s, this.track.length);
      if (Math.abs(oLat - lat) > (o.wid + n.wid) / 2 + 0.5) return true;
      if (d > 0) return d - (o.len + n.len) / 2 > n.v * 0.9 + 4;
      return -d - (o.len + n.len) / 2 > Math.max(6, (o.v - n.v) * 1.4 + 5);
    };
    for (const o of this.npcs) {
      if (o === n) continue;
      if (Math.abs(loopDelta(o.s, n.s, this.track.length)) < 80 && !check(o, this.latOf(o))) return false;
    }
    if (!check(playerObs, playerObs.lat)) return false;
    return true;
  }

  startLaneChange(n, target) {
    if (target === n.laneTo) return;
    n.laneFrom = n.lane;
    n.laneTo = target;
    n.laneT = 0;
    n.blinker = 1;
  }

  // ---------- placement 3D -------------------------------------------------
  place(player) {
    const track = this.track;
    const p = this._p || (this._p = {});
    for (const n of this.npcs) {
      track.pointAt(n.s, p);
      const lat = this.latOf(n);
      const g = n.bundle.group;
      g.position.set(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
      g.rotation.y = Math.atan2(p.tx, p.tz) + n.yaw;
      if (n.interfile) g.rotation.z = -n.yaw * 6; // légère inclinaison moto
    }
    for (const o of this.oncoming) {
      track.pointAt(o.s, p);
      const lat = -laneCenter(o.lane);
      const g = o.bundle.group;
      g.position.set(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
      g.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
    }
  }

  setNightGlows(on) {
    for (const n of this.npcs) n.bundle.glows.visible = on;
    for (const o of this.oncoming) o.bundle.glows.visible = on;
  }

  // état du trafic pour le PMV / HUD
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
    // pré-peupler autour du départ
    for (let i = 0; i < 18; i++) this.spawnNPC(playerS, this.rand() < 0.8);
  }
}
