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

  // v21 : policier aux jumelles sur le pont d'une porte (tête de couverture, côté trafic qui
  // arrive) ; motards prêts à intervenir sur la bretelle d'entrée suivante.
  findSpot(fromS) {
    const t = this.track, R = t.ramps, L = t.length;
    if (!R) return null;
    const covers = t.covers.map((c) => ({ c, d: wrap(c.s0 - fromS, L) })).filter((q) => q.d > 0 && q.d < 6000).sort((a, b) => a.d - b.d);
    for (const { c } of covers) {
      if (wrap(c.s1 - c.s0, L) > 160) continue;           // pont de porte, pas un long tunnel
      const entry = R.list.filter((r) => r.kind === 'E').map((r) => ({ r, d: wrap(r.j.s - c.s1, L) }))
        .filter((q) => q.d > 120 && q.d < 1100).sort((a, b) => a.d - b.d)[0];
      if (!entry) continue;
      // emplacement des motards : sur la bretelle, avant l'insertion, à niveau de la chaussée
      for (const back of [70, 95, 120, 55]) {
        const sm = wrap(entry.r.j.s - back, L);
        t.pointAt(sm, this._p);
        const o = R.one(entry.r, sm, this._p.y);
        if (!o || o.g < 2.5 || Math.abs(o.hr - this._p.y) > 1.5) continue;
        return { s: c.s0, cover: c, entry: entry.r, sm, om: o };
      }
    }
    return null;
  }

  buildSite(spot) {
    const T = this.T, t = this.track, L = t.length;
    const group = new T.Group();
    const geoms = [];
    const addPerson = (opts, s, lat, face, y) => {
      t.pointAt(wrap(s, L), this._p);
      const p = this._p;
      const g = personGeometry(T, { ...opts, rnd: this.rand });
      g.rotateY(Math.atan2(p.tx, p.tz) + face);
      g.translate(p.x + p.rx * lat, y ?? p.y, p.z + p.rz * lat);
      geoms.push(g);
      const m = new T.Mesh(g, this.personMat);
      m.castShadow = true;
      group.add(m);
    };
    // sur le pont : trottoir derrière le garde-corps de rive, au-dessus des voies de droite
    t.pointAt(spot.s, this._p);
    const deck = this._p.y + 5.3 + 1.3 + 0.3; // hauteur libre + tablier + bordure (cf. world.js)
    const latB = 9 + this.rand() * 3;
    addPerson({ ...OUTFITS.police, pose: 'binoc' }, spot.s + 0.9, latB, Math.PI, deck);
    addPerson({ ...OUTFITS.police, pose: 'phone' }, spot.s + 1.3, latB + 1.2, Math.PI * 1.15, deck);
    // motards garés sur la bretelle d'entrée, prêts à partir
    const Em = t.mainEdgeAt(spot.sm);
    const latM = Em + spot.om.gap + spot.om.w * 0.75;
    const motos = [];
    for (const [ds, dl] of [[0, 0], [-4.5, -0.9]]) {
      const b = this.factory.build('police_moto', {});
      t.pointAt(wrap(spot.sm + ds, L), this._p);
      const p = this._p;
      b.group.position.set(p.x + p.rx * (latM + dl), spot.om.hr, p.z + p.rz * (latM + dl));
      b.group.rotation.y = Math.atan2(p.tx, p.tz) + 0.12;
      group.add(b.group);
      motos.push(b);
    }
    this.scene.add(group);
    this.site = { s: spot.s, sm: spot.sm, entryS: spot.entry.j.s, lat: latM, y: spot.om.hr, group, geoms, motos, maxKmh: 0, armed: true, flagged: false };
  }

  // ---------- boucle --------------------------------------------------------
  update(dt, player, game) {
    const L = this.track.length;
    // nouveau contrôle loin devant, de temps en temps
    this.nextAt -= player.v * dt;
    if (this.enabled !== false && !this.site && !this.chase && this.nextAt <= 0) {
      this.nextAt = 3500 + this.rand() * 5000;
      const spot = this.findSpot(player.s + 900);
      if (spot && loopDelta(spot.s, player.s, L) > 600) this.buildSite(spot);
    }
    const site = this.site;
    if (site) {
      const d = loopDelta(site.s, player.s, L); // > 0 : pont devant
      // mesure laser depuis le pont : sur l'approche, entre 220 m et 40 m
      if (site.armed && d < 220 && d > 40 && !player.ramp) site.maxKmh = Math.max(site.maxKmh, player.kmh);
      if (site.armed && d < 0) {
        site.armed = false;
        site.flagged = site.maxKmh > CFG.SPEED_LIMIT_KMH + TOL_KMH;
      }
      // les motards, prévenus par radio, démarrent quand vous passez devant l'entrée
      if (site.flagged && !this.chase && loopDelta(player.s, site.entryS, L) > -5) { site.flagged = false; this.startChase(player, site); }
      if (loopDelta(player.s, site.entryS, L) > 500 && !this.chase) this.clearSite();
    }
    if (!this.enabled && this.site && !this.chase) this.clearSite();
    if (this.chase) this.updateChase(dt, player, game);
  }

  startChase(player, site) {
    const tr = this.traffic;
    const n = tr.makeNPC('police_moto', site.sm, { mode: 'chase', eligible: true });
    n.v = MS(30);
    n.v0 = MS(150);
    n.lat = n.latT = site.lat;
    n.bundle = tr.acquire('police_moto');
    n.bundle.sirenOn = true;
    tr.npcs.push(n);
    tr.sfx.push({ type: 'sirenStart', npc: n });
    this.chase = { n, t: 0, farT: 0, closeT: 0, kmh: Math.round(site.maxKmh) };
    if (site.motos[0]) site.motos[0].group.visible = false; // il est parti
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
    else if (ds > 3) vT = player.v + clamp(ds * 0.6, 1.5, MS(45));
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
