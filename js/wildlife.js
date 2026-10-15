// ============================================================
// Périph' Rush — v27 : petite vie du bord de route
//  • pigeons posés sur la bande d'arrêt / sous les ponts, qui
//    s'envolent quand on approche
//  • feuilles mortes et sacs plastique soulevés par le vent et par
//    le souffle des véhicules (poids lourds surtout)
//  • feuilles qui tombent des arbres en automne (date réelle)
// Tout est instancié (2 draw calls) et limité au voisinage du joueur.
// ============================================================

import { CFG, MS } from './config.js';
import { wrap, loopDelta, rng } from './utils.js';

export function seasonNow(date = new Date()) {
  const m = date.getMonth(), d = date.getDate();
  const t = m + d / 31;                       // 0 = 1er janvier … 12
  if (t >= 11.6 || t < 2.6) return 'hiver';   // mi-déc → mi-mars : arbres nus
  if (t < 5.2) return 'printemps';
  if (t < 8.6) return 'ete';
  return 'automne';                           // mi-sept → mi-déc
}

export class Wildlife {
  constructor(T, scene, track) {
    Object.assign(this, { T, scene, track });
    this.rand = rng(2727);
    this.season = seasonNow();
    this._p = {};
    // --- pigeons : corps + 2 ailes (une instance par oiseau, ailes animées par échelle) ---
    const body = new T.BoxGeometry(0.2, 0.16, 0.36);
    const head = new T.BoxGeometry(0.1, 0.1, 0.11).translate(0, 0.11, 0.19);
    const bodyG = mergeBoxes(T, [body, head]);
    this.birdMat = new T.MeshLambertMaterial({ color: 0x8a919c });
    this.wingMat = new T.MeshLambertMaterial({ color: 0x5f656e, side: T.DoubleSide });
    this.N = 48;
    this.bodies = new T.InstancedMesh(bodyG, this.birdMat, this.N);
    this.wings = new T.InstancedMesh(new T.PlaneGeometry(0.34, 0.2).rotateX(-Math.PI / 2).translate(0.15, 0, 0), this.wingMat, this.N * 2);
    for (const m of [this.bodies, this.wings]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
    this.birds = [];
    // --- débris : feuilles et sacs (quads double face, couleur par instance) ---
    this.DN = 90;
    this.debrisMat = new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.92 });
    this.debris = new T.InstancedMesh(new T.PlaneGeometry(1, 1), this.debrisMat, this.DN);
    this.debris.frustumCulled = false; this.debris.count = 0;
    this.debris.instanceColor = new T.InstancedBufferAttribute(new Float32Array(this.DN * 3), 3);
    scene.add(this.debris);
    this.items = [];
    this.nextBirds = 300; this.windT = 0;
    this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._v = new T.Vector3(); this._s = new T.Vector3(); this._c = new T.Color();
  }

  reset() { this.birds = []; this.items = []; this.nextBirds = 250; }

  // ---------- apparition ----------
  spawnFlock(player, hour) {
    const t = this.track, L = t.length, p = this._p;
    const s0 = wrap(player.s + 180 + this.rand() * 160, L);
    const cover = !!t.coverAt(s0);
    t.pointAt(s0, p);
    const edge = t.mainEdgeAt(s0);
    const n = 4 + Math.floor(this.rand() * 7);
    // sous un pont : sur la chaussée de droite ; sinon sur la bande d'arrêt / le pied du mur
    for (let i = 0; i < n && this.birds.length < this.N; i++) {
      const s = wrap(s0 + (this.rand() - 0.5) * 10, L), lat = cover ? edge - 1 - this.rand() * 4 : edge - 0.6 + this.rand() * 1.0;
      this.birds.push({ s, lat, y: null, vy: 0, vs: 0, vl: 0, fly: false, ph: this.rand() * 6, peck: this.rand() * 3, yaw: this.rand() * 6.28, life: 0 });
    }
    void hour;
  }
  spawnDebris(player, autumn) {
    const t = this.track, L = t.length;
    const s = wrap(player.s + 40 + this.rand() * 140, L), edge = t.mainEdgeAt(s);
    const bag = this.rand() < (autumn ? 0.12 : 0.45);
    const lat = this.rand() < 0.7 ? edge - this.rand() * 3 : 1 + this.rand() * (edge - 2);
    const it = { s, lat, h: 0.02, vs: 0, vl: 0, vy: 0, spin: 0, rx: this.rand() * 6, ry: this.rand() * 6, bag, size: bag ? 0.45 + this.rand() * 0.25 : 0.12 + this.rand() * 0.08, life: 0, falling: false };
    if (bag) this._c.setHSL(0, 0, 0.88 + this.rand() * 0.1); else this._c.setHSL(0.05 + this.rand() * 0.07, 0.6 + this.rand() * 0.3, 0.32 + this.rand() * 0.2);
    it.col = this._c.clone();
    this.items.push(it);
  }
  spawnFallingLeaf(player) {
    const t = this.track, L = t.length, s = wrap(player.s + 20 + this.rand() * 90, L), edge = t.mainEdgeAt(s);
    if (t.coverAt(s)) return;
    const side = this.rand() < 0.75 ? 1 : -1;
    const lat = side > 0 ? edge + 1 + this.rand() * 4 : -1 - this.rand() * 2;
    this._c.setHSL(0.06 + this.rand() * 0.08, 0.65 + this.rand() * 0.25, 0.38 + this.rand() * 0.2);
    this.items.push({ s, lat, h: 5 + this.rand() * 5, vs: 0, vl: -side * (0.3 + this.rand() * 0.6), vy: -0.8, spin: 2 + this.rand() * 3, rx: this.rand() * 6, ry: this.rand() * 6, bag: false, size: 0.12 + this.rand() * 0.06, life: 0, falling: true, col: this._c.clone() });
  }

  // ---------- boucle ----------
  update(dt, player, traffic, ambience) {
    const t = this.track, L = t.length, p = this._p;
    const hour = ambience?.hour ?? 14, day = hour > 6.5 && hour < 21.5, rain = ambience?.rainAmt || 0;
    const autumn = this.season === 'automne';
    this.windT += dt;
    const wind = 0.6 + 0.6 * Math.sin(this.windT * 0.13) + 0.4 * Math.sin(this.windT * 0.71);
    // apparitions
    this.nextBirds -= Math.max(player.v, 4) * dt;
    if (day && rain < 0.4 && this.nextBirds <= 0) { this.nextBirds = 600 + this.rand() * 900; this.spawnFlock(player, hour); }
    if (this.items.length < 26 && this.rand() < dt * (autumn ? 1.8 : 0.5) * (1 + wind)) this.spawnDebris(player, autumn);
    if (autumn && this.items.length < 70 && this.rand() < dt * 2.2 * (0.6 + wind)) this.spawnFallingLeaf(player);

    // véhicules proches (souffle) : joueur + PNJ à moins de 60 m
    const movers = [{ s: player.s, lat: player.lat, v: player.v, heavy: false }];
    for (const n of traffic.npcs) { const d = loopDelta(n.s, player.s, L); if (d > -40 && d < 220 && n.v > 6) movers.push({ s: n.s, lat: n.lat, v: n.v, heavy: n.heavy || (n.len > 7) }); }

    // --- pigeons ---
    let bi = 0, wi = 0;
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.life += dt;
      const d = loopDelta(b.s, player.s, L);
      if (d < -40 || d > 600 || b.life > 120) { this.birds.splice(i, 1); continue; }
      if (!b.fly) {
        for (const m of movers) { const dd = loopDelta(b.s, m.s, L); if (dd > -3 && dd < 14 + m.v * 0.9 && Math.abs(m.lat - b.lat) < 6) { b.fly = true; b.vy = 2.5 + this.rand() * 1.5; b.vs = m.v * 0.35 + 2 + this.rand() * 3; b.vl = (b.lat > m.lat ? 1 : -1) * (2 + this.rand() * 3); break; } }
        b.peck += dt;
      } else {
        b.vy = Math.max(-0.5, b.vy - dt * 0.4);
        b.s = wrap(b.s + b.vs * dt, L); b.lat += b.vl * dt;
        b.yRel = (b.yRel || 0) + b.vy * dt;
        b.ph += dt * 22;
      }
      t.pointAt(b.s, p);
      const y = p.y + 0.12 + (b.yRel || 0);
      const yaw = b.fly ? Math.atan2(p.tx, p.tz) + Math.atan2(b.vl, Math.max(1, b.vs)) * 0.6 : b.yaw + Math.sin(b.peck * 1.3) * 0.4;
      const bob = b.fly ? 0 : Math.max(0, Math.sin(b.peck * 4)) * 0.05;
      this._v.set(p.x + p.rx * b.lat, y - bob, p.z + p.rz * b.lat);
      this._e.set(b.fly ? -0.15 : bob * 4, yaw, 0); this._q.setFromEuler(this._e);
      this._s.set(1, 1, 1);
      this._m.compose(this._v, this._q, this._s);
      this.bodies.setMatrixAt(bi++, this._m);
      const flap = b.fly ? Math.sin(b.ph) * 0.9 : -0.05;
      for (const sd of [1, -1]) {
        this._e.set(0, yaw, sd * flap, 'YXZ'); this._q.setFromEuler(this._e);
        this._s.set(sd, 1, 1);
        this._m.compose(this._v, this._q, this._s);
        this.wings.setMatrixAt(wi++, this._m);
      }
      this._e.order = 'XYZ';
    }
    this.bodies.count = bi; this.wings.count = wi;
    this.bodies.instanceMatrix.needsUpdate = true; this.wings.instanceMatrix.needsUpdate = true;

    // --- feuilles et sacs ---
    let di = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      const d = loopDelta(it.s, player.s, L);
      if (d < -30 || d > 300 || it.life > 60) { this.items.splice(i, 1); continue; }
      // souffle des véhicules qui passent tout près
      for (const m of movers) {
        const dd = loopDelta(it.s, m.s, L), dl = it.lat - m.lat;
        if (dd > -6 && dd < 3 && Math.abs(dl) < (m.heavy ? 4.5 : 2.6) && m.v > 8) {
          const k = (m.heavy ? 1.6 : 0.8) * Math.min(1, m.v / 25) * (it.bag ? 1.4 : 1);
          it.vy = Math.max(it.vy, (1.5 + this.rand() * 2) * k); it.vs += m.v * 0.25 * k * dt * 8; it.vl += Math.sign(dl || 1) * 2 * k * dt * 8; it.spin = 6 + this.rand() * 6;
        }
      }
      // vent latéral + gravité + frottement au sol
      it.vl += (wind - 0.5) * (it.bag ? 0.9 : 0.5) * dt;
      if (it.h > 0.02 || it.vy > 0) {
        it.vy -= (it.bag ? 2.2 : 3.2) * dt; if (it.falling) it.vy = Math.max(it.vy, -0.9);
        it.h += it.vy * dt;
        if (it.h <= 0.02) { it.h = 0.02; it.vy = 0; it.falling = false; it.spin *= 0.3; }
      }
      const fr = it.h <= 0.02 ? 3.5 : 0.6;
      it.vs *= Math.exp(-fr * dt); it.vl *= Math.exp(-fr * dt * 0.6); it.spin *= Math.exp(-dt * 0.8);
      it.s = wrap(it.s + it.vs * dt, L); it.lat += it.vl * dt;
      it.rx += it.spin * dt; it.ry += it.spin * 0.7 * dt;
      t.pointAt(it.s, p);
      this._v.set(p.x + p.rx * it.lat, p.y + it.h, p.z + p.rz * it.lat);
      this._e.set(it.h <= 0.03 ? -Math.PI / 2 : it.rx, it.ry, 0); this._q.setFromEuler(this._e);
      const sz = it.size * (it.bag ? 1 : 1);
      this._s.set(sz, it.bag ? sz * 1.2 : sz * 0.8, 1);
      this._m.compose(this._v, this._q, this._s);
      this.debris.setMatrixAt(di, this._m);
      this.debris.setColorAt(di, it.col);
      di++;
    }
    this.debris.count = di;
    this.debris.instanceMatrix.needsUpdate = true;
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;
  }
}

function mergeBoxes(T, geos) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const gi = g.index ? g : g;
    const p = gi.getAttribute('position'), n = gi.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    for (let i = 0; i < gi.index.count; i++) idx.push(gi.index.getX(i) + base);
    base += p.count;
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}
void CFG; void MS;
