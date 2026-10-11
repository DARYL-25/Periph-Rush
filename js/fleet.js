// ============================================================
// Périph' Rush — rendu groupé (instancié) du trafic
// Tous les véhicules d'un même modèle sont dessinés en une seule
// passe (InstancedMesh) : couleur de carrosserie par instance, LOD
// proche / lointain choisi à chaque image, et « calques » instanciés
// pour les plaques (atlas), feux stop, clignotants / warnings,
// gyrophares, reflets sur chaussée mouillée et gerbes d'eau.
// Le trafic manipule des « poignées » compatibles avec l'ancien
// bundle (group / brake / glows), sans objet dans la scène.
// ============================================================

const LOD_DIST = 34, LOD_DIST2 = 95;

// retire la multiplication par instanceColor (vitrages, détails, optiques)
function noInstanceColor(THREE, mat) {
  const chunk = THREE.ShaderChunk.color_vertex.replace('vColor.xyz *= instanceColor.xyz;', '');
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', chunk); };
  mat.customProgramCacheKey = () => 'noInstColor';
  return mat;
}

// tache douce (gerbes d'eau)
function streakTexture(T) {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 128;
  const c = cv.getContext('2d');
  for (let y = 0; y < 128; y++) {
    const v = y / 127; // 1 = côté véhicule (haut de la texture)
    const a = Math.pow(v, 1.6) * 0.9;
    const gx = c.createLinearGradient(0, 0, 32, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, `rgba(255,255,255,${a})`); gx.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gx; c.fillRect(0, 127 - y, 32, 1);
  }
  return new T.CanvasTexture(cv);
}
function softTexture(T) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 40, 2, 32, 36, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(cv);
}

class Layer {
  constructor(T, scene, geom, mat, cap, { shadow = false, color = false, uv = false, order = 0 } = {}) {
    this.mesh = new T.InstancedMesh(geom, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = shadow;
    this.mesh.renderOrder = order;
    if (color) this.mesh.setColorAt(0, new T.Color(1, 1, 1));
    if (uv) {
      this.uv = new T.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      geom.setAttribute('plateUV', this.uv);
    }
    this.cap = cap;
    this.n = 0;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(m, color, uv) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.mesh.setMatrixAt(i, m);
    if (color) this.mesh.setColorAt(i, color);
    if (uv) this.uv.setXYZW(i, uv[0], uv[1], uv[2], uv[3]);
    return i;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    if (this.n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      if (this.uv) this.uv.needsUpdate = true;
    }
  }
}

export class Fleet {
  constructor(THREE, scene, factory, plates) {
    this.T = THREE;
    this.scene = scene;
    this.factory = factory;
    this.plates = plates;
    this.handles = new Set();
    this.buckets = new Map();
    this.time = 0;
    this.wet = 0;
    this.night = false;
    const T = THREE;
    // matériaux instanciés (partagés par tous les modèles)
    const f = factory;
    this.paintMat = new T.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0.55, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.05,
    });
    this.mats = [this.paintMat, ...[f.glassMat, f.matteMat, f.brightMat, f.lensFMat, f.lensRMat].map((m) => noInstanceColor(T, m.clone()))];
    f.instMats = this.mats; // setNight() met aussi à jour ces clones
    // calques
    const quad = (w, h) => new T.PlaneGeometry(w, h);
    const streak = streakTexture(T);
    const glowMat = (c, add = false, op = 1, map = null) => new T.MeshBasicMaterial({
      color: c, transparent: add || op < 1, opacity: op, depthWrite: !add, blending: add ? T.AdditiveBlending : T.NormalBlending, toneMapped: false, map,
    });
    this.L = {
      brake: new Layer(T, scene, quad(0.3, 0.09), f.glowBrake, 512),
      blink: new Layer(T, scene, quad(0.12, 0.08), glowMat(0xffa21a), 512),
      blue: new Layer(T, scene, new T.BoxGeometry(0.34, 0.12, 0.22), glowMat(0x2a6cff), 64),
      orange: new Layer(T, scene, new T.BoxGeometry(0.18, 0.1, 0.18), f.glowOrange, 64),
      streakR: new Layer(T, scene, quad(0.45, 3.4).rotateX(-Math.PI / 2).rotateY(Math.PI), glowMat(0xff2a18, true, 0.5, streak), 512, { order: 2 }),
      streakF: new Layer(T, scene, quad(0.7, 5).rotateX(-Math.PI / 2), glowMat(0xfff0d0, true, 0.35, streak), 512, { order: 2 }),
      spray: new Layer(T, scene, quad(1.6, 1.0), new T.MeshBasicMaterial({ color: 0xc8d2da, map: softTexture(T), transparent: true, opacity: 0.32, depthWrite: false }), 256, { order: 3 }),
    };
    // plaques : atlas + décalage d'UV par instance
    const pg = new T.PlaneGeometry(0.52, 0.11);
    const pm = new T.MeshBasicMaterial({ map: plates.atlasTexture(T) });
    pm.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec4 plateUV;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * plateUV.zw + plateUV.xy;\n#endif');
    };
    pm.customProgramCacheKey = () => 'plateAtlas';
    this.L.plate = new Layer(T, scene, pg, pm, 512, { uv: true });
    this._m = new T.Matrix4();
    this._l = new T.Matrix4();
    this._q = new T.Quaternion();
    this._v = new T.Vector3();
    this._s = new T.Vector3(1, 1, 1);
    this._c = new T.Color();
    this.camPos = new T.Vector3();
  }

  // gabarit d'un modèle : géométries proche/lointaine + positions locales des feux
  bucket(id) {
    if (this.buckets.has(id)) return this.buckets.get(id);
    const T = this.T, f = this.factory;
    const g = f.geometry(id), gf = f.farGeometry(id), gu = f.farGeometry(id, '_ufar');
    const m = f.specOf(id), ud = g.userData;
    const rot = new T.Matrix4().makeRotationY(-Math.PI / 2);
    const mk = (geom, shadow) => {
      const layer = new Layer(T, this.scene, geom, this.mats, 160, { shadow, color: true });
      layer.mesh.matrixAutoUpdate = false;
      return layer;
    };
    // la géométrie est en repère « modèle » (x = avant) : rotation -90° intégrée par instance
    const near = mk(g, true), far = gf ? mk(gf, false) : null, ufar = gu ? mk(gu, false) : null;
    const moto = !!ud.moto || m.kind === 'moto';
    const L = ud.L, W = ud.W, H = ud.H;
    const by = m.brakeY ?? H * (m.prof ? m.prof.tailH - 0.09 : 0.35);
    const lm = (x, y, z, ry = 0, sc = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sc, sc, sc));
    const b = {
      id, m, ud, near, far, ufar, rot, moto,
      plates: moto ? [lm(0, ud.wr + 0.35, -L / 2 - 0.02, Math.PI, 0.6)]
        : [lm(0, m.plateR ?? (m.plateHigh ? H * 0.37 : ud.yBot + 0.26), -L / 2 - 0.02, Math.PI), lm(0, m.plateF ?? ud.yBot + 0.22, L / 2 + 0.02)],
      brakes: moto ? [lm(0, ud.wr + 0.55, -L / 2 - 0.03, Math.PI, 0.5)] : [-1, 1].map((sd) => lm(sd * (W / 2 - 0.42), by, -L / 2 - 0.03, Math.PI)),
      // clignotants : [gauche…], [droite…] (la droite du véhicule = -X local)
      blinkL: moto ? [lm(0.16, ud.wr + 0.5, -L / 2, Math.PI), lm(0.16, 0.95, L / 2 - 0.2)] : [lm(W / 2 - 0.16, by, -L / 2 - 0.035, Math.PI), lm(W / 2 - 0.2, ud.yBot + 0.42, L / 2 + 0.02)],
      blinkR: moto ? [lm(-0.16, ud.wr + 0.5, -L / 2, Math.PI), lm(-0.16, 0.95, L / 2 - 0.2)] : [lm(-(W / 2 - 0.16), by, -L / 2 - 0.035, Math.PI), lm(-(W / 2 - 0.2), ud.yBot + 0.42, L / 2 + 0.02)],
      beacon: m.emergency ? [lm(0.32, H + 0.07, L * 0.12), lm(-0.32, H + 0.07, L * 0.12)]
        : (m.kind === 'tow' || m.municipal) ? [lm(0, H + 0.08, L * 0.17)] : [],
      streakR: moto ? [lm(0, 0.03, -L / 2 - 1.7)] : [-1, 1].map((sd) => lm(sd * (W / 2 - 0.42), 0.03, -L / 2 - 1.7)),
      streakF: moto ? [lm(0, 0.03, L / 2 + 2.4)] : [-1, 1].map((sd) => lm(sd * (W / 2 - 0.35), 0.03, L / 2 + 2.4)),
      spray: moto ? [lm(0, 0.45, -L / 2 - 0.5, 0)] : [lm(0, 0.5, -L / 2 - 0.6, 0, 1 + W * 0.25)],
    };
    this.buckets.set(id, b);
    return b;
  }

  // nouvelle poignée (même interface que factory.build pour le trafic)
  add(id, { color }) {
    const T = this.T;
    const b = this.bucket(id);
    const plate = this.plates.get();
    const group = new T.Object3D();
    const h = {
      id, spec: b.m, ud: b.ud, group, fleet: true,
      brake: { visible: false }, glows: { visible: false }, beacon: b.beacon.length ? {} : null,
      color: new T.Color(color ?? b.m.cols[0]),
      plateUV: this.plates.uvOf(plate.index), plateText: plate.text, plateCountry: plate.country,
      blink: 0,         // -1 gauche, 1 droite, 2 warnings
      blinkPhase: Math.random(),
      visible: true,
    };
    this.handles.add(h);
    return h;
  }
  remove(h) { this.handles.delete(h); }

  // composition : matrice du véhicule × matrice locale
  pushLocal(layer, base, local, uv) {
    this._m.multiplyMatrices(base, local);
    layer.push(this._m, null, uv);
  }

  update(dt, camera) {
    this.time += dt;
    const camPos = camera.getWorldPosition(this.camPos);
    const k = (this.lodScale ?? 1) * (this.handles.size > 90 ? 0.75 : 1);
    const D1 = (LOD_DIST * k) ** 2, D2 = (LOD_DIST2 * k) ** 2;
    for (const b of this.buckets.values()) { b.near.begin(); b.far?.begin(); b.ufar?.begin(); }
    for (const k in this.L) this.L[k].begin();
    const blinkOn = (h) => ((this.time + h.blinkPhase) % 0.8) < 0.42;
    const flash = Math.floor(this.time * 6) % 2;
    const wetLights = this.wet > 0.25;
    const night = this.night;
    for (const h of this.handles) {
      if (!h.visible) continue;
      const b = this.buckets.get(h.id);
      const g = h.group;
      g.updateMatrix();
      const base = g.matrix;
      const d2 = g.position.distanceToSquared(camPos);
      const lod = b.ufar && d2 > D2 ? b.ufar : b.far && d2 > D1 ? b.far : b.near;
      this._m.multiplyMatrices(base, b.rot);
      lod.push(this._m, h.color);
      if (d2 > 260 * 260) continue; // détails invisibles au loin
      for (const pl of b.plates) this.pushLocal(this.L.plate, base, pl, h.plateUV);
      if (h.brake.visible) for (const q of b.brakes) this.pushLocal(this.L.brake, base, q);
      if (h.blink && blinkOn(h)) {
        if (h.blink === -1 || h.blink === 2) for (const q of b.blinkL) this.pushLocal(this.L.blink, base, q);
        if (h.blink === 1 || h.blink === 2) for (const q of b.blinkR) this.pushLocal(this.L.blink, base, q);
      }
      if (h.beacon && b.beacon.length) {
        if (b.m.emergency) { if (h.sirenOn !== false) this.pushLocal(this.L.blue, base, b.beacon[flash]); }
        else if (Math.floor((this.time + h.blinkPhase) * 2.5) % 2) this.pushLocal(this.L.orange, base, b.beacon[0]);
      }
      if (wetLights && d2 < 180 * 180) {
        if (night || h.brake.visible) for (const q of b.streakR) this.pushLocal(this.L.streakR, base, q);
        if (night) for (const q of b.streakF) this.pushLocal(this.L.streakF, base, q);
        if (h.speed > 8 && d2 < 90 * 90) {
          // gerbe d'eau : plan face caméra derrière le véhicule
          this._v.setFromMatrixPosition(base);
          for (const q of b.spray) {
            this._m.multiplyMatrices(base, q);
            this._v.setFromMatrixPosition(this._m);
            const sc = Math.min(1.6, (h.speed - 6) / 10) * this.wet;
            this._q.copy(camera.quaternion);
            this._s.set(sc * (1 + b.ud.W * 0.3), sc, sc);
            this._m.compose(this._v, this._q, this._s);
            this.L.spray.push(this._m);
          }
        }
      }
    }
    for (const b of this.buckets.values()) { b.near.end(); b.far?.end(); b.ufar?.end(); }
    for (const k in this.L) this.L[k].end();
  }

  get count() { return this.handles.size; }
}
