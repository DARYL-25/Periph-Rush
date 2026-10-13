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
    this._origPos = null; // géométrie différente : on oubliera l'ancienne copie de déformation
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
    // paramètres physiques (masse, empattement, raideurs de dérive…) selon le véhicule
    const sp = this.spec, moto = sp.kind === 'moto';
    this.isMoto = moto;
    const wb = sp.wb || sp.dims[0] * 0.6;
    const m = moto ? 280 : sp.kind === 'suv' ? 1550 : sp.kind === 'van' ? 1750 : 1250 + (sp.dims[0] - 4) * 250;
    const a = wb * (moto ? 0.5 : 0.42), b = wb - a;
    this.phys = {
      m, wb, a, b, hcg: moto ? 0.6 : 0.55, Iz: m * (a * a + b * b) * 0.55,
      Cf: (moto ? 9000 : 72000) * (0.85 + perf.man * 0.3), Cr: (moto ? 11000 : 82000) * (0.85 + perf.man * 0.3),
      mu: 1.0 + perf.frein * 0.12,
      steerMax: moto ? 0.62 : 0.6, steerFade: moto ? 9 : 8.5, steerRate: moto ? 2.4 : 1.6,
      hGain: 4.2, yawAcc: moto ? 4.5 : 3.6, vLat: (moto ? 6.2 : 5.2) + perf.man * 1.4, rollK: sp.kind === 'suv' || sp.kind === 'van' ? 0.016 : 0.011, pitchK: 0.007,
    };
  }

  reset(carId, startS, color) {
    if (carId) this.setCar(carId, color);
    this.s = startS ?? this.track.startS;
    this.startS = this.s; // ligne de « tour bouclé » = porte de départ choisie
    this.lat = laneCenter(2);
    this.v = MS(48);
    this.latVel = 0;
    this.steerCmd = 0;
    this.h = 0; this.r = 0; this.vy = 0; this.delta = 0; this.ay = 0; this.ax = 0; this.slip = 0; this.abs = false;
    this.rollV = 0; this.pitchV = 0; this._prevS = null; this.steerIn = 0; this.vl = 0;
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

    // ===== dynamique « bicyclette » à pneus (v18) =========================
    // états : v (vitesse longitudinale), vy (glissement latéral de caisse),
    // r (vitesse de lacet), h (cap / route, + à droite), delta (braquage roues)
    const P = this.phys;
    const g = 9.81;
    const mu = (P.mu) * (1 - 0.3 * (this.wet || 0));
    this.grip = mu / P.mu;
    const throttle = this.autoThrottle ? Math.max(inp.throttle, 1 - inp.brake) : inp.throttle;
    // — longitudinal : moteur (courbe), frein (ABS borné par l'adhérence), traînées —
    const vmax = this.vmax;
    let ax = 0;
    if (throttle > 0) ax += this.accel * throttle * Math.max(0, 1 - Math.pow(this.v / vmax, 2.2)) * (this.health < 60 ? 0.6 + this.health / 150 : 1);
    const brakeDemand = inp.brake > 0 ? this.brakeF * inp.brake : 0;
    this.abs = false;
    if (brakeDemand > 0) {
      const maxB = mu * g * 0.98;            // ABS : on ne dépasse pas l'adhérence disponible
      if (brakeDemand > maxB) this.abs = true;
      ax -= Math.min(brakeDemand, maxB);
    }
    if (throttle <= 0 && inp.brake <= 0) ax -= 0.55 + this.v * 0.012;  // frein moteur
    ax -= 0.0004 * this.v * this.v + 0.12;    // aéro + roulement
    // cercle d'adhérence : forte charge latérale → moins de motricité/freinage
    const ayNow = Math.abs(this.ay || 0);
    const room = Math.sqrt(Math.max(0.05, 1 - Math.pow(ayNow / (mu * g), 2)));
    ax = clamp(ax, -mu * g * room, mu * g * room);
    this.v = clamp(this.v + ax * dt, 0, vmax);
    this.ax = ax;
    if (inp.brake > 0.6 && this.v > MS(30)) this.hardBrakeTime += dt;
    if (this.v > MS(CFG.SPEED_LIMIT_KMH + 10)) this.overspeedTime += dt;

    // — direction v20 : retour à la conduite d'origine ———————————————————
    // La consigne pilote directement la vitesse latérale : on appuie, la
    // voiture se décale ; on lâche, elle s'arrête EXACTEMENT où elle est
    // (aucun aimant de voie, aucun recentrage). Inertie latérale bornée par
    // l'adhérence (glisse sur le mouillé). Les effets visuels (cap, roues
    // braquées, roulis, inclinaison moto) découlent de ce mouvement.
    const v = this.v;
    const steerAxis = clamp(inp.steer, -1, 1);
    this.steerIn = damp(this.steerIn || 0, steerAxis, CFG.STEER_RESPONSE, dt);
    // v21 : maniabilité quasi constante — pleine dès ~35 km/h, à peine réduite à très
    // haute vitesse (−10 % vers 150 km/h) ; à très basse vitesse on ne glisse pas de côté
    const speedFactor = clamp(0.3 + v / MS(35) * 0.7, 0.3, 1.0) * 1.1;
    const under = 1 - 0.1 * clamp((v - MS(70)) / MS(80), 0, 1);
    const targetLatVel = this.steerIn * CFG.STEER_SPEED * this.steerF * speedFactor * under * (this.sens ?? 1);
    const latAccMax = (14 + this.steerF * 6) * this.grip;
    const prevLatVel = this.vl || 0;
    const want = damp(prevLatVel, targetLatVel, 9 * (0.6 + 0.4 * this.grip), dt) - prevLatVel;
    this.vl = prevLatVel + clamp(want, -latAccMax * dt, latAccMax * dt);
    const latAccNow = (this.vl - prevLatVel) / Math.max(dt, 1e-3);
    this.slip = clamp((Math.abs(targetLatVel - this.vl) * 9 - latAccMax) / (latAccMax + 1) * 0.2, 0, 0.3) * (v > 6 ? 1 : 0);
    // cap visuel (repère route) : direction du déplacement
    const hNew = Math.atan2(this.vl, Math.max(v, 4)) * 1.15;
    const hPrev = this.h;
    this.h = damp(this.h, hNew, 10, dt);
    this.r = (this.h - hPrev) / Math.max(dt, 1e-4);
    this.vy = 0;
    this.delta = clamp(this.steerIn * P.steerMax * (0.35 + 0.65 / (1 + Math.pow(v / 18, 2))), -P.steerMax, P.steerMax);
    this.steerCmd = this.steerIn;

    const prevLat = this.lat;
    const ds = v * dt;
    this.lat += this.vl * dt;
    this.s = (this.s + ds) % track.length;
    this.distance += ds;
    const ayRaw = latAccNow * 0.5 + v * this.r;
    this.ay = (this.ay || 0) + (ayRaw - (this.ay || 0)) * Math.min(1, dt * 8);
    this.latVel = (this.lat - prevLat) / Math.max(dt, 1e-4);
    this.latAcc = this.ay || 0;

    // tour complet : franchit le point de départ (armé après 1 km)
    const startS = this.startS ?? track.startS;
    const prevS = this._prevS ?? this.s;
    this._prevS = this.s;
    if (!this._lapArmed && ((this.s - startS + track.length) % track.length) > 1000) this._lapArmed = true;
    const before = (prevS - startS + track.length) % track.length;
    const after = (this.s - startS + track.length) % track.length;
    if (this._lapArmed && after < before && before > track.length - 400) {
      this.laps++;
      this._lapArmed = false;
      this.onLap?.(this.laps);
    }

    // butées : glissière extérieure / séparateur — et bretelles praticables
    this.wallContact = 0;
    this.updateRamp();
    const lim = this.latLimits();
    if (this.lat > lim.max) {
      if (this.latVel > 2.6 || this.lat - lim.max > 0.3) this.wallContact = Math.max(this.latVel, 3);
      this.lat = lim.max;
      this.h = Math.min(this.h, 0) * 0.3; this.r = 0; this.vy = 0; this.vl = Math.min(this.vl || 0, 0) * 0.3;
    } else if (this.lat < lim.min) {
      // à cheval sur le musoir quand la séparation commence → choc sur l'atténuateur
      if (this.latVel < -2.6 || lim.min - this.lat > 0.3) this.wallContact = Math.min(this.latVel, -3);
      this.lat = lim.min;
      this.h = Math.max(this.h, 0) * 0.3; this.r = 0; this.vy = 0; this.vl = Math.max(this.vl || 0, 0) * 0.3;
    }


    // — attitude : cap réel, suspension (roulis / tangage), inclinaison moto —
    this.yaw = -this.h;
    if (this.isMoto) {
      const leanT = Math.atan((this.ay || 0) / g);
      this.roll += (leanT - this.roll) * Math.min(1, dt * 8);
      this.rollV = 0;
    } else {
      const w = 8.5, z = 0.5;
      const rT = clamp(-(this.ay || 0) * P.rollK, -0.1, 0.1);
      this.rollV = (this.rollV || 0) + ((rT - this.roll) * w * w - 2 * z * w * (this.rollV || 0)) * dt;
      this.roll += this.rollV * dt;
    }
    {
      const w = 7.5, z = 0.55;
      const pT = clamp(-ax * P.pitchK, -0.05, 0.09);
      this.pitchV = (this.pitchV || 0) + ((pT - this.pitch) * w * w - 2 * z * w * (this.pitchV || 0)) * dt;
      this.pitch += this.pitchV * dt;
    }
    this.wheelSpin += (this.v / (this.spec.wr || 0.3)) * dt;

    this.place();
    this.updateFlash(dt);
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
    g.rotateZ(this.roll);
    if (this.bundle.wheels) {
      for (let i = 0; i < this.bundle.wheels.length; i++) {
        const w = this.bundle.wheels[i];
        // braquage des roues AVANT (ordre YXZ : pivot vertical avant la rotation
        // de roulement), signe négatif car la droite du véhicule = -X local
        if (this.bundle.wheels.length > 2 ? i < 2 : i === 0) {
          w.rotation.order = 'YXZ';
          w.rotation.y = -this.delta;
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
    this.lightsOn = on;
    this.headlight.intensity = on ? 95 : 0;
    this.bundle.glows.visible = on;
  }
  // appel de phares : deux éclats de pleins phares
  flashLights() { this.flashT = 0.62; }
  updateFlash(dt) {
    if (!(this.flashT > 0)) return;
    this.flashT -= dt;
    const on = this.flashT > 0 && (this.flashT > 0.42 || (this.flashT < 0.3 && this.flashT > 0.1));
    this.headlight.intensity = on ? 260 : (this.lightsOn ? 95 : 0);
    this.headlight.distance = on ? 90 : 46;
    this.bundle.glows.visible = on || !!this.lightsOn;
  }

  // caméra 3e personne (v19) : toujours dans l'axe de la ROUTE, regard droit
  // devant ; seul le décalage latéral suit la voiture (lissé), sans balayage
  // quand la voiture braque. La voiture reste centrée à l'écran.
  updateCamera(camera, dt, firstFrame = false) {
    const p = this._camP;
    const back = 5.6 + this.v * 0.045 + this.len * 0.35;
    const camS = this.s - back;
    this.track.pointAt(camS, p);
    const lookP = this._p;
    if (firstFrame || this._camLat == null) { this._camLat = this.lat; this._camY = null; }
    this._camLat = damp(this._camLat, this.lat, 9, dt);
    const camLat = this._camLat;
    const targetY = (this.y ?? p.y) + 2.35 + this.v * 0.008;
    this._camY = this._camY == null ? targetY : damp(this._camY, targetY, 6, dt);
    camera.position.set(p.x + p.rx * camLat, this._camY, p.z + p.rz * camLat);
    if (this.camShake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.camShake;
      camera.position.y += (Math.random() - 0.5) * this.camShake * 0.6;
      this.camShake *= Math.exp(-dt * 5);
    }
    this.track.pointAt(this.s + 14 + this.v * 0.25, lookP);
    const lookLat = camLat;
    camera.lookAt(lookP.x + lookP.rx * lookLat, (this.y ?? lookP.y) + (lookP.y - p.y) * 0.3 + 1.15, lookP.z + lookP.rz * lookLat);
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
