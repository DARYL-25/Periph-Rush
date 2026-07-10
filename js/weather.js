// ============================================================
// Périph' Rush — ambiances (heure + météo) et éclairage global
// Un seul rig de lumières (hemi + directionnelle) ; les presets
// sont interpolés en continu → chaque tour fait avancer l'heure.
// ============================================================

import { lerp, clamp } from './utils.js';

const PRESETS = {
  jour: {
    skyTop: 0x4e93d6, skyHor: 0xd8e6f2, fog: 0xc9d8e6, fogFar: 1050,
    hemiSky: 0xcaddee, hemiGrd: 0x8a8f84, hemiInt: 1.2,
    sunCol: 0xfff3d8, sunInt: 1.9, sunY: 0.8, sunX: 0.45,
    lamps: 0, windows: 0, wet: 0, rain: 0, head: 0, expo: 1.12,
  },
  coucher: {
    skyTop: 0x4b5d8c, skyHor: 0xf2a35c, fog: 0xdba97e, fogFar: 900,
    hemiSky: 0xd8a880, hemiGrd: 0x584a42, hemiInt: 0.7,
    sunCol: 0xffa860, sunInt: 1.1, sunY: 0.16, sunX: -0.7,
    lamps: 0.75, windows: 0.45, wet: 0, rain: 0, head: 1, expo: 1.05,
  },
  nuit: {
    skyTop: 0x0a1422, skyHor: 0x27354d, fog: 0x141d2c, fogFar: 780,
    hemiSky: 0x2a3a54, hemiGrd: 0x0d1014, hemiInt: 0.55,
    sunCol: 0x9fb6d8, sunInt: 0.28, sunY: 0.6, sunX: -0.3,
    lamps: 1, windows: 1, wet: 0, rain: 0, head: 1, expo: 1.15,
  },
  nuitPluie: {
    skyTop: 0x0a1018, skyHor: 0x1e2836, fog: 0x10171f, fogFar: 560,
    hemiSky: 0x27364a, hemiGrd: 0x0d1014, hemiInt: 0.5,
    sunCol: 0x8ea6c8, sunInt: 0.22, sunY: 0.6, sunX: -0.3,
    lamps: 1, windows: 0.9, wet: 1, rain: 1, head: 1, expo: 1.15,
  },
  brouillard: {
    skyTop: 0xb7c2cb, skyHor: 0xc9d2d8, fog: 0xc3ccd3, fogFar: 300,
    hemiSky: 0xc3ccd3, hemiGrd: 0x84888a, hemiInt: 0.8,
    sunCol: 0xe8e0d0, sunInt: 0.45, sunY: 0.5, sunX: 0.2,
    lamps: 0.8, windows: 0.3, wet: 0.4, rain: 0, head: 1, expo: 1.0,
  },
  pluie: {
    skyTop: 0x6f7d8a, skyHor: 0xa8b2ba, fog: 0x9aa5ae, fogFar: 640,
    hemiSky: 0xa8b2ba, hemiGrd: 0x5e625e, hemiInt: 0.8,
    sunCol: 0xdde4ea, sunInt: 0.55, sunY: 0.7, sunX: 0.3,
    lamps: 0.35, windows: 0.25, wet: 1, rain: 1, head: 1, expo: 1.0,
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
    scene.add(this.sun);
    scene.fog = new THREE.Fog(0xc4d4e2, 60, 1050);

    // dôme de ciel en dégradé (shader minimal, insensible au fog)
    const skyGeo = new THREE.SphereGeometry(3800, 20, 12);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x5f9bd8) }, hor: { value: new THREE.Color(0xcfe0ee) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 hor;
        void main(){ float h = clamp(normalize(vP).y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h,0.75)), 1.0); }`,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // pluie : gouttes instanciées autour de la caméra
    const drop = new THREE.PlaneGeometry(0.025, 0.55);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0x9db4c8, transparent: true, opacity: 0.0, depthWrite: false,
    });
    this.rainCount = 260;
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

  setPreset(name, fadeSeconds = 0) {
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
    if (this.blend < 1) {
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
    const mix = (k) => col(this.from[k]).lerp(col(this.target[k]), this.blend);
    const sky = mix('skyTop'), hor = mix('skyHor'), fogC = mix('fog');
    this.skyMat.uniforms.top.value.copy(sky);
    this.skyMat.uniforms.hor.value.copy(hor);
    const fog = this.scene.fog;
    fog.color.copy(fogC).lerp(this._tunnelFog || (this._tunnelFog = new T.Color(0x191410)), tb);
    fog.far = lerp(c.fogFar, 300, tb);
    fog.near = lerp(60, 24, tb);
    this.hemi.color.copy(mix('hemiSky')).lerp(this._tunnelHemi || (this._tunnelHemi = new T.Color(0xcfa96a)), tb * 0.8);
    this.hemi.groundColor.copy(mix('hemiGrd'));
    this.hemi.intensity = c.hemiInt * (1 - tb * 0.25);
    this.sun.color.copy(mix('sunCol'));
    this.sun.intensity = c.sunInt * (1 - tb * 0.75);
    this.sun.position.set(c.sunX * 600, 200 + c.sunY * 500, 200);

    // matériaux du monde
    const H = this.hooks;
    if (H.renderer) H.renderer.toneMappingExposure = c.expo;
    if (H.lampMat) {
      H.lampMat.color.setHex(0x40454c).lerp(new T.Color(0xffc46a), c.lamps);
      H.lampMat.color.multiplyScalar(1 + c.lamps * 1.2);
    }
    if (H.buildingMat) H.buildingMat.emissiveIntensity = c.windows;
    if (H.roadMat) {
      H.roadMat.shininess = 6 + c.wet * 80;
      H.roadMat.specular.setScalar(0.06 + c.wet * 0.45);
      H.roadMat.color.setScalar(1 - c.wet * 0.35);
    }
    if (H.tunnelLightMat) H.tunnelLightMat.color.setHex(0xfff1c8);

    // ciel suit la caméra
    if (playerPos) this.sky.position.set(playerPos.x, 0, playerPos.z);

    // pluie
    const rainAmt = c.rain * (inTunnel ? 0 : 1);
    this.rainMat.opacity = rainAmt * 0.5;
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
