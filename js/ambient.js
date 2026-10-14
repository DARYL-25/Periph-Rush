// ============================================================
// Périph' Rush — vie des bretelles (v23)
//  • Feux de régulation d'accès sur certaines bretelles d'entrée :
//    feu tricolore en bord de bretelle + ligne d'arrêt ; au rouge, les
//    véhicules qui entrent s'arrêtent et une file se forme (traffic.js
//    interroge stopGap()). Cycle court : un ou deux véhicules par vert.
//  • Livreurs à vélo électrique (sac isotherme) qui roulent sur la
//    bande de droite des bretelles, comme on en croise aux portes.
// Purement local : seuls les éléments proches du joueur existent.
// ============================================================

import { wrap, loopDelta, rng } from './utils.js';

const STOP_VV = 110;        // ligne d'arrêt : 110 m avant le raccordement
const CYCLE = 11, GREEN = 3.2;

export class RampLife {
  constructor(THREE, scene, track) {
    Object.assign(this, { T: THREE, scene, track });
    this.rand = rng(7331);
    this.time = 0;
    this.lights = new Map();     // ramp -> { ramp, phase, group }
    this.bikes = [];
    this.nextBikeAt = 400;
    const T = THREE;
    this.mat = {
      pole: new T.MeshLambertMaterial({ color: 0x2f3438 }),
      head: new T.MeshLambertMaterial({ color: 0x15171a }),
      redOn: new T.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }),
      greenOn: new T.MeshBasicMaterial({ color: 0x2dff7a, toneMapped: false }),
      off: new T.MeshLambertMaterial({ color: 0x24282c }),
      line: new T.MeshBasicMaterial({ color: 0xf2f2ee }),
      bike: new T.MeshLambertMaterial({ vertexColors: true }),
    };
    // bretelles équipées : une entrée sur trois (relevé : régulation d'accès aux heures chargées)
    const R = track.ramps;
    this.equipped = R ? R.list.filter((r) => r.kind === 'E').filter((_, i) => i % 3 === 1) : [];
    this.bikeGeom = this.makeBike();
    this._p = {};
  }

  isRed(L) { return ((this.time + L.phase) % CYCLE) > GREEN; }

  // distance jusqu'à la ligne d'arrêt (véhicule en mode « enter » sur une bretelle équipée, feu rouge)
  stopGap(n) {
    const Lt = this.lights.get(n.ramp);
    if (!Lt || !this.isRed(Lt)) return null;
    const vv = loopDelta(n.ramp.j.s, n.s, this.track.length);
    const d = vv - STOP_VV;
    if (d < n.len / 2 - 0.5 || d > 140) return null;     // déjà engagé : on passe
    return Math.max(0.3, d - n.len / 2 - 0.6);
  }

  buildLight(r) {
    const T = this.T, t = this.track, R = t.ramps, L = t.length, p = this._p;
    const s = wrap(r.j.s - STOP_VV, L);
    t.pointAt(s, p);
    const o = R.one(r, s, p.y);
    if (!o || o.g < 2) return null;
    const Em = t.mainEdgeAt(s);
    const g = new T.Group();
    const at = (lat, y) => new T.Vector3(p.x + p.rx * lat, y, p.z + p.rz * lat);
    const yaw = Math.atan2(p.tx, p.tz);
    const latP = Em + o.gap + o.w + 0.45;
    const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 3.0, 8), this.mat.pole);
    pole.position.copy(at(latP, o.hr + 1.5));
    g.add(pole);
    const head = new T.Mesh(new T.BoxGeometry(0.34, 0.95, 0.26), this.mat.head);
    head.position.copy(at(latP, o.hr + 2.9));
    head.rotation.y = yaw;
    g.add(head);
    const lamp = (dy, mat) => {
      const m = new T.Mesh(new T.CircleGeometry(0.1, 14), mat);
      m.position.copy(at(latP, o.hr + 2.9 + dy)).addScaledVector(new T.Vector3(-p.tx, 0, -p.tz), 0.135);
      m.rotation.y = yaw + Math.PI;
      g.add(m);
      return m;
    };
    const red = lamp(0.27, this.mat.redOn), amber = lamp(0, this.mat.off), green = lamp(-0.27, this.mat.greenOn);
    // panonceau « 1 véhicule par vert » (plaque blanche) et ligne d'arrêt
    const plate = new T.Mesh(new T.PlaneGeometry(0.5, 0.3), this.mat.line);
    plate.position.copy(at(latP, o.hr + 2.15)).addScaledVector(new T.Vector3(-p.tx, 0, -p.tz), 0.02);
    plate.rotation.y = yaw + Math.PI;
    g.add(plate);
    const line = new T.Mesh(new T.PlaneGeometry(o.w - 0.3, 0.5).rotateX(-Math.PI / 2), this.mat.line);
    line.position.copy(at(Em + o.gap + o.w / 2, o.hr + 0.02));
    line.rotation.y = yaw + Math.PI / 2;
    g.add(line);
    this.scene.add(g);
    return { ramp: r, phase: this.rand() * CYCLE, group: g, red, amber, green };
  }

  // vélo + livreur assis (sac isotherme) — repère : avant vers +z, y vers le haut
  makeBike() {
    const T = this.T;
    const parts = [];
    const col = (g, hex) => {
      const c = new T.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g.index ? g.toNonIndexed() : g;
    };
    const add = (g, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
      parts.push(col(g, hex));
    };
    for (const z of [-0.52, 0.52]) add(new T.TorusGeometry(0.33, 0.035, 6, 18), 0x151618, 0, 0.35, z, 0, Math.PI / 2, 0);
    add(new T.BoxGeometry(0.05, 0.05, 0.95), 0x2b2f35, 0, 0.6, 0, -0.25, 0, 0);       // cadre
    add(new T.BoxGeometry(0.05, 0.6, 0.05), 0x2b2f35, 0, 0.6, -0.15, 0.3, 0, 0);       // tube de selle
    add(new T.BoxGeometry(0.12, 0.25, 0.3), 0x2b2f35, 0, 0.45, -0.1);                  // batterie
    add(new T.BoxGeometry(0.55, 0.03, 0.03), 0x111214, 0, 1.05, 0.45);                 // guidon
    // livreur : jambes pliées, buste penché, casque, sac isotherme
    add(new T.CylinderGeometry(0.07, 0.065, 0.45, 6), 0x1f2329, 0.1, 0.78, -0.02, 1.2, 0, 0);
    add(new T.CylinderGeometry(0.07, 0.065, 0.45, 6), 0x1f2329, -0.1, 0.78, 0.05, 1.0, 0, 0);
    add(new T.CylinderGeometry(0.06, 0.055, 0.45, 6), 0x1f2329, 0.1, 0.48, 0.18, 0.1, 0, 0);
    add(new T.CylinderGeometry(0.06, 0.055, 0.45, 6), 0x1f2329, -0.1, 0.5, 0.15, -0.3, 0, 0);
    add(new T.CylinderGeometry(0.17, 0.15, 0.6, 8), 0x2d3138, 0, 1.22, 0.05, 0.55, 0, 0);
    add(new T.SphereGeometry(0.115, 8, 6), 0xc68e6a, 0, 1.62, 0.3);
    add(new T.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), 0xe8eaed, 0, 1.66, 0.3);
    for (const sd of [-1, 1]) add(new T.CylinderGeometry(0.045, 0.04, 0.58, 6), 0x2d3138, sd * 0.2, 1.25, 0.32, 1.1, 0, 0);
    add(new T.BoxGeometry(0.44, 0.44, 0.24), 0x1fb5a8, 0, 1.38, -0.22, 0.5, 0, 0);     // sac
    add(new T.BoxGeometry(0.03, 0.03, 0.03), 0xff2a1a, 0, 0.75, -0.62);                // feu arrière
    const n = parts.reduce((a, g) => a + g.getAttribute('position').count, 0);
    const pos = new Float32Array(n * 3), cols = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
      g.computeVertexNormals();
      pos.set(g.getAttribute('position').array, o * 3);
      cols.set(g.getAttribute('color').array, o * 3);
      nor.set(g.getAttribute('normal').array, o * 3);
      o += g.getAttribute('position').count;
      g.dispose();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.BufferAttribute(cols, 3));
    return geo;
  }

  spawnBike(playerS) {
    const t = this.track, R = t.ramps, L = t.length;
    if (!R) return;
    const cands = R.list.filter((r) => r.kind !== 'W' && (() => { const d = wrap(r.j.s - playerS, L); return d > 220 && d < 650; })());
    if (!cands.length) return false;
    const r = cands[(this.rand() * cands.length) | 0];
    // sur une sortie : il monte la bretelle ; sur une entrée : il la descend vers la porte… à contresens ? non :
    // il suit le sens de circulation sur la bande de droite
    const s = r.kind === 'X' ? wrap(r.j.s + 40 + this.rand() * 60, L) : wrap(r.j.s - 200 + this.rand() * 40, L);
    const m = new this.T.Mesh(this.bikeGeom, this.mat.bike);
    m.castShadow = true;
    this.scene.add(m);
    this.bikes.push({ r, s, v: 5.5 + this.rand() * 2, mesh: m, wob: this.rand() * 6 });
    return true;
  }

  update(dt, player, traffic) {
    this.time += dt;
    const t = this.track, R = t.ramps, L = t.length, p = this._p;
    if (!R) return;
    // feux : construits à l'approche, retirés derrière
    for (const r of this.equipped) {
      const d = loopDelta(r.j.s, player.s, L);
      const near = d > -80 && d < 650;
      if (near && !this.lights.has(r)) { const Lt = this.buildLight(r); if (Lt) this.lights.set(r, Lt); else this.lights.set(r, { ramp: r, phase: 0, group: null, dead: true }); }
      if (!near && this.lights.has(r)) { const Lt = this.lights.get(r); if (Lt.group) this.scene.remove(Lt.group); this.lights.delete(r); }
    }
    for (const Lt of this.lights.values()) {
      if (!Lt.group) continue;
      const ph = (this.time + Lt.phase) % CYCLE;
      const red = ph > GREEN, amber = ph > GREEN - 0.8 && ph <= GREEN;
      Lt.red.material = red ? this.mat.redOn : this.mat.off;
      Lt.green.material = !red && !amber ? this.mat.greenOn : this.mat.off;
      Lt.amber.material = amber ? (this.mat.amberOn || (this.mat.amberOn = new this.T.MeshBasicMaterial({ color: 0xffb21a, toneMapped: false }))) : this.mat.off;
    }
    // livreurs à vélo
    this.nextBikeAt -= player.v * dt;
    if (this.nextBikeAt <= 0 && this.bikes.length < 2) this.nextBikeAt = this.spawnBike(player.s) ? 700 + this.rand() * 1200 : 120;
    for (let i = this.bikes.length - 1; i >= 0; i--) {
      const b = this.bikes[i];
      b.s = wrap(b.s + b.v * dt, L);
      t.pointAt(b.s, p);
      const o = R.one(b.r, b.s, p.y);
      const back = loopDelta(player.s, b.s, L);
      if (!o || (o.parallel && b.r.kind === 'E') || back > 150) { this.scene.remove(b.mesh); this.bikes.splice(i, 1); continue; }
      const lat = t.mainEdgeAt(b.s) + o.gap + o.w - 0.6 + Math.sin(this.time * 1.3 + b.wob) * 0.08;
      b.mesh.position.set(p.x + p.rx * lat, o.hr, p.z + p.rz * lat);
      b.mesh.rotation.set(0, Math.atan2(p.tx, p.tz), Math.sin(this.time * 2.2 + b.wob) * 0.03);
      b.lat = lat;
    }
  }

  // obstacles pour les collisions du joueur (cyclistes)
  obstacles() {
    return this.bikes.map((b) => ({ s: b.s, lat: b.lat ?? 0, len: 1.8, wid: 0.7, v: b.v, bike: true }));
  }

  reset() {
    for (const Lt of this.lights.values()) if (Lt.group) this.scene.remove(Lt.group);
    this.lights.clear();
    for (const b of this.bikes) this.scene.remove(b.mesh);
    this.bikes = [];
    this.nextBikeAt = 400;
  }
}
