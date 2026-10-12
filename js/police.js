// ============================================================
// Périph' Rush — contrôles de vitesse aux jumelles + poursuite (v20)
// Un policier vise le trafic aux jumelles laser depuis le musoir d'une
// sortie (voiture de police et motos garées à côté). Si la vitesse
// relevée dépasse nettement la limite, un motard démarre, sirène
// hurlante, et remonte le trafic par l'interfile. S'il se cale à votre
// hauteur assez longtemps : interpellation, fin de partie. Il abandonne
// si vous le semez durablement. Les radars automatiques restent gérés
// par rules.js (flash + points).
// ============================================================

import { CFG, MS, interfileCenter } from './config.js';
import { clamp, wrap, loopDelta, rng } from './utils.js';
import { personGeometry, OUTFITS } from './people.js';

const TOL_KMH = 12;        // tolérance avant interpellation (au-delà de la limite)
const GIVEUP_DIST = 320;   // distance qui fait abandonner le motard…
const GIVEUP_TIME = 7;     // …si elle est tenue ce temps-là (s)
const CHASE_MAX = 95;      // durée maxi d'une poursuite (s)

export class Police {
  constructor(THREE, scene, track, factory, traffic) {
    Object.assign(this, { T: THREE, scene, track, factory, traffic });
    this.rand = rng(4242);
    this.site = null;
    this.chase = null;
    this.nextAt = 2600;
    this._p = {};
    this.personMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  reset() {
    this.clearSite();
    this.endChase(true);
    this.nextAt = 1800 + this.rand() * 2500;
    this.result = null;
  }

  // ---------- site de contrôle --------------------------------------------
  clearSite() {
    if (!this.site) return;
    this.scene.remove(this.site.group);
    this.site.geoms.forEach((g) => g.dispose());
    this.site = null;
  }

  // musoir de sortie assez large et à niveau pour garer voiture + motos
  findSpot(fromS) {
    const t = this.track, R = t.ramps;
    if (!R) return null;
    const L = t.length;
    for (let k = 0; k < 6; k++) {
      const nx = t.nextExit(wrap(fromS + k * 400, L));
      if (!nx.exit) return null;
      const r = R.list.find((q) => q.j === nx.exit && q.kind === 'X');
      if (!r) continue;
      for (let d = 70; d < 200; d += 8) {
        const s = wrap(r.j.s + d, L);
        if (t.coverAt(s) || t.onBridge(s)) break;
        t.pointAt(s, this._p);
        const o = R.one(r, s, this._p.y);
        if (!o || o.room == null) continue;
        if (o.room > 7.5 && Math.abs(o.hr - this._p.y) < 0.35) return { s, r, o, y: this._p.y };
      }
    }
    return null;
  }

  buildSite(spot) {
    const T = this.T, t = this.track, L = t.length;
    const group = new T.Group();
    const geoms = [];
    const Em = t.mainEdgeAt(spot.s);
    // côté chaussée de la séparation : entre le bord de la chaussée et la DBA du musoir
    const latCar = Em + spot.o.ref + (spot.o.mid - spot.o.ref) * 0.55;
    const place = (bundle, s, lat, yaw) => {
      t.pointAt(wrap(s, L), this._p);
      const p = this._p;
      bundle.group.position.set(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
      bundle.group.rotation.y = Math.atan2(p.tx, p.tz) + yaw;
      group.add(bundle.group);
      return bundle;
    };
    place(this.factory.build('police', {}), spot.s + 4, latCar, 0.05);
    place(this.factory.build('police_moto', {}), spot.s - 5, latCar - 0.6, 0.25).group.userData.isMoto = true;
    place(this.factory.build('police_moto', {}), spot.s - 8, latCar - 0.4, 0.3);
    // policier aux jumelles tourné vers le trafic qui arrive, collègue à côté
    const addPerson = (opts, s, lat, face) => {
      t.pointAt(wrap(s, L), this._p);
      const p = this._p;
      const g = personGeometry(T, { ...opts, rnd: this.rand });
      g.rotateY(Math.atan2(p.tx, p.tz) + face);
      g.translate(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
      geoms.push(g);
      const m = new T.Mesh(g, this.personMat);
      m.castShadow = true;
      group.add(m);
    };
    addPerson({ ...OUTFITS.police, pose: 'binoc' }, spot.s - 13, latCar - 1.1, Math.PI);
    addPerson({ ...OUTFITS.policeVest, pose: 'arms' }, spot.s - 11, latCar + 0.2, Math.PI * 0.8);
    this.scene.add(group);
    this.site = { s: spot.s, lat: latCar, group, geoms, maxKmh: 0, armed: true, flagged: false };
  }

  // ---------- boucle --------------------------------------------------------
  update(dt, player, game) {
    const L = this.track.length;
    // nouveau contrôle loin devant, de temps en temps
    this.nextAt -= player.v * dt;
    if (!this.site && !this.chase && this.nextAt <= 0) {
      this.nextAt = 3500 + this.rand() * 5000;
      const spot = this.findSpot(player.s + 900);
      if (spot && loopDelta(spot.s, player.s, L) > 700) this.buildSite(spot);
    }
    const site = this.site;
    if (site) {
      const d = loopDelta(site.s, player.s, L); // > 0 : site devant
      // mesure laser : sur l'approche, entre 220 m et 40 m
      if (site.armed && d < 220 && d > 40 && !player.ramp) site.maxKmh = Math.max(site.maxKmh, player.kmh);
      if (site.armed && d < 0) {
        site.armed = false;
        if (site.maxKmh > CFG.SPEED_LIMIT_KMH + TOL_KMH) this.startChase(player, site);
      }
      if (d < -400) this.clearSite();
    }
    if (this.chase) this.updateChase(dt, player, game);
  }

  startChase(player, site) {
    const tr = this.traffic;
    const n = tr.makeNPC('police_moto', wrap(site.s - 6, this.track.length), { mode: 'chase', eligible: true });
    n.v = MS(25);
    n.v0 = MS(150);
    n.lat = n.latT = site.lat;
    n.bundle = tr.acquire('police_moto');
    n.bundle.sirenOn = true;
    tr.npcs.push(n);
    tr.sfx.push({ type: 'sirenStart', npc: n });
    this.chase = { n, t: 0, farT: 0, closeT: 0, kmh: Math.round(site.maxKmh) };
    // le motard « du site » est parti : on retire un des deux garés
    const motos = site.group.children.filter((c) => c.userData?.isMoto);
    if (motos[0]) motos[0].visible = false;
  }

  endChase(silent = false) {
    const c = this.chase;
    if (!c) return;
    c.n.gone = true;
    if (c.n.bundle) c.n.bundle.sirenOn = false;
    this.chase = null;
    if (!silent) this.result = 'semé';
  }

  updateChase(dt, player, game) {
    const c = this.chase, n = c.n, L = this.track.length;
    c.t += dt;
    const ds = loopDelta(player.s, n.s, L); // > 0 : joueur devant le motard
    // vitesse : fond sur le joueur, puis se cale à sa hauteur
    let vT;
    if (ds > 30) vT = Math.min(MS(150), player.v + MS(30));
    else if (ds > 3) vT = player.v + clamp(ds * 0.45, 1.2, MS(22));
    else vT = player.v;
    const acc = vT > n.v ? 4.2 : -7;
    n.v = Math.max(0, n.v + clamp(vT - n.v, -7 * dt, Math.abs(acc) * dt));
    n.s = wrap(n.s + n.v * dt, L);
    // trajectoire : interfile la plus proche du joueur, puis à côté de lui
    const g = player.lat < interfileCenter(0) + 1.75 ? 0 : 1;
    n.latT = ds > 25 ? interfileCenter(g) : clamp(player.lat - 1.6, CFG.LATERAL_MIN + 0.3, 14);
    this.traffic.dynamics(n, dt);
    n.acc = 0;
    // interpellation : à hauteur du joueur, assez longtemps (ou joueur arrêté)
    const side = Math.abs(n.lat - player.lat);
    if (Math.abs(ds) < 5 && side < 2.6) c.closeT += dt; else c.closeT = Math.max(0, c.closeT - dt * 0.5);
    if (c.closeT > 2.2 || (player.v < 2 && Math.abs(ds) < 12)) {
      game.endRun('INTERPELLÉ', `Contrôlé aux jumelles à ${c.kmh} km/h (limite ${CFG.SPEED_LIMIT_KMH}). Le motard de la police vous a rattrapé : véhicule immobilisé, permis retenu.`);
      this.endChase(true);
      return;
    }
    // semé ?
    if (ds > GIVEUP_DIST) c.farT += dt; else c.farT = Math.max(0, c.farT - dt);
    if (c.farT > GIVEUP_TIME || c.t > CHASE_MAX || ds < -60) {
      this.endChase();
      game.ui.popup('🚔 LE MOTARD A ABANDONNÉ LA POURSUITE', 'good');
    }
  }

  chaseText(player) {
    if (!this.chase) return null;
    const d = Math.round(loopDelta(player.s, this.chase.n.s, this.track.length));
    return `🚨 MOTARD DE POLICE À ${Math.max(0, Math.round(d / 5) * 5)} m — VOUS ÊTES PRIS EN CHASSE !`;
  }
}
