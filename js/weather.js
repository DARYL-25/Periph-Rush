// ============================================================
// Périph' Rush — ambiances (heure + météo) et éclairage global
// v16 : horloge continue (lever, soleil rasant, coucher, nuit) et
// météo évolutive (averses, chaussée qui se mouille puis sèche,
// brouillard matinal). Les presets servent de palettes, mélangées
// selon la hauteur du soleil puis la pluie / le brouillard.
// ============================================================

import { lerp, clamp, smoothstep } from './utils.js';

const COLOR_KEYS = ['skyTop', 'skyHor', 'fog', 'hemiSky', 'hemiGrd', 'sunCol'];
const SUNRISE = 7.3, SUNSET = 19.9;

const PRESETS = {
  jour: {
    skyTop: 0x4e93d6, skyHor: 0xd8e6f2, fog: 0xc9d8e6, fogFar: 1050,
    hemiSky: 0xcaddee, hemiGrd: 0x8a8f84, hemiInt: 1.2,
    sunCol: 0xfff3d8, sunInt: 1.9, sunY: 0.8, sunX: 0.45,
    lamps: 0, windows: 0, wet: 0, rain: 0, head: 0, expo: 1.12, clouds: 0.8,
  },
  coucher: {
    skyTop: 0x4b5d8c, skyHor: 0xf2a35c, fog: 0xdba97e, fogFar: 900,
    hemiSky: 0xd8a880, hemiGrd: 0x584a42, hemiInt: 0.7,
    sunCol: 0xffa860, sunInt: 1.1, sunY: 0.16, sunX: -0.7,
    lamps: 0.75, windows: 0.45, wet: 0, rain: 0, head: 1, expo: 1.05, clouds: 0.55,
  },
  nuit: {
    skyTop: 0x0a1422, skyHor: 0x27354d, fog: 0x141d2c, fogFar: 780,
    hemiSky: 0x2a3a54, hemiGrd: 0x0d1014, hemiInt: 0.55,
    sunCol: 0x9fb6d8, sunInt: 0.28, sunY: 0.6, sunX: -0.3,
    lamps: 1, windows: 1, wet: 0, rain: 0, head: 1, expo: 1.15, clouds: 0.12,
  },
  nuitPluie: {
    skyTop: 0x0a1018, skyHor: 0x1e2836, fog: 0x10171f, fogFar: 560,
    hemiSky: 0x27364a, hemiGrd: 0x0d1014, hemiInt: 0.5,
    sunCol: 0x8ea6c8, sunInt: 0.22, sunY: 0.6, sunX: -0.3,
    lamps: 1, windows: 0.9, wet: 1, rain: 1, head: 1, expo: 1.15, clouds: 0.5,
  },
  brouillard: {
    skyTop: 0xb7c2cb, skyHor: 0xc9d2d8, fog: 0xc3ccd3, fogFar: 300,
    hemiSky: 0xc3ccd3, hemiGrd: 0x84888a, hemiInt: 0.8,
    sunCol: 0xe8e0d0, sunInt: 0.45, sunY: 0.5, sunX: 0.2,
    lamps: 0.8, windows: 0.3, wet: 0.4, rain: 0, head: 1, expo: 1.0, clouds: 0,
  },
  pluie: {
    skyTop: 0x6f7d8a, skyHor: 0xa8b2ba, fog: 0x9aa5ae, fogFar: 640,
    hemiSky: 0xa8b2ba, hemiGrd: 0x5e625e, hemiInt: 0.8,
    sunCol: 0xdde4ea, sunInt: 0.55, sunY: 0.7, sunX: 0.3,
    lamps: 0.35, windows: 0.25, wet: 1, rain: 1, head: 1, expo: 1.0, clouds: 1.0,
  },
};
// séquence au fil des tours (l'heure avance à chaque tour)
export const LAP_SEQUENCE = ['jour', 'coucher', 'nuit', 'nuitPluie', 'brouillard', 'pluie'];

export class Ambience {
  constructor(THREE, scene, camera) {
    this.T = THREE;
    this.scene = scene;
    this.camera = camera;
    this.cur = { ...PRESETS.jour };
    this.from = { ...PRESETS.jour };
    this.target = PRESETS.jour;
    this.blend = 1;
    this.hooks = {}; // matériaux du monde enregistrés par world.js

    this.hemi = new THREE.HemisphereLight(0xbcd3ea, 0x6f7468, 0.95);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3d8, 1.5);
    this.sun.position.set(300, 500, 150);
    // ombres portées : caméra orthographique serrée qui suit le joueur
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
    sc.near = 60; sc.far = 1100;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.7;
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    scene.add(this.sun);
    scene.fog = new THREE.Fog(0xc4d4e2, 60, 1050);

    // dôme de ciel : dégradé + nuages procéduraux + disque solaire
    const cloudCv = document.createElement('canvas');
    cloudCv.width = 512; cloudCv.height = 256;
    {
      const cc = cloudCv.getContext('2d');
      cc.fillStyle = '#000';
      cc.fillRect(0, 0, 512, 256);
      // amas floconneux superposés (octaves grossières)
      for (let o = 0; o < 3; o++) {
        const nb = [26, 60, 140][o], r0 = [34, 16, 7][o], a = [0.16, 0.12, 0.09][o];
        for (let i = 0; i < nb; i++) {
          const x = Math.random() * 512, y = 40 + Math.random() * 130, r = r0 * (0.5 + Math.random());
          const g2 = cc.createRadialGradient(x, y, 0, x, y, r);
          g2.addColorStop(0, `rgba(255,255,255,${a})`);
          g2.addColorStop(1, 'rgba(255,255,255,0)');
          cc.fillStyle = g2;
          cc.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }
    }
    const cloudTex = new THREE.CanvasTexture(cloudCv);
    cloudTex.wrapS = THREE.RepeatWrapping;
    const skyGeo = new THREE.SphereGeometry(3800, 24, 14);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x5f9bd8) },
        hor: { value: new THREE.Color(0xcfe0ee) },
        clouds: { value: 0.8 },
        cloudTint: { value: new THREE.Color(0xffffff) },
        sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
        sunCol: { value: new THREE.Color(0xfff3d8) },
        sunAmt: { value: 1.0 },
        drift: { value: 0 },
        cloudMap: { value: cloudTex },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vP;
        uniform vec3 top; uniform vec3 hor; uniform vec3 cloudTint; uniform vec3 sunCol;
        uniform vec3 sunDir; uniform float clouds; uniform float sunAmt; uniform float drift;
        uniform sampler2D cloudMap;
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y * 1.6, 0.0, 1.0);
          vec3 col = mix(hor, top, pow(h, 0.75));
          // nuages projetés sur le dôme (drift lent)
          if (d.y > 0.02) {
            vec2 uv = vec2(atan(d.z, d.x) / 6.2831 + drift, clamp(d.y * 1.35, 0.0, 1.0));
            float c = texture2D(cloudMap, uv).r * clouds;
            c *= smoothstep(0.02, 0.18, d.y);
            col = mix(col, cloudTint, clamp(c, 0.0, 0.85));
          }
          // soleil : disque net + halo large
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * sunAmt * (pow(sd, 900.0) * 1.6 + pow(sd, 24.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // pluie : gouttes instanciées autour de la caméra
    const drop = new THREE.PlaneGeometry(0.025, 0.55);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0x9db4c8, transparent: true, opacity: 0.0, depthWrite: false,
    });
    this.rainCount = 620;
    this.rain = new THREE.InstancedMesh(drop, this.rainMat, this.rainCount);
    this.rain.frustumCulled = false;
    this.rainSeeds = [];
    for (let i = 0; i < this.rainCount; i++) {
      this.rainSeeds.push({ x: Math.random() * 30 - 15, y: Math.random() * 16, z: Math.random() * 34 - 8, v: 16 + Math.random() * 8 });
    }
    scene.add(this.rain);
    this._m4 = new THREE.Matrix4();
  }

  register(hooks) { Object.assign(this.hooks, hooks); }

  // qualité des ombres selon la puissance de l'appareil
  setShadowQuality(tier) {
    const size = tier === 'high' ? 4096 : tier === 'med' ? 2048 : 1024;
    const span = tier === 'high' ? 70 : 55;
    const sh = this.sun.shadow;
    if (sh.mapSize.x === size && this._span === span) return;
    sh.mapSize.set(size, size);
    const sc = sh.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
    sc.updateProjectionMatrix();
    sh.radius = tier === 'high' ? 2 : 1;
    this._span = span;
    if (sh.map) { sh.map.dispose(); sh.map = null; }
  }

  // ---------- horloge & météo continues -------------------------------------
  // hour : heure de départ ; weather : 'auto' | 'soleil' | 'pluie'
  startDay(hour, weather = 'auto', rand = Math.random) {
    this.continuous = true;
    this.hour = hour;
    this.clockSpeed = 20; // 1 s réelle = 20 s de jeu
    this.weatherMode = weather;
    this.rand = rand;
    const rainy = weather === 'pluie' || (weather === 'auto' && rand() < 0.3);
    this.rainTarget = rainy ? 0.6 + rand() * 0.4 : 0;
    this.rainAmt = this.rainTarget;
    this.wetAmt = rainy ? 1 : (weather === 'auto' && rand() < 0.15 ? 0.6 : 0); // chaussée encore humide
    this.fogTarget = weather === 'auto' && hour > 5 && hour < 9.5 && rand() < 0.35 ? 0.7 : 0;
    this.fogAmt = this.fogTarget;
    this.nextWeatherT = 60 + rand() * 120;
    this.computePalette(0, true);
  }
  // palette selon la hauteur du soleil, puis pluie et brouillard
  sunElevation(h = this.hour) {
    const hh = ((h % 24) + 24) % 24;
    if (hh > SUNRISE && hh < SUNSET) return Math.sin(Math.PI * (hh - SUNRISE) / (SUNSET - SUNRISE));
    const night = hh >= SUNSET ? hh - SUNSET : hh + 24 - SUNSET;
    const len = 24 - (SUNSET - SUNRISE);
    return -Math.sin(Math.PI * night / len) * 0.6;
  }
  blendInto(out, a, b, t) {
    for (const k in a) {
      if (COLOR_KEYS.includes(k)) {
        const ca = a[k] instanceof this.T.Color ? a[k] : new this.T.Color(a[k]);
        const cb = b[k] instanceof this.T.Color ? b[k] : new this.T.Color(b[k]);
        out[k] = ca.clone().lerp(cb, t);
      } else out[k] = lerp(a[k], b[k], t);
    }
    return out;
  }
  computePalette(dt, snap = false) {
    const e = this.sunElevation();
    let base;
    if (e > 0.28) base = this.blendInto({}, PRESETS.jour, PRESETS.jour, 0);
    else if (e > 0) base = this.blendInto({}, PRESETS.coucher, PRESETS.jour, smoothstep(0.02, 0.28, e));
    else if (e > -0.18) base = this.blendInto({}, PRESETS.nuit, PRESETS.coucher, smoothstep(-0.18, 0, e));
    else base = this.blendInto({}, PRESETS.nuit, PRESETS.nuit, 0);
    // course du soleil : à l'est le matin, à l'ouest le soir
    const hh = ((this.hour % 24) + 24) % 24;
    base.sunX = Math.cos(Math.PI * clamp((hh - SUNRISE) / (SUNSET - SUNRISE), 0, 1));
    base.sunY = Math.max(0.06, e);
    // pluie
    const r = this.rainAmt;
    if (r > 0.001) {
      const wetP = e > 0.05 ? PRESETS.pluie : PRESETS.nuitPluie;
      const keep = { sunX: base.sunX, sunY: base.sunY };
      base = this.blendInto({}, base, wetP, clamp(r * 0.9, 0, 0.9));
      Object.assign(base, keep);
    }
    if (this.fogAmt > 0.001) {
      const keep = { sunX: base.sunX, sunY: base.sunY, lamps: base.lamps, head: base.head };
      base = this.blendInto({}, base, PRESETS.brouillard, this.fogAmt * 0.85);
      Object.assign(base, keep);
    }
    base.rain = r;
    base.wet = this.wetAmt;
    base.lamps = Math.max(smoothstep(0.14, -0.04, e), r > 0.5 && e < 0.4 ? 0.4 : 0, this.fogAmt * 0.6);
    base.head = e < 0.1 || r > 0.25 || this.fogAmt > 0.3 ? 1 : 0;
    base.windows = smoothstep(0.1, -0.1, e);
    this.cur = base;
    this.elevation = e;
  }
  tickClock(dt) {
    if (!this.continuous) return;
    this.hour = (this.hour + dt * this.clockSpeed / 3600) % 24;
    // épisodes météo (mode auto)
    if (this.weatherMode === 'auto') {
      this.nextWeatherT -= dt;
      if (this.nextWeatherT <= 0) {
        this.nextWeatherT = 70 + this.rand() * 160;
        if (this.rainTarget > 0) this.rainTarget = this.rand() < 0.55 ? 0 : 0.3 + this.rand() * 0.7;
        else this.rainTarget = this.rand() < 0.3 ? 0.4 + this.rand() * 0.6 : 0;
        const hh = this.hour;
        this.fogTarget = hh > 5 && hh < 9.5 && this.rand() < 0.3 ? 0.6 : 0;
      }
    } else this.rainTarget = this.weatherMode === 'pluie' ? 0.85 : 0;
    this.rainAmt += (this.rainTarget - this.rainAmt) * Math.min(1, dt * 0.05);
    this.fogAmt += (this.fogTarget - this.fogAmt) * Math.min(1, dt * 0.03);
    // la chaussée se mouille vite, sèche lentement
    if (this.rainAmt > 0.15) this.wetAmt = Math.min(1, this.wetAmt + dt * 0.08 * this.rainAmt);
    else this.wetAmt = Math.max(0, this.wetAmt - dt * 0.006);
    this.computePalette(dt);
  }
  get clockText() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  get daylight() { return clamp((this.elevation ?? 1) * 3 + 0.2, 0, 1); }

  setPreset(name, fadeSeconds = 0) {
    this.continuous = false;
    this.target = PRESETS[name] || PRESETS.jour;
    if (fadeSeconds <= 0) { this.cur = { ...this.target }; this.blend = 1; }
    else { this.from = { ...this.cur }; this.blend = 0; this.fade = 1 / fadeSeconds; }
    this.presetName = name;
  }

  update(dt, playerPos, inTunnel) {
    const T = this.T;
    // fondu tunnel : le brouillard vire au sombre, l'éclairage se resserre
    this.tunnelBlend = this.tunnelBlend ?? 0;
    const tb = this.tunnelBlend = this.tunnelBlend + ((inTunnel ? 1 : 0) - this.tunnelBlend) * Math.min(1, dt * 3.5);
    this.tickClock(dt);
    if (!this.continuous && this.blend < 1) {
      this.blend = clamp(this.blend + dt * (this.fade || 0.05), 0, 1);
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      for (const k in this.target) {
        const a = this.from[k], b = this.target[k];
        this.cur[k] = typeof a === 'number' ? lerp(a, b, t) : b;
      }
    }
    const c = this.cur;
    const col = (v) => new T.Color(v);
    // couleurs interpolées : reconstruire depuis from/target pour les hex
    const mix = this.continuous ? (k) => c[k].clone() : (k) => col(this.from[k]).lerp(col(this.target[k]), this.blend);
    const sky = mix('skyTop'), hor = mix('skyHor'), fogC = mix('fog');
    this.skyMat.uniforms.top.value.copy(sky);
    this.skyMat.uniforms.hor.value.copy(hor);
    this.skyMat.uniforms.clouds.value = c.clouds ?? 0.7;
    this.skyMat.uniforms.cloudTint.value.copy(mix('sunCol')).lerp(new T.Color(0xffffff), 0.5);
    this.skyMat.uniforms.sunAmt.value = clamp(c.sunInt, 0, 1.4) * (1 - 0.85 * clamp((c.rain || 0) + (this.fogAmt || 0), 0, 1));
    this.skyMat.uniforms.drift.value += dt * 0.0012;
    this.skyMat.uniforms.sunDir.value.set(c.sunX * 600, 200 + c.sunY * 500, 200).normalize();
    this.skyMat.uniforms.sunCol.value.copy(mix('sunCol'));
    const fog = this.scene.fog;
    fog.color.copy(fogC).lerp(this._tunnelFog || (this._tunnelFog = new T.Color(0x2a1d10)), tb);
    fog.far = lerp(c.fogFar, 300, tb);
    fog.near = lerp(60, 24, tb);
    this.hemi.color.copy(mix('hemiSky')).lerp(this._tunnelHemi || (this._tunnelHemi = new T.Color(0xcfa96a)), tb * 0.8);
    this.hemi.groundColor.copy(mix('hemiGrd'));
    this.hemi.intensity = c.hemiInt * (1 - tb * 0.25) + tb * 0.45; // couvertures éclairées au sodium jour et nuit
    this.sun.color.copy(mix('sunCol'));
    this.sun.intensity = c.sunInt * (1 - tb * 0.75);
    // le soleil (et sa caméra d'ombre) suivent le joueur
    const px2 = playerPos ? playerPos.x : 0, pz2 = playerPos ? playerPos.z : 0;
    const sl = Math.hypot(c.sunX * 600, 200 + c.sunY * 500, 200) || 1;
    const sd = 520 / sl;
    this.sun.position.set(px2 + c.sunX * 600 * sd, (200 + c.sunY * 500) * sd, pz2 + 200 * sd);
    this.sunTarget.position.set(px2, 0, pz2);

    // matériaux du monde
    const H = this.hooks;
    if (H.renderer) H.renderer.toneMappingExposure = c.expo;
    // reflets d'environnement des carrosseries atténués la nuit / sous la pluie
    if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = lerp(0.18, 1, this.continuous ? this.daylight : 1) * (1 - 0.3 * (c.rain || 0));
    if (H.lampMat) {
      H.lampMat.color.setHex(0x40454c).lerp(new T.Color(0xffc46a), c.lamps);
      H.lampMat.color.multiplyScalar(1 + c.lamps * 1.2);
    }
    if (H.buildingMats) for (const bm of H.buildingMats) bm.emissiveIntensity = c.windows;
    if (H.lampGlowMat) H.lampGlowMat.opacity = c.lamps * 0.85;
    if (H.roadMat) {
      H.roadMat.shininess = 6 + c.wet * 120;
      H.roadMat.specular.setScalar(0.06 + c.wet * 0.75);
      H.roadMat.color.setScalar(1 - c.wet * 0.42);
    }
    if (H.tunnelLightMat) H.tunnelLightMat.color.setHex(0xffb860); // sodium (relevé v12)

    // ciel suit la caméra
    if (playerPos) this.sky.position.set(playerPos.x, 0, playerPos.z);

    // pluie
    const rainAmt = c.rain * (inTunnel ? 0 : 1);
    this.rainMat.opacity = Math.min(1, rainAmt) * 0.55;
    if (rainAmt > 0.02 && this.camera) {
      const cp = this.camera.position;
      for (let i = 0; i < this.rainCount; i++) {
        const s = this.rainSeeds[i];
        s.y -= s.v * dt;
        if (s.y < 0) s.y += 16;
        this._m4.makeTranslation(cp.x + s.x, cp.y + s.y - 6, cp.z + s.z);
        this.rain.setMatrixAt(i, this._m4);
      }
      this.rain.instanceMatrix.needsUpdate = true;
      this.rain.visible = true;
    } else this.rain.visible = false;
  }

  get lampsOn() { return this.cur.lamps > 0.4; }
  get headlightsOn() { return this.cur.head > 0.5; }
  get wet() { return this.cur.wet; }
}
