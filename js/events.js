// ============================================================
// Périph' Rush — événements dynamiques : chantiers & accidents
// Fermetures de voie balisées (cônes, barrières, flèche lumineuse,
// véhicules d'intervention), annoncées en amont par panneaux + PMV.
// Fournit au trafic les voies fermées et zones lentes, et au jeu
// la liste d'obstacles solides (toute collision = fin de partie).
// ============================================================

import { CFG, MS, laneCenter, ROAD_OUTER } from './config.js';
import { rng, clamp, wrap, mergeGeoms, colorize, xform, pick } from './utils.js';
import { worksPanelTexture } from './signs.js';

export class Events {
  constructor(THREE, scene, track, factory, world) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.factory = factory;
    this.world = world;
    this.rand = rng(987654);
    this.active = [];          // événements en cours
    this.nextAt = 2200;        // distance joueur avant le prochain
    this.lapBoost = 1;
    this.time = 0;
    this._p = {};
    // matériaux partagés
    this.coneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.arrowOn = new THREE.MeshBasicMaterial({ color: 0xffb020 });
    this.blueMat = new THREE.MeshBasicMaterial({ color: 0x2a6cff });
  }

  get closures() {
    return this.active.filter((e) => e.opened).map((e) => ({ s0: e.s0, s1: e.s1, lanes: e.lanes }));
  }
  get slowZones() {
    return this.active.filter((e) => e.opened).map((e) => ({
      s0: wrap(e.s0 - 220, this.track.length), s1: e.s1, v: MS(26),
    }));
  }

  obstacles() {
    const out = [];
    for (const e of this.active) for (const o of e.obstacles) out.push(o);
    return out;
  }

  update(dt, player, traffic) {
    this.time += dt;
    const L = this.track.length;
    this.nextAt -= player.v * dt;
    if (this.nextAt <= 0) {
      this.spawn(player.s);
      const gap = CFG.EVENT_MIN_GAP + this.rand() * (CFG.EVENT_MAX_GAP - CFG.EVENT_MIN_GAP);
      this.nextAt = gap / this.lapBoost;
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      // clignotement flèche / gyrophares
      const blink = Math.sin(this.time * 6) > 0;
      for (const b of e.blinkers) b.visible = blink;
      const blink2 = Math.sin(this.time * 9 + 2) > 0;
      for (const b of e.strobes) b.visible = blink2;
      // suppression une fois loin derrière le joueur
      const behind = loopBehind(player.s, e.s1, L);
      if (behind > 600 && behind < L - 2000) {
        this.dispose(e);
        this.active.splice(i, 1);
      }
    }
  }

  // annonce pour le HUD : événement le plus proche devant
  warningAhead(playerS) {
    let best = null, bestD = Infinity;
    for (const e of this.active) {
      const d = wrap(e.s0 - playerS, this.track.length);
      if (d < CFG.EVENT_WARN_DIST + 200 && d > 10 && d < bestD) {
        bestD = d;
        best = { dist: d, type: e.type, lanes: e.lanes };
      }
    }
    return best;
  }

  spawn(playerS) {
    const L = this.track.length;
    const s0 = wrap(playerS + 1200 + this.rand() * 700, L);
    // pas d'événement en tunnel ni sur pont
    if (this.track.inTunnel(s0) || this.track.onBridge(s0) || this.track.inTunnel(wrap(s0 + 250, L))) return;
    const type = this.rand() < 0.62 ? 'travaux' : 'accident';
    if (type === 'travaux') this.spawnRoadworks(s0);
    else this.spawnAccident(s0);
  }

  // ---------- chantier ---------------------------------------------------
  spawnRoadworks(s0) {
    const T = this.T, track = this.track;
    const len = 150 + this.rand() * 90;
    const right = this.rand() < 0.7; // le plus souvent côté droit
    const two = this.rand() < 0.3;
    const lanes = right ? (two ? [2, 3] : [3]) : (two ? [0, 1] : [0]);
    const s1 = wrap(s0 + len, track.length);
    const e = this.newEvent('travaux', s0, s1, lanes);
    const group = e.group;
    const cones = [];
    const statics = [];
    const p = this._p;

    // biseau de cônes sur 45 m puis ligne le long de la voie fermée
    const closedEdge = right ? laneCenter(Math.min(...lanes)) - CFG.LANE_WIDTH / 2
      : laneCenter(Math.max(...lanes)) + CFG.LANE_WIDTH / 2;
    const openEdge = right ? laneCenter(Math.max(...lanes)) + CFG.LANE_WIDTH / 2
      : laneCenter(Math.min(...lanes)) - CFG.LANE_WIDTH / 2;
    for (let d = 0; d < len; d += 6) {
      const t = clamp(d / 45, 0, 1);
      const lat = openEdge + (closedEdge - openEdge) * t;
      this.addCone(cones, e, s0 + d, lat);
    }
    // barrières rayées à l'intérieur de la zone
    for (let d = 50; d < len - 10; d += 22) {
      track.pointAt(wrap(s0 + d, track.length), p);
      const lat = (closedEdge + openEdge) / 2 + (right ? 1.2 : -1.2);
      const bar = xform(new T.BoxGeometry(0.25, 0.9, 2.4), {
        x: p.x + p.rx * lat, y: p.y + 0.45, z: p.z + p.rz * lat, ry: Math.atan2(p.tx, p.tz),
      });
      statics.push(colorize(T, bar, this.rand() < 0.5 ? 0xd94f30 : 0xe8eaed));
    }
    // remorque flèche lumineuse au début du biseau
    track.pointAt(wrap(s0 + 18, track.length), p);
    const latT = openEdge + (closedEdge - openEdge) * 0.4;
    statics.push(colorize(T, xform(new T.BoxGeometry(1.6, 1.9, 0.4), {
      x: p.x + p.rx * latT, y: p.y + 1.45, z: p.z + p.rz * latT, ry: Math.atan2(p.tx, p.tz),
    }), 0x3a3f45));
    // chevrons lumineux clignotants
    for (let k = 0; k < 5; k++) {
      const q = new T.Mesh(new T.PlaneGeometry(0.9 - k * 0.12, 0.12), this.arrowOn);
      q.position.set(p.x + p.rx * latT - p.tx * 0.25, p.y + 1.1 + k * 0.28, p.z + p.rz * latT - p.tz * 0.25);
      q.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI + (right ? 0.5 : -0.5);
      group.add(q);
      e.blinkers.push(q);
    }
    e.obstacles.push({ s: wrap(s0 + 18, track.length), lat: latT, len: 1.4, wid: 1.7, v: 0 });
    // camion municipal + engin dans la zone
    const truck = this.factory.build('municipal', { color: 0x3d5f43 });
    this.placeVehicle(e, truck, wrap(s0 + len * 0.55, track.length), (closedEdge + openEdge) / 2, 0.12);
    if (truck.beacon) e.strobes.push(truck.beacon);
    // panneaux TRAVAUX en amont (150 et 320 m)
    for (const dz of [150, 320]) {
      const sSign = wrap(s0 - dz, track.length);
      track.pointAt(sSign, p);
      const lat2 = right ? ROAD_OUTER + 1.6 : -0.9;
      const sign = new T.Mesh(new T.PlaneGeometry(2.2, 0.75),
        new T.MeshBasicMaterial({ map: worksPanelTexture(T, dz === 150 ? 'TRAVAUX' : `TRAVAUX ${dz} m`) }));
      sign.position.set(p.x + p.rx * lat2, p.y + 1.4, p.z + p.rz * lat2);
      sign.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
      group.add(sign);
    }
    this.finalize(e, cones, statics);
    this.world.setVMSAhead(wrap(s0 - 500, track.length), ['TRAVAUX', right ? 'VOIE DE DROITE NEUTRALISEE' : 'VOIE DE GAUCHE NEUTRALISEE']);
  }

  // ---------- accident -----------------------------------------------------
  spawnAccident(s0) {
    const T = this.T, track = this.track;
    const len = 70 + this.rand() * 40;
    const laneA = (this.rand() * CFG.LANES) | 0;
    const laneB = clamp(laneA + (this.rand() < 0.5 ? 1 : -1), 0, CFG.LANES - 1);
    const lanes = [...new Set([laneA, laneB])];
    const s1 = wrap(s0 + len, track.length);
    const e = this.newEvent('accident', s0, s1, lanes);
    const cones = [], statics = [];
    const p = this._p;

    // véhicules accidentés en travers
    const ids = ['clio4', 'p208', 'berline_g', 'yaris', 'c3', 'megane'];
    const carA = this.factory.build(pick(this.rand, ids), {});
    const carB = this.factory.build(pick(this.rand, ids), {});
    const sA = wrap(s0 + len * 0.55, track.length);
    this.placeVehicle(e, carA, sA, laneCenter(laneA) + 0.5, 0.5);
    this.placeVehicle(e, carB, wrap(sA + 7, track.length), laneCenter(laneB) - 0.4, -0.35);
    carA.brake.visible = true;
    // dépanneuse en protection derrière, gyrophare
    const tow = this.factory.build('depanneuse', {});
    this.placeVehicle(e, tow, wrap(s0 + len * 0.3, track.length), laneCenter(laneA), 0.06);
    if (tow.beacon) e.strobes.push(tow.beacon);
    // gyro bleu (véhicule d'intervention) sur le toit de carB
    const strobe = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.15), this.blueMat);
    strobe.position.y = carB.ud.H + 0.1;
    carB.group.add(strobe);
    e.strobes.push(strobe);

    // cônes autour
    const lo = Math.min(...lanes), hi = Math.max(...lanes);
    const edgeL = laneCenter(lo) - CFG.LANE_WIDTH / 2, edgeR = laneCenter(hi) + CFG.LANE_WIDTH / 2;
    for (let d = 0; d < len * 0.5; d += 5.5) {
      const t = d / (len * 0.5);
      this.addCone(cones, e, s0 + d, edgeR + (1 - t) * 0.001 + t * 0); // ligne droite côté droit
      this.addCone(cones, e, s0 + d, edgeL);
    }
    for (const dz of [140, 300]) {
      const sSign = wrap(s0 - dz, track.length);
      track.pointAt(sSign, p);
      const sign = new T.Mesh(new T.PlaneGeometry(2.2, 0.75),
        new T.MeshBasicMaterial({ map: worksPanelTexture(T, 'ACCIDENT') }));
      sign.position.set(p.x + p.rx * (ROAD_OUTER + 1.6), p.y + 1.4, p.z + p.rz * (ROAD_OUTER + 1.6));
      sign.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
      e.group.add(sign);
    }
    this.finalize(e, cones, statics);
    this.world.setVMSAhead(wrap(s0 - 500, track.length), ['ACCIDENT', 'PRUDENCE · RALENTIR']);
  }

  // ---------- aides ---------------------------------------------------------
  newEvent(type, s0, s1, lanes) {
    const e = {
      type, s0, s1, lanes, opened: true,
      group: new this.T.Group(), geoms: [], vehicles: [],
      obstacles: [], blinkers: [], strobes: [],
    };
    this.scene.add(e.group);
    this.active.push(e);
    return e;
  }

  addCone(cones, e, s, lat) {
    const T = this.T, track = this.track;
    const sw = wrap(s, track.length);
    track.pointAt(sw, this._p);
    const p = this._p;
    const cone = new T.CylinderGeometry(0.05, 0.19, 0.55, 7);
    // bandes : orange + blanc via couleurs de sommets (haut blanc)
    const posA = cone.getAttribute('position');
    const colArr = new Float32Array(posA.count * 3);
    for (let i = 0; i < posA.count; i++) {
      const y = posA.getY(i);
      const white = y > 0.05 && y < 0.18;
      colArr[i * 3] = white ? 0.95 : 0.95;
      colArr[i * 3 + 1] = white ? 0.95 : 0.35;
      colArr[i * 3 + 2] = white ? 0.92 : 0.08;
    }
    cone.setAttribute('color', new T.BufferAttribute(colArr, 3));
    xform(cone, { x: p.x + p.rx * lat, y: p.y + 0.28, z: p.z + p.rz * lat });
    cones.push(cone);
    e.obstacles.push({ s: sw, lat, len: 0.42, wid: 0.42, v: 0, cone: true });
  }

  placeVehicle(e, bundle, s, lat, yaw) {
    const track = this.track;
    track.pointAt(s, this._p);
    const p = this._p;
    bundle.group.position.set(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
    bundle.group.rotation.y = Math.atan2(p.tx, p.tz) + yaw;
    e.group.add(bundle.group);
    e.vehicles.push(bundle);
    e.obstacles.push({ s, lat, len: bundle.ud.L, wid: bundle.ud.W + 0.15, v: 0 });
  }

  finalize(e, cones, statics) {
    const T = this.T;
    if (cones.length) {
      const merged = mergeGeoms(T, cones);
      e.group.add(new T.Mesh(merged, this.coneMat));
      e.geoms.push(merged);
      for (const c of cones) c.dispose();
    }
    if (statics.length) {
      const merged = mergeGeoms(T, statics);
      e.group.add(new T.Mesh(merged, this.world.mats.concrete));
      e.geoms.push(merged);
      for (const s of statics) s.dispose();
    }
  }

  dispose(e) {
    this.scene.remove(e.group);
    for (const g of e.geoms) g.dispose();
  }

  reset() {
    for (const e of this.active) this.dispose(e);
    this.active = [];
    this.nextAt = 2200;
    this.lapBoost = 1;
  }
}

function loopBehind(playerS, s, L) {
  return wrap(playerS - s, L);
}
