// ============================================================
// Périph' Rush — vue cockpit (v16)
// Caméra à la place du conducteur (à gauche), planche de bord,
// volant qui tourne, compteur, montants de pare-brise, essuie-glaces
// et gouttes sous la pluie, rétroviseurs fonctionnels (rendu arrière
// dans une texture partagée par le rétro intérieur et les rétros
// extérieurs).
// ============================================================

import { clamp, damp } from './utils.js';

export class Cockpit {
  constructor(THREE, scene, camera, player, track) {
    Object.assign(this, { T: THREE, scene, camera, player, track });
    this.active = false;
    const T = THREE;
    this.group = new T.Group();
    this.group.visible = false;
    camera.add(this.group);
    if (!camera.parent) scene.add(camera);
    const M = (c, o = {}) => new T.MeshBasicMaterial({ color: c, fog: false, ...o });
    const S = (c, r = 0.85) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.05, fog: false, envMapIntensity: 0.3 });
    const dark = S(0x0e0f11), dark2 = S(0x16181b), trim = S(0x2a2d32, 0.5);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.renderOrder = 10;
      this.group.add(m);
      return m;
    };
    // planche de bord (masque bas de l'écran)
    add(new T.BoxGeometry(2.6, 0.5, 0.9), dark, 0, -0.62, -0.95, -0.12);
    add(new T.BoxGeometry(2.6, 0.04, 0.5), trim, 0, -0.37, -1.1, -0.12);
    // capot bombé (peinture de la voiture) visible au-delà de la planche
    const hg = new T.BoxGeometry(2.0, 0.1, 1.5, 8, 1, 4);
    {
      const pos = hg.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
        const k = 1 - (z + 0.75) / 1.5;               // 0 près du pare-brise → 1 à l'avant
        pos.setX(i, x * (1 - 0.18 * k));               // le capot se resserre vers l'avant
        pos.setY(i, y + 0.12 * (1 - Math.pow(x / 1.0, 2)) - 0.18 * k * k);
      }
      hg.computeVertexNormals();
    }
    this.hoodMat = new T.MeshPhysicalMaterial({ color: 0x8a1a16, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, fog: false });
    this.hood = add(hg, this.hoodMat, 0, -0.62, -1.9, 0.1);
    // montants de pare-brise + pavillon
    add(new T.BoxGeometry(0.16, 1.4, 0.12), dark2, -0.86, 0.12, -0.9, 0, 0, 0.42);
    add(new T.BoxGeometry(0.16, 1.4, 0.12), dark2, 1.18, 0.12, -1.0, 0, 0, -0.38);
    add(new T.BoxGeometry(3, 0.28, 0.9), dark2, 0, 0.62, -0.7, 0.2);
    // volant
    this.wheel = new T.Group();
    this.wheel.position.set(0, -0.33, -0.52);
    this.wheel.rotation.x = -0.42;
    this.group.add(this.wheel);
    const rim = new T.Mesh(new T.TorusGeometry(0.17, 0.021, 10, 40), S(0x101113, 0.6));
    const hub = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.04, 18).rotateX(Math.PI / 2), S(0x1d1f23, 0.5));
    const spoke = new T.Mesh(new T.BoxGeometry(0.32, 0.03, 0.02), S(0x1d1f23, 0.5));
    const spoke2 = new T.Mesh(new T.BoxGeometry(0.03, 0.16, 0.02), S(0x1d1f23, 0.5));
    spoke2.position.y = -0.08;
    for (const m of [rim, hub, spoke, spoke2]) { m.renderOrder = 11; this.wheel.add(m); }
    // combiné d'instruments (texture dynamique)
    this.gcv = document.createElement('canvas');
    this.gcv.width = 256; this.gcv.height = 96;
    this.gtex = new T.CanvasTexture(this.gcv);
    this.gtex.colorSpace = T.SRGBColorSpace;
    add(new T.PlaneGeometry(0.34, 0.13), M(0xffffff, { map: this.gtex }), 0, -0.24, -0.66, -0.2);
    // rétroviseurs : rendu arrière partagé
    this.rt = new T.WebGLRenderTarget(384, 128, { samples: 0 });
    this.rt.texture.colorSpace = T.SRGBColorSpace;
    this.rearCam = new T.PerspectiveCamera(42, 3, 0.5, 600);
    const mirrorMat = (u0, u1) => {
      const g = new T.PlaneGeometry(1, 1);
      const uv = g.getAttribute('uv');
      // image miroir : inversion horizontale + recadrage
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) > 0.5 ? u0 : u1);
      return g;
    };
    const mm = M(0xffffff, { map: this.rt.texture });
    const frame = M(0x101113);
    // intérieur (au centre, côté passager)
    add(new T.PlaneGeometry(0.31, 0.105), frame, 0.24, 0.3, -0.58);
    const mi = add(mirrorMat(0.18, 0.82), mm, 0.24, 0.3, -0.575);
    mi.scale.set(0.28, 0.085, 1);
    // extérieur gauche (conducteur) et droit
    add(new T.PlaneGeometry(0.2, 0.13), frame, -0.82, -0.12, -0.78, 0, 0.35);
    const ml = add(mirrorMat(0.0, 0.42), mm, -0.818, -0.12, -0.775, 0, 0.35);
    ml.scale.set(0.17, 0.105, 1);
    add(new T.PlaneGeometry(0.2, 0.13), frame, 1.38, -0.16, -1.12, 0, -0.3);
    const mr = add(mirrorMat(0.58, 1.0), mm, 1.378, -0.16, -1.115, 0, -0.3);
    mr.scale.set(0.17, 0.105, 1);
    // essuie-glaces
    this.wipers = [];
    for (const x of [-0.55, 0.25]) {
      const piv = new T.Group();
      piv.position.set(x, -0.33, -1.15);
      const arm = new T.Mesh(new T.BoxGeometry(0.85, 0.018, 0.012), M(0x0d0e10));
      arm.position.x = 0.42;
      arm.renderOrder = 12;
      piv.add(arm);
      piv.rotation.z = 0.05;
      this.group.add(piv);
      this.wipers.push(piv);
    }
    this.wipeT = 0;
    // gouttes sur le pare-brise
    const dcv = document.createElement('canvas');
    dcv.width = dcv.height = 512;
    const dc = dcv.getContext('2d');
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 1.5 + Math.random() * 5;
      const g = dc.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(200,215,230,0.25)'); g.addColorStop(1, 'rgba(120,140,160,0)');
      dc.fillStyle = g; dc.beginPath(); dc.arc(x, y, r, 0, Math.PI * 2); dc.fill();
    }
    const dtex = new T.CanvasTexture(dcv);
    this.dropMat = M(0xffffff, { map: dtex, transparent: true, opacity: 0, depthWrite: false });
    this.drops = add(new T.PlaneGeometry(2.2, 1.0), this.dropMat, 0.15, 0.05, -1.05, -0.35);
    this.drops.renderOrder = 9;
    this.frame = 0;
    this._p = {}; this._q = {};
  }

  setActive(on, paintHex) {
    this.active = on;
    this.group.visible = on;
    this.player.bundle.group.visible = !on;
    if (paintHex != null) this.hoodMat.color.setHex(paintHex);
    this.camera.near = on ? 0.08 : 0.3;
    this.camera.updateProjectionMatrix();
  }

  // caméra à la place du conducteur
  updateCamera(camera, dt) {
    const pl = this.player, p = this._p;
    this.track.pointAt(pl.s - 0.2, p);
    const lat = pl.lat - 0.36;                 // conducteur à gauche
    const y = (pl.y ?? p.y) + 1.13 - pl.pitch * 0.6;
    camera.position.set(p.x + p.rx * lat, y, p.z + p.rz * lat);
    const q = this._q;
    this.track.pointAt(pl.s + 30, q);
    const yaw = Math.atan2(p.tx, p.tz) + pl.yaw * 0.8;
    const look = { x: camera.position.x + Math.sin(yaw) * 30, z: camera.position.z + Math.cos(yaw) * 30 };
    camera.lookAt(look.x, (q.y - p.y) + y - 0.35, look.z);
    camera.rotateZ(-pl.roll * 0.6);
    if (pl.camShake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * pl.camShake * 0.5;
      camera.position.y += (Math.random() - 0.5) * pl.camShake * 0.3;
    }
    camera.fov = damp(camera.fov, 72, 4, dt);
    camera.updateProjectionMatrix();
    // volant, instruments, essuie-glaces, gouttes
    this.wheel.rotation.z = -pl.steerCmd * 1.7;
    this.drawGauges(pl);
    const rain = this.rain || 0;
    this.dropMat.opacity = clamp(rain * 0.9, 0, 0.75) * (0.6 + 0.4 * Math.abs(Math.sin(this.wipeT * 0.5)));
    if (rain > 0.08) {
      this.wipeT += dt * (rain > 0.5 ? 3.6 : 2.2);
      const a = 0.05 + 1.25 * (0.5 - 0.5 * Math.cos(this.wipeT));
      this.wipers[0].rotation.z = a; this.wipers[1].rotation.z = a;
    }
  }

  drawGauges(pl) {
    if ((this.frame++ & 3) !== 0) return;
    const c = this.gcv.getContext('2d');
    c.fillStyle = '#07080a'; c.fillRect(0, 0, 256, 96);
    const kmh = Math.round(pl.kmh);
    // compte-tours simulé (rapport selon la vitesse)
    const gears = [0, 20, 38, 58, 82, 112, 999];
    let g = 1; while (pl.kmh > gears[g] && g < 6) g++;
    const rpm = 900 + clamp((pl.kmh - gears[g - 1]) / (gears[g] - gears[g - 1] || 1), 0, 1) * 4800 * (g === 1 ? 1 : 0.75) + (g > 1 ? 1500 : 0);
    const dial = (cx, val, max, col) => {
      c.strokeStyle = '#2a2e35'; c.lineWidth = 6;
      c.beginPath(); c.arc(cx, 52, 36, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
      c.strokeStyle = col;
      c.beginPath(); c.arc(cx, 52, 36, Math.PI * 0.8, Math.PI * 0.8 + Math.PI * 1.4 * clamp(val / max, 0, 1)); c.stroke();
    };
    dial(48, rpm, 7000, rpm > 5800 ? '#ff4b3e' : '#ffd12b');
    dial(208, kmh, 200, kmh > 55 ? '#ff4b3e' : '#7fd0ff');
    c.fillStyle = '#e8eef5'; c.textAlign = 'center';
    c.font = 'bold 26px sans-serif'; c.fillText(String(kmh), 208, 60);
    c.font = 'bold 11px sans-serif'; c.fillText('km/h', 208, 78);
    c.font = 'bold 22px sans-serif'; c.fillText(String(g), 48, 60);
    c.font = 'bold 10px sans-serif'; c.fillText('x1000', 48, 78);
    c.fillStyle = pl.health < 60 ? '#ffb020' : '#3ddc84';
    c.fillRect(104, 70, 48 * Math.max(0, pl.health) / 100, 5);
    this.gtex.needsUpdate = true;
  }

  // rendu des rétroviseurs (une image sur deux)
  beforeRender(dt, camera, renderer) {
    if (!this.active) return;
    if ((this.frame & 1) === 0) {
      const pl = this.player, p = this._p;
      this.track.pointAt(pl.s, p);
      const y = (pl.y ?? p.y) + 1.25;
      this.rearCam.position.set(p.x + p.rx * pl.lat, y, p.z + p.rz * pl.lat);
      this.rearCam.lookAt(p.x + p.rx * pl.lat - p.tx * 40, y - 0.8, p.z + p.rz * pl.lat - p.tz * 40);
      this.group.visible = false;
      const old = renderer.getRenderTarget();
      const sh = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.rt);
      renderer.render(this.scene, this.rearCam);
      renderer.setRenderTarget(old);
      renderer.shadowMap.autoUpdate = sh;
      this.group.visible = true;
    }
  }
}
