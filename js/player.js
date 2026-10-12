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
    this.reset('lutece', 0);
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
    this.startS = this.s; // ligne de « tour bouclé » = porte de départ choisie
    this.lat = laneCenter(2);
    this.v = MS(48);
    this.latVel = 0;
    this.steerCmd = 0;
    this.yaw = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wheelSpin = 0;
    this.crashed = false;
    this.ramp = null; this.rampO = null; this.leftPeriph = false; this.exitT = 0;
    this.health = 100; this.grip = 1; this.latAcc = 0;
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
    // adhérence : chaussée mouillée = freinage et motricité réduits
    const grip = 1 - 0.3 * (this.wet || 0);
    this.grip = grip;
    if (inp.brake > 0) a -= this.brakeF * inp.brake * (0.55 + 0.45 * grip);
    if (throttle > 0) a += this.accel * throttle * (1 - this.v / this.vmax) * (0.8 + 0.2 * grip);
    // voiture abîmée : moins de punch
    if (this.health < 60) a *= throttle > 0 && a > 0 ? 0.6 + this.health / 150 : 1;
    if (throttle <= 0 && inp.brake <= 0) a -= 0.9 + this.v * 0.015; // frein moteur
    this.v = clamp(this.v + a * dt, 0, this.vmax);
    if (inp.brake > 0.6 && this.v > MS(30)) this.hardBrakeTime += dt;
    if (this.v > MS(CFG.SPEED_LIMIT_KMH + 10)) this.overspeedTime += dt;

    const ds = this.v * dt;
    const prevS = this.s;
    this.s = (this.s + ds) % track.length;
    this.distance += ds;
    // tour complet : franchit le point de départ (armé après 1 km)
    const startS = this.startS ?? track.startS;
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
    // sous-virage à haute vitesse : la direction perd de son efficacité
    const under = 1 / (1 + Math.max(0, this.v - MS(70)) / MS(55));
    const targetLatVel = this.steerCmd * CFG.STEER_SPEED * this.steerF * speedFactor * under;
    // inertie latérale bornée par l'adhérence (glisse sur le mouillé)
    const latAccMax = (14 + this.steerF * 6) * this.grip;
    const want = damp(this.latVel, targetLatVel, 9 * (0.6 + 0.4 * this.grip), dt) - this.latVel;
    const prevLatVel = this.latVel;
    this.latVel += clamp(want, -latAccMax * dt, latAccMax * dt);
    this.latAcc = (this.latVel - prevLatVel) / Math.max(dt, 1e-3);
    this.lat += this.latVel * dt;
    // butées : glissière extérieure / séparateur — et bretelles praticables
    this.wallContact = 0;
    this.updateRamp();
    const lim = this.latLimits();
    if (this.lat > lim.max) {
      if (this.latVel > 2.6 || this.lat - lim.max > 0.3) this.wallContact = Math.max(this.latVel, 3);
      this.lat = lim.max;
      this.latVel = Math.min(this.latVel, 0) * 0.3;
    } else if (this.lat < lim.min) {
      // à cheval sur le musoir quand la séparation commence → choc sur l'atténuateur
      if (this.latVel < -2.6 || lim.min - this.lat > 0.3) this.wallContact = Math.min(this.latVel, -3);
      this.lat = lim.min;
      this.latVel = Math.max(this.latVel, 0) * 0.3;
    }

    // — attitude visuelle — (lat croît vers la droite = -X local → lacet négatif)
    this.yaw = damp(this.yaw, -Math.atan2(this.latVel, Math.max(this.v, 4)) * 1.15, 10, dt);
    // transferts de masse : roulis selon l'accélération latérale, plongée au freinage
    this.roll = damp(this.roll, clamp(-this.latVel * 0.02 - (this.latAcc || 0) * 0.006, -0.09, 0.09), 7, dt);
    this.pitch = damp(this.pitch, clamp(-a * 0.0085, -0.045, 0.085), 5, dt);
    this.wheelSpin += (this.v / (this.spec.wr || 0.3)) * dt;

    this.place();
    this.bundle.brake.visible = inp.brake > 0.05;
  }

  // ---------- bretelles ------------------------------------------------------
  // Le joueur peut quitter la chaussée principale par une sortie (ou
  // rejoindre une voie d'accélération) : plus de mur invisible au droit
  // des bretelles. Au-delà du musoir, la sortie est sans retour.
  rampsHere() {
    const t = this.track;
    if (!t.ramps) return [];
    t.pointAt(this.s, this._p);
    return t.ramps.at(this.s, this._p.y);
  }
  updateRamp() {
    const t = this.track;
    const Em = t.mainEdgeAt(this.s);
    const list = this.rampsHere();
    this.exitT = 0;
    if (this.ramp) {
      const o = list.find((q) => q.r === this.ramp);
      if (!o) { // fin de la bretelle : sorti (sortie) ou fondu dans le flux (entrée)
        if (this.ramp.kind === 'X') { this.leftPeriph = true; this.lastRamp = this.ramp; }
        this.ramp = null; this.rampO = null;
        return;
      }
      this.rampO = o;
      if (o.g < 0.35 || (o.g < 1.3 && this.lat < Em + o.mid)) { // revenu sur le périph avant le musoir
        this.ramp = null; this.rampO = null;
      }
      if (this.ramp && this.ramp.kind === 'X') {
        this.exitT = o.t;
        if (o.t > 0.42) { this.leftPeriph = true; this.lastRamp = this.ramp; } // engagé bien au-delà du musoir
      }
      return;
    }
    // sur le périph : bascule vers une bretelle qui s'écarte encore peu
    for (const o of list) {
      if (o.parallel) continue;
      if (o.g < 1.3 && this.lat > Em + o.mid + 0.2) { this.ramp = o.r; this.rampO = o; return; }
    }
  }
  latLimits() {
    const t = this.track, Em = t.mainEdgeAt(this.s);
    const half = (this.wid || 1.8) / 2 - 0.18;
    if (this.ramp && this.rampO) {
      const o = this.rampO;
      const max = Em + o.gap + o.w - half;
      // tant que le musoir (séparation) n'a pas commencé, on peut revenir sur le périph
      const min = o.g < 1.3 ? CFG.LATERAL_MIN : t.ramps.rampMin(o, this.s, this.track.elevationAt(this.s), half);
      return { min, max };
    }
    // v17 : butée partagée avec le décor (séparation réelle : DBA en pied de talus ou mur à mi-interstice)
    const max = t.ramps ? t.ramps.mainMax(this.s, half) : Em - 0.72;
    return { min: CFG.LATERAL_MIN, max };
  }
  // hauteur de chaussée sous le joueur (bretelle en rampe)
  groundY(p) {
    if (this.ramp && this.rampO) return this.rampO.hr;
    return p.y;
  }

  place() {
    const p = this._p;
    this.track.pointAt(this.s, p);
    const g = this.bundle.group;
    const y = this.groundY(p);
    this.y = y;
    g.position.set(p.x + p.rx * this.lat, y, p.z + p.rz * this.lat);
    g.rotation.set(0, Math.atan2(p.tx, p.tz) + this.yaw, 0);
    g.rotateX(this.pitch);
    g.rotateZ(this.roll + (this.bundle.ud.moto ? -this.steerCmd * 0.32 : 0));
    if (this.bundle.wheels) {
      for (let i = 0; i < this.bundle.wheels.length; i++) {
        const w = this.bundle.wheels[i];
        // braquage des roues AVANT (ordre YXZ : pivot vertical avant la rotation
        // de roulement), signe négatif car la droite du véhicule = -X local
        if (i < 2 || this.bundle.wheels.length <= 2) {
          w.rotation.order = 'YXZ';
          w.rotation.y = -this.steerCmd * 0.42;
        }
        w.rotation.x = this.wheelSpin;
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
    const targetY = (this.y ?? p.y) + 2.35 + this.v * 0.008;
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
    camera.lookAt(lookP.x + lookP.rx * this.lat * 0.75, (this.y ?? lookP.y) + (lookP.y - p.y) * 0.3 + 1.15, lookP.z + lookP.rz * this.lat * 0.75);
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
