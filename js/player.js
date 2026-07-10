// ============================================================
// Périph' Rush — voiture du joueur : physique, caméra, dégâts
// Conduite arcade nerveuse : consigne latérale lissée, accélération
// selon la fiche du véhicule, caméra 3e personne avec élargissement
// du champ à haute vitesse, secousses et ralenti à l'impact.
// ============================================================

import { CFG, MS, laneCenter, LATERAL_MAX } from './config.js';
import { CATALOG } from './vehicles.js';
import { clamp, lerp, damp } from './utils.js';

export class Player {
  constructor(THREE, scene, track, factory) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.factory = factory;
    this.bundle = null;
    this.carId = null;
    this.input = { steer: 0, throttle: 0, brake: 0 };
    this.autoThrottle = false;
    this._p = {};
    this._camP = {};
    this.headlight = new THREE.SpotLight(0xfff2d0, 0, 46, 0.62, 0.5, 1.2);
    this.headTarget = new THREE.Object3D();
    scene.add(this.headlight, this.headTarget);
    this.headlight.target = this.headTarget;
    this.reset('clio3', 0);
  }

  setCar(id, color) {
    if (this.bundle) {
      this.scene.remove(this.bundle.group);
      this.bundle.mesh.geometry.dispose(); // géométrie clonée joueur
    }
    this.carId = id;
    this.spec = CATALOG[id];
    this.bundle = this.factory.build(id, { color, forPlayer: true });
    this.scene.add(this.bundle.group);
    this.len = this.spec.dims[0];
    this.wid = this.spec.dims[1];
    const perf = this.spec.perf;
    this.vmax = MS(perf.vmax);
    this.accel = 3.0 + perf.acc * 4.6;
    this.brakeF = 8.5 + perf.frein * 4.0;
    this.steerF = 0.75 + perf.man * 0.55;
    this.baseGeom = this.bundle.mesh.geometry;
  }

  reset(carId, startS, color) {
    if (carId) this.setCar(carId, color);
    this.s = startS ?? this.track.startS;
    this.lat = laneCenter(2);
    this.v = MS(48);
    this.latVel = 0;
    this.steerCmd = 0;
    this.yaw = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wheelSpin = 0;
    this.crashed = false;
    this.camShake = 0;
    this.distance = 0;
    this.laps = 0;
    this._lapArmed = false;
    this.overspeedTime = 0;
    this.hardBrakeTime = 0;
    if (this.bundle) {
      this.bundle.brake.visible = false;
      const pos = this.baseGeom.getAttribute('position');
      if (this._origPos) pos.array.set(this._origPos), pos.needsUpdate = true;
      else this._origPos = pos.array.slice();
      this.place();
    }
  }

  update(dt) {
    if (this.crashed) return;
    const inp = this.input;
    const track = this.track;

    // — longitudinal —
    const throttle = this.autoThrottle ? Math.max(inp.throttle, 1 - inp.brake) : inp.throttle;
    let a = 0;
    if (inp.brake > 0) a -= this.brakeF * inp.brake;
    if (throttle > 0) a += this.accel * throttle * (1 - this.v / this.vmax);
    if (throttle <= 0 && inp.brake <= 0) a -= 0.9 + this.v * 0.015; // frein moteur
    this.v = clamp(this.v + a * dt, 0, this.vmax);
    if (inp.brake > 0.6 && this.v > MS(30)) this.hardBrakeTime += dt;
    if (this.v > MS(CFG.SPEED_LIMIT_KMH + 10)) this.overspeedTime += dt;

    const ds = this.v * dt;
    const prevS = this.s;
    this.s = (this.s + ds) % track.length;
    this.distance += ds;
    // tour complet : franchit le point de départ (armé après 1 km)
    const startS = track.startS;
    if (!this._lapArmed && ((this.s - startS + track.length) % track.length) > 1000) this._lapArmed = true;
    const before = (prevS - startS + track.length) % track.length;
    const after = (this.s - startS + track.length) % track.length;
    if (this._lapArmed && after < before && before > track.length - 400) {
      this.laps++;
      this._lapArmed = false;
      this.onLap?.(this.laps);
    }

    // — latéral —
    this.steerCmd = damp(this.steerCmd, inp.steer, CFG.STEER_RESPONSE, dt);
    const speedFactor = clamp(this.v / MS(50), 0.25, 1.6);
    const targetLatVel = this.steerCmd * CFG.STEER_SPEED * this.steerF * speedFactor;
    this.latVel = damp(this.latVel, targetLatVel, 9, dt);
    this.lat += this.latVel * dt;
    // butées : glissière extérieure / séparateur
    this.wallContact = 0;
    if (this.lat > LATERAL_MAX) {
      if (this.latVel > 2.6) this.wallContact = this.latVel;
      this.lat = LATERAL_MAX;
      this.latVel = Math.min(this.latVel, 0) * 0.3;
    } else if (this.lat < CFG.LATERAL_MIN) {
      if (this.latVel < -2.6) this.wallContact = this.latVel;
      this.lat = CFG.LATERAL_MIN;
      this.latVel = Math.max(this.latVel, 0) * 0.3;
    }

    // — attitude visuelle —
    this.yaw = damp(this.yaw, Math.atan2(this.latVel, Math.max(this.v, 4)) * 1.15, 10, dt);
    this.roll = damp(this.roll, -this.latVel * 0.028, 8, dt);
    this.pitch = damp(this.pitch, clamp(-a * 0.011, -0.05, 0.075), 6, dt);
    this.wheelSpin += (this.v / (this.spec.wr || 0.3)) * dt;

    this.place();
    this.bundle.brake.visible = inp.brake > 0.05;
  }

  place() {
    const p = this._p;
    this.track.pointAt(this.s, p);
    const g = this.bundle.group;
    g.position.set(p.x + p.rx * this.lat, p.y, p.z + p.rz * this.lat);
    g.rotation.set(0, Math.atan2(p.tx, p.tz) + this.yaw, 0);
    g.rotateX(this.pitch);
    g.rotateZ(this.roll + (this.bundle.ud.moto ? -this.steerCmd * 0.32 : 0));
    if (this.bundle.wheels) {
      for (let i = 0; i < this.bundle.wheels.length; i++) {
        const w = this.bundle.wheels[i];
        w.rotation.x = this.wheelSpin;
        if (i < 2 || this.bundle.wheels.length <= 2) w.rotation.y = this.steerCmd * 0.28;
      }
    }
    // phares
    this.headlight.position.copy(g.position).add(new this.T.Vector3(0, 0.9, 0));
    this.headTarget.position.set(
      g.position.x + p.tx * 30 + p.rx * this.steerCmd * 6,
      g.position.y - 0.4,
      g.position.z + p.tz * 30 + p.rz * this.steerCmd * 6,
    );
  }

  setHeadlights(on) {
    this.headlight.intensity = on ? 95 : 0;
    this.bundle.glows.visible = on;
  }

  // caméra 3e personne
  updateCamera(camera, dt, firstFrame = false) {
    const p = this._camP;
    const back = 5.4 + this.v * 0.05 + this.len * 0.35;
    const camS = this.s - back;
    this.track.pointAt(camS, p);
    const lookP = this._p;
    const targetX = p.x + p.rx * (this.lat * 0.92);
    const targetY = p.y + 2.35 + this.v * 0.008;
    const targetZ = p.z + p.rz * (this.lat * 0.92);
    const lam = firstFrame ? 1000 : 7.5;
    camera.position.set(
      damp(camera.position.x, targetX, lam, dt),
      damp(camera.position.y, targetY, lam, dt),
      damp(camera.position.z, targetZ, lam, dt),
    );
    if (this.camShake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.camShake;
      camera.position.y += (Math.random() - 0.5) * this.camShake * 0.6;
      this.camShake *= Math.exp(-dt * 5);
    }
    this.track.pointAt(this.s + 14 + this.v * 0.25, lookP);
    camera.lookAt(lookP.x + lookP.rx * this.lat * 0.75, lookP.y + 1.15, lookP.z + lookP.rz * this.lat * 0.75);
    const fovT = CFG.FOV_BASE + CFG.FOV_SPEED_GAIN * clamp((this.v - MS(45)) / MS(100), 0, 1);
    camera.fov = damp(camera.fov, fovT, 4, dt);
    camera.updateProjectionMatrix();
  }

  // déformation de carrosserie au point d'impact (severity 0..1)
  deform(impactLocal, severity) {
    const geom = this.bundle.mesh.geometry;
    const pos = geom.getAttribute('position');
    const arr = pos.array;
    const r = 0.7 + severity * 0.9;
    const amp = 0.06 + severity * 0.26;
    for (let i = 0; i < pos.count; i++) {
      const dx = arr[i * 3] - impactLocal.x;
      const dy = arr[i * 3 + 1] - impactLocal.y;
      const dz = arr[i * 3 + 2] - impactLocal.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r * r) {
        const f = (1 - Math.sqrt(d2) / r) * amp;
        arr[i * 3] += impactLocal.nx * f;
        arr[i * 3 + 1] += Math.abs(impactLocal.ny) * f * 0.4;
        arr[i * 3 + 2] += impactLocal.nz * f;
      }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  }

  crash() {
    this.crashed = true;
    this.bundle.brake.visible = true;
  }

  get kmh() { return this.v * 3.6; }
}
