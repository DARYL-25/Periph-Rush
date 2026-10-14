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
import { personGeometry } from './people.js';

const STOP_VV = 110;        // ligne d'arrêt : 110 m avant le raccordement
const CYCLE = 11, GREEN = 3.2;

export class RampLife {
  constructor(THREE, scene, track) {
    Object.assign(this, { T: THREE, scene, track });
    this.rand = rng(7331);
    this.time = 0;
    this.lights = new Map();     // ramp -> { ramp, phase, group }
    this.bikes = [];
    this.walkers = [];
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

  // v24 : trottinette électrique + usager debout (casque, sac à dos)
  makeScooter() {
    const T = this.T;
    const pg = personGeometry(T, { shirt: 0x3a4a5e, pants: 0x22252b, head: 0xe8eaed, pose: 'stand', rnd: this.rand });
    pg.translate(0, 0.16, 0);
    const parts = [pg];
    const col = (g, hex) => { const c = new T.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
    const add = (g, hex, x, y, z, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); parts.push(col(g, hex)); };
    add(new T.BoxGeometry(0.16, 0.05, 0.85), 0x1a1c1f, 0, 0.12, 0);
    add(new T.CylinderGeometry(0.02, 0.02, 1.05, 6), 0x2b2f35, 0, 0.62, 0.42, 0.12);
    add(new T.BoxGeometry(0.48, 0.03, 0.03), 0x111214, 0, 1.12, 0.48);
    for (const z of [-0.4, 0.42]) add(new T.CylinderGeometry(0.1, 0.1, 0.05, 10), 0x111214, 0, 0.1, z, 0, Math.PI / 2);
    parts[0] = pg.index ? pg.toNonIndexed() : pg;
    const n = parts.reduce((a, q) => a + q.getAttribute('position').count, 0);
    const pos = new Float32Array(n * 3), cols = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const q of parts) { q.computeVertexNormals(); pos.set(q.getAttribute('position').array, o * 3); cols.set(q.getAttribute('color').array, o * 3); nor.set(q.getAttribute('normal').array, o * 3); o += q.getAttribute('position').count; }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.BufferAttribute(cols, 3));
    return geo;
  }

  // v24 : piétons sur le pont de la porte suivante (trottoir côté trafic qui arrive)
  updateWalkers(dt, player) {
    const t = this.track, L = t.length, p = this._p;
    const cover = t.covers.map((c) => ({ c, d: wrap(c.s0 - player.s, L) })).filter((q) => q.d > 60 && q.d < 700 && wrap(q.c.s1 - q.c.s0, L) < 170).sort((a, b) => a.d - b.d)[0];
    if (cover && this.walkCover !== cover.c) {
      for (const w of this.walkers) this.scene.remove(w.mesh);
      this.walkers = [];
      this.walkCover = cover.c;
      const n = 2 + ((this.rand() * 4) | 0);
      t.pointAt(cover.c.s0, p);
      const deck = p.y + 5.3 + 1.3 + 0.3;
      for (let k = 0; k < n; k++) {
        const g = personGeometry(this.T, { shirt: [0x2d3b55, 0x7a2b2b, 0x3e5a3e, 0xd6d0c4, 0x222428][(this.rand() * 5) | 0], pants: 0x2b3442, head: this.rand() < 0.5 ? 0x2a2018 : null, pose: 'stand', rnd: this.rand });
        const m = new this.T.Mesh(g, this.mat.bike);
        m.castShadow = true;
        this.scene.add(m);
        this.walkers.push({ mesh: m, s: cover.c.s0 + 0.9 + this.rand() * 0.6, lat: (this.rand() * 2 - 1) * 22, v: (this.rand() < 0.5 ? -1 : 1) * (1.0 + this.rand() * 0.6), deck, ph: this.rand() * 6 });
      }
    }
    if (!cover && this.walkers.length && loopDelta(player.s, this.walkCover?.s1 ?? 0, L) > 30) {
      for (const w of this.walkers) this.scene.remove(w.mesh);
      this.walkers = []; this.walkCover = null;
    }
    for (const w of this.walkers) {
      w.lat += w.v * dt;
      if (Math.abs(w.lat) > 24) w.v = -w.v;
      t.pointAt(w.s, p);
      w.mesh.position.set(p.x + p.rx * w.lat, w.deck + Math.abs(Math.sin(this.time * 5 + w.ph)) * 0.03, p.z + p.rz * w.lat);
      w.mesh.rotation.y = Math.atan2(p.rx * Math.sign(w.v), p.rz * Math.sign(w.v));
    }
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
    const h = this.hour ?? 14, rush = (h > 7 && h < 10) || (h > 16.5 && h < 20);
    const scoot = rush && this.rand() < 0.55;
    if (scoot && !this.scootGeom) this.scootGeom = this.makeScooter();
    const m = new this.T.Mesh(scoot ? this.scootGeom : this.bikeGeom, this.mat.bike);
    m.castShadow = true;
    this.scene.add(m);
    this.bikes.push({ r, s, v: (scoot ? 5.0 : 5.5) + this.rand() * 2, mesh: m, wob: this.rand() * 6 });
    return true;
  }

  update(dt, player, traffic, events) {
    this.time += dt;
    if (((this._lcsT = (this._lcsT || 0) + 1) % 15) === 0) { this.updateLCS(player, events); this.updateTunnelSigns(player); }
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
    this.updateWalkers(dt, player);
    // livreurs à vélo (trottinettes aux heures de pointe)
    this.nextBikeAt -= player.v * dt * ((this.hour ?? 14) > 7 && (this.hour ?? 14) < 20 ? 1.6 : 1);
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

  // ---------- v24 : signalisation d'affectation de voies (croix rouges / flèches) ----------
  // Portiques en amont d'un événement (350 m : flèche de rabattement sur les voies fermées,
  // 150 m : croix rouge), et sous les couvertures de plus de 300 m des signaux au plafond
  // (flèches vertes, croix rouge si une voie est fermée plus loin).
  lcsMat(kind) {
    this._lcs = this._lcs || {};
    if (this._lcs[kind]) return this._lcs[kind];
    const T = this.T, cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#050607'; c.fillRect(0, 0, 64, 64);
    const dots = (draw) => { // rendu « LED » : tracé épais puis points
      const m = document.createElement('canvas'); m.width = m.height = 16;
      const mc = m.getContext('2d'); mc.lineCap = 'round'; mc.lineJoin = 'round'; draw(mc);
      const d = mc.getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (d[i + 3] < 90) continue;
        c.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
        c.beginPath(); c.arc(x * 4 + 2, y * 4 + 2, 1.7, 0, Math.PI * 2); c.fill();
      }
    };
    if (kind === 'x') dots((m) => { m.strokeStyle = '#ff2a1a'; m.lineWidth = 2.6; m.beginPath(); m.moveTo(3, 3); m.lineTo(13, 13); m.moveTo(13, 3); m.lineTo(3, 13); m.stroke(); });
    else if (kind === 'down') dots((m) => { m.strokeStyle = '#33ff6a'; m.lineWidth = 2.4; m.beginPath(); m.moveTo(8, 2); m.lineTo(8, 13); m.moveTo(3.5, 8.5); m.lineTo(8, 13); m.lineTo(12.5, 8.5); m.stroke(); });
    else dots((m) => { const sg = kind === 'right' ? 1 : -1; m.strokeStyle = '#ffd21a'; m.lineWidth = 2.4; m.beginPath(); m.moveTo(8 - sg * 5, 3); m.lineTo(8 + sg * 4, 12); m.moveTo(8 + sg * 4, 5.5); m.lineTo(8 + sg * 4, 12); m.lineTo(8 - sg * 2.5, 12); m.stroke(); });
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    return (this._lcs[kind] = new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
  }
  buildGantry(s, states, ceiling = false) {
    const T = this.T, t = this.track, p = this._p;
    t.pointAt(s, p);
    const g = new T.Group();
    const at = (lat, y) => new T.Vector3(p.x + p.rx * lat, y, p.z + p.rz * lat);
    const yaw = Math.atan2(p.tx, p.tz);
    const Em = t.mainEdgeAt(s), yb = p.y + (ceiling ? 4.85 : 5.7);
    if (!ceiling) {
      for (const lat of [0, Em + 1.3]) { const post = new T.Mesh(new T.BoxGeometry(0.35, yb - p.y + 0.4, 0.35), this.mat.pole); post.position.copy(at(lat, p.y + (yb - p.y + 0.4) / 2)); post.rotation.y = yaw; g.add(post); }
      const beam = new T.Mesh(new T.BoxGeometry(Em + 1.6, 0.5, 0.45), this.mat.pole);
      beam.position.copy(at((Em + 1.3) / 2, yb + 0.15)); beam.rotation.y = yaw + Math.PI / 2; g.add(beam);
    }
    states.forEach((st, lane) => {
      const lat = 1.3 + 3.5 * (lane + 0.5);
      const housing = new T.Mesh(new T.BoxGeometry(1.0, 1.0, 0.3), this.mat.head);
      housing.position.copy(at(lat, yb - 0.55)); housing.rotation.y = yaw; g.add(housing);
      const face = new T.Mesh(new T.PlaneGeometry(0.86, 0.86), this.lcsMat(st));
      face.position.copy(at(lat, yb - 0.55)).addScaledVector(new T.Vector3(-p.tx, 0, -p.tz), 0.16);
      face.rotation.y = yaw + Math.PI; g.add(face);
    });
    this.scene.add(g);
    return g;
  }
  updateLCS(player, events) {
    const t = this.track, L = t.length;
    const want = new Map();
    for (const e of events?.active || []) {
      const d = loopDelta(e.s0, player.s, L);
      if (d < -50 || d > 1400 || !e.lanes?.length) continue;
      const nl = t.lanesAt(e.s0);
      const open = [...Array(nl).keys()].filter((k) => !e.lanes.includes(k));
      for (const [ds, near] of [[350, false], [150, true]]) {
        const s = wrap(e.s0 - ds, L);
        const st = [...Array(t.lanesAt(s)).keys()].map((k) => {
          if (!e.lanes.includes(k)) return 'down';
          if (near) return 'x';
          const toward = open.length ? (open.reduce((a, b) => (Math.abs(b - k) < Math.abs(a - k) ? b : a)) > k ? 'right' : 'left') : 'x';
          return toward;
        });
        want.set(`${e.s0.toFixed(0)}:${ds}`, { s, st, ceiling: !!t.coverAt(s) });
      }
    }
    // couvertures longues : signaux au plafond tous les 150 m
    for (const c of t.covers) {
      const len = wrap(c.s1 - c.s0, L);
      if (len < 300) continue;
      for (let x = 60; x < len - 30; x += 150) {
        const s = wrap(c.s0 + x, L), d = loopDelta(s, player.s, L);
        if (d < -40 || d > 700) continue;
        const key = `cov:${s.toFixed(0)}`;
        if (want.has(key)) continue;
        const closed = (events?.active || []).find((e) => { const de = loopDelta(e.s0, s, L); return de > 0 && de < 600; });
        want.set(key, { s, st: [...Array(t.lanesAt(s)).keys()].map((k) => (closed?.lanes?.includes(k) ? 'x' : 'down')), ceiling: true });
      }
    }
    this.gantries = this.gantries || new Map();
    for (const [k, gtr] of this.gantries) {
      const w = want.get(k);
      if (!w || w.st.join() !== gtr.sig) { this.scene.remove(gtr.g); this.gantries.delete(k); }
    }
    for (const [k, w] of want) if (!this.gantries.has(k)) this.gantries.set(k, { g: this.buildGantry(w.s, w.st, w.ceiling), sig: w.st.join() });
  }

  // v24 : panneau « ALLUMEZ VOS FEUX » (pictogramme de projecteur) avant les couvertures longues
  feuxTexture() {
    if (this._feux) return this._feux;
    const T = this.T, cv = document.createElement('canvas');
    cv.width = 256; cv.height = 320;
    const c = cv.getContext('2d');
    c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, 256, 320);
    c.fillStyle = '#1f4fa8'; c.fillRect(10, 10, 236, 236);
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(96, 128, 40, 52, 0, -Math.PI / 2, Math.PI / 2); c.fill();
    c.fillRect(80, 76, 16, 104);
    c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round';
    for (let k = 0; k < 5; k++) { const y = 92 + k * 18; c.beginPath(); c.moveTo(150, y); c.lineTo(205, y + 10); c.stroke(); }
    c.fillStyle = '#111'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center';
    c.fillText('ALLUMEZ', 128, 282); c.fillText('VOS FEUX', 128, 314);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    return (this._feux = new T.MeshLambertMaterial({ map: tex }));
  }
  updateTunnelSigns(player) {
    const t = this.track, L = t.length, p = this._p, R = t.ramps;
    this.tSigns = this.tSigns || new Map();
    for (const c of t.covers) {
      const len = wrap(c.s1 - c.s0, L), s = wrap(c.s0 - 140, L), d = loopDelta(s, player.s, L);
      const near = len > 240 && d > -60 && d < 800;
      if (near && !this.tSigns.has(c)) {
        t.pointAt(s, p);
        const B = R ? R.barrier(s, p.y) : null;
        const lat = B ? B.face + 0.75 : t.mainEdgeAt(s) + 1.3;
        const g = new this.T.Group();
        const pole = new this.T.Mesh(new this.T.CylinderGeometry(0.05, 0.05, 2.9, 6), this.mat.pole);
        pole.position.set(p.x + p.rx * lat, p.y + 1.45, p.z + p.rz * lat);
        const panel = new this.T.Mesh(new this.T.PlaneGeometry(1.0, 1.25), this.feuxTexture());
        panel.position.set(p.x + p.rx * lat, p.y + 2.5, p.z + p.rz * lat);
        panel.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
        g.add(pole, panel);
        this.scene.add(g);
        this.tSigns.set(c, g);
      } else if (!near && this.tSigns.has(c)) { this.scene.remove(this.tSigns.get(c)); this.tSigns.delete(c); }
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
    for (const w of this.walkers) this.scene.remove(w.mesh);
    this.walkers = []; this.walkCover = null;
    if (this.gantries) { for (const gtr of this.gantries.values()) this.scene.remove(gtr.g); this.gantries.clear(); }
    if (this.tSigns) { for (const g of this.tSigns.values()) this.scene.remove(g); this.tSigns.clear(); }
    this.nextBikeAt = 400;
  }
}
