// ============================================================
// Périph' Rush — orchestration d'une manche
// Collisions (véhicules, balisage, glissières), frôlements avec
// combo, séquence de crash (ralenti + déformation + fumée),
// montée en difficulté par tour, PMV et annonces HUD.
// ============================================================

import { CFG, MS, KMH } from './config.js';
import { clamp, lerp, loopDelta, wrap, damp } from './utils.js';
import { TRAFFIC_LEVELS } from './traffic.js';
import { Rules } from './rules.js';
import { Police } from './police.js';
import { Cockpit } from './cockpit.js';
import { Feel } from './feel.js';
import { RampLife } from './ambient.js';
import { Wildlife } from './wildlife.js';

export class Game {
  constructor({ THREE, scene, track, world, traffic, events, player, ambience, score, ui, audio }) {
    Object.assign(this, { T: THREE, scene, track, world, traffic, events, player, ambience, score, ui, audio });
    this.state = 'idle';
    this.timescale = 1;
    this.slowmoT = 0;
    this.hornCooldown = 0;
    this.smoke = this.makeSmoke();
    this.result = null;
    this.rules = new Rules(track, world, ui, audio, score);
    this.police = new Police(THREE, scene, track, world.factory || traffic.factory, traffic);
    // v23 : sensations de conduite, vie des bretelles (feux d'accès, livreurs à vélo)
    this.feel = new Feel(this);
    this.rampLife = new RampLife(THREE, scene, track);
    this.wildlife = new Wildlife(THREE, scene, track);   // v27 : pigeons, feuilles, sacs plastique
    traffic.rampLife = this.rampLife;
    world.eventsRef = events;
    player.onLap = (lap) => this.onLap(lap);
  }

  // ---------- particules de fumée/étincelles (pool de sprites) ----------
  makeSmoke() {
    const T = this.T;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(210,215,220,0.85)');
    g.addColorStop(1, 'rgba(210,215,220,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(cv);
    const items = [];
    for (let i = 0; i < 22; i++) {
      const mat = new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
      const sp = new T.Sprite(mat);
      sp.visible = false;
      this.scene.add(sp);
      items.push({ sp, life: 0, vel: new T.Vector3(), spark: false });
    }
    return items;
  }

  emitSmoke(pos, n, spark = false) {
    let count = 0;
    for (const it of this.smoke) {
      if (it.life > 0) continue;
      it.life = spark ? 0.4 + Math.random() * 0.3 : 1.2 + Math.random() * 1.2;
      it.maxLife = it.life;
      it.spark = spark;
      it.sp.visible = true;
      it.sp.position.copy(pos);
      it.sp.position.x += (Math.random() - 0.5) * 1.2;
      it.sp.position.y += Math.random() * 0.8;
      it.sp.position.z += (Math.random() - 0.5) * 1.2;
      it.sp.scale.setScalar(spark ? 0.25 : 0.8 + Math.random());
      it.sp.material.color.setHex(spark ? 0xffc860 : 0xd2d7dc);
      it.vel.set((Math.random() - 0.5) * (spark ? 8 : 2), spark ? Math.random() * 5 : 1.6 + Math.random() * 1.4, (Math.random() - 0.5) * (spark ? 8 : 2));
      if (++count >= n) break;
    }
  }

  updateSmoke(dt) {
    for (const it of this.smoke) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) { it.sp.visible = false; it.sp.material.opacity = 0; continue; }
      it.sp.position.addScaledVector(it.vel, dt);
      it.vel.y -= (it.spark ? 12 : -0.8) * dt;
      const t = it.life / it.maxLife;
      it.sp.material.opacity = it.spark ? t : t * 0.55;
      if (!it.spark) it.sp.scale.addScalar(dt * 1.6);
    }
  }

  // ---------- démarrage --------------------------------------------------------
  start(carId, color) {
    this.state = 'running';
    this.timescale = 1;
    this.slowmoT = 0;
    this.score.reset();
    this.events.reset();
    this.police.reset();
    this.feel.reset();
    this.rampLife.reset();
    this.wildlife.reset();
    const set = this.ui.prog.data.settings;
    this.traffic.level = set.traffic ?? 1;
    this.world.trafficLevel = this.traffic.level;
    const LV = TRAFFIC_LEVELS[this.traffic.level];
    this.player.reset(carId, this.track.startFor(set.startPorte), color);
    this.rules.reset(this.traffic.level);
    this.rules.radarsOn = set.radars !== false;
    this.police.enabled = set.jumelles !== false;
    const ps = this.player.spec;
    this.audio.setVehicle?.(ps.kind === 'moto' ? (ps.moto === 'scooter' ? 'scoot1' : 'moto2') : 'car4');
    this.hitCooldown = 0;
    this.radioT = 20;
    this.player.v = MS(LV.startV);
    this.player.bundle.group.visible = true;
    this.player.autoThrottle = this.ui.prog.data.settings.autoThrottle;
    this.player.sens = this.ui.prog.data.settings.sensitivity ?? 1;
    this.player.input = this.ui.input;
    // v24 : boîte de vitesses audible (passage, coup de gaz au rétrogradage) et warnings automatiques
    this.player.onShift = (k) => this.audio.shift?.(k);
    this.player.onHazard = () => this.ui.popup('⚠ FEUX DE DÉTRESSE', '');
    this.runId = (this.runId || 0) + 1;
    this.stats = { time: 0, dist: 0, maxKmh: 0, overtakes: 0, laneCh: 0, signalled: 0, cutIns: 0 };
    this._lastLane = null; this._sigDir = 0; this._sigT = 99;
    this.traffic.reset(this.player.s);
    this.ambIndex = 0;
    this.ambience.startDay(this.startHour(set), set.weather || 'auto');
    this._night = null;
    this.applyNight();
    this.world.prebuild(this.player.s);
    this.ui.showHUD();
    this.world.setVMSAhead(this.player.s, [['PERIPH FLUIDE', 'BONNE ROUTE'], ['TRAFIC CHARGE', 'RALENTISSEMENTS'], ['PERIPH SATURE', 'BOUCHONS · PRUDENCE'], ['TRAFIC DENSE', 'ATTENTION RALENTISSEMENTS']][this.traffic.level]);
    this.world.updateVMS(this.player.s, true);
    this.applyCamera();
  }

  onLap(lap) {
    this.score.lap();
    this.traffic.lap = lap;
    this.events.lapBoost = 1 + lap * CFG.LAP_EVENT_GAIN;
    this.ui.popup(`TOUR ${lap} BOUCLÉ  +${CFG.LAP_SCORE.toLocaleString('fr-FR')}`, '');
    this.ui.popup('La circulation se densifie…', 'combo');
    this.ui.haptic([30, 40, 30]);
    this.audio.coin();
  }

  // vue extérieure / cockpit (réglage persistant)
  applyCamera() {
    const mode = this.ui.prog.data.settings.camera || 'chase';
    this.ui.setCameraButton?.(mode);
    if (!this.cockpit) return;
    const on = mode === 'cockpit' && (this.state === 'running' || this.state === 'crashing');
    const col = this.player.bundle?.spec ? this.ui.prog.selectedColor(this.player.carId) : null;
    this.cockpit.setActive(on, col);
  }

  // heure de départ : réglage, sinon selon le niveau de trafic
  startHour(set) {
    const map = { matin: 7.6, midi: 12.5, soir: 18.9, nuit: 23.2 };
    if (map[set.startHour]) return map[set.startHour];
    return [12 + Math.random() * 3, 17.1 + Math.random() * 0.6, 7.9 + Math.random() * 0.5, 18.4 + Math.random() * 0.8][this.traffic.level] ?? 14;
  }

  applyNight() {
    const night = this.ambience.headlightsOn;
    if (night === this._night) return;
    this._night = night;
    this.player.setHeadlights(night);
    this.player.factory.setNight(night); // lentilles émissives de tout le parc
    this.traffic.setNightGlows(night);
  }

  // densité du trafic selon l'heure (nuit plus calme ; la pointe reste saturée)
  dayFactor(h) {
    if (h < 5) return 0.45;
    if (h < 6.5) return lerp(0.45, 0.85, (h - 5) / 1.5);
    if (h > 22) return lerp(0.85, 0.5, (h - 22) / 2);
    return 1;
  }

  // juste avant le rendu (rétroviseurs du cockpit…)
  beforeRender(dt, camera, renderer) { this.cockpit?.beforeRender(dt, camera, renderer); }

  // ---------- boucle -------------------------------------------------------------
  update(rawDt, camera) {
    if (this.state !== 'running' && this.state !== 'crashing') return;
    // ralenti cinématique
    if (this.slowmoT > 0) {
      this.slowmoT -= rawDt;
      this.timescale = this.slowmoT > 0 ? 0.22 : 1;
      if (this.slowmoT <= 0 && this.state === 'crashing') this.finishCrash();
    }
    const dt = Math.min(rawDt, 0.05) * this.timescale;

    if (this.state === 'running') {
      this.player.update(dt);
      if (this.player.leftPeriph) { this.exitPeriph(); return; }
      if (this.rules.update(dt, this.player, this.traffic) === 'permis') { this.endRun('PERMIS INVALIDÉ', 'Plus aucun point sur votre permis : retrait immédiat, la voiture reste au bord du périph.'); return; }
      this.score.update(dt, this.player);
      if (this.player.input.brake > 0.6 && this.player.v > MS(40)) this.score.dirty();
    }
    this.traffic.update(dt, this.player, this.events);
    this.events.hour = this.ambience.hour;
    this.traffic.hour = this.ambience.hour;
    this.rampLife.hour = this.ambience.hour;
    this.rampLife.update(dt, this.player, this.traffic, this.events);
    this.events.update(dt, this.player, this.traffic);
    this.wildlife.update(dt, this.player, this.traffic, this.ambience);
    if (this.state === 'running') {
      const st = this.ui.prog.data.settings;
      this.rules.radarsOn = st.radars !== false;
      this.police.enabled = st.jumelles !== false;
      this.police.update(dt, this.player, this);
    }
    if (this.state !== 'running' && this.state !== 'crashing') return;
    this.world.update(this.player.s);
    const tunnel = this.track.inTunnel(this.player.s);
    this.ambience.update(rawDt, this.player.bundle.group.position, !!tunnel);
    this.applyNight();
    this.traffic.wet = this.ambience.wet;
    this.traffic.snow = this.player.snow = this.ambience.snow;
    this.ambience.nearSeine = !!this.track.onBridge(this.player.s) || !!this.track.onBridge(this.player.s + 250) || !!this.track.onBridge(this.player.s - 150);
    if (this.ambience.hailT > 0 && !tunnel) { this.hailSndT = (this.hailSndT || 0) - rawDt; if (this.hailSndT <= 0) { this.hailSndT = 0.03 + Math.random() * 0.05; this.audio.burst?.({ dur: 0.03, freq: 3500 + Math.random() * 2500, type: 'bandpass', q: 3, gain: 0.04 + Math.random() * 0.05 }); } if (!this._hailMsg) { this._hailMsg = true; this.ui.popup('☄ AVERSE DE GRÊLE', 'fine'); } } else this._hailMsg = false;
    this.player.wet = this.ambience.wet;
    this.world.wetLevel = this.ambience.wet;
    this.traffic.dayFactor = this.dayFactor(this.ambience.hour ?? 14);
    this.updateSmoke(rawDt);
    if (!this.cockpit) { this.cockpit = new Cockpit(this.T, this.scene, camera, this.player, this.track); this.applyCamera(); }
    this.cockpit.rain = this.ambience.rainAmt;
    this.cockpit.hour = this.ambience.hour; this.cockpit.tunnel = !!tunnel;
    if (this._screenReset !== this.runId) { this._screenReset = this.runId; this.cockpit.resetScreen?.(this.ambience.hour); }
    if (this.cockpit.active) { this.cockpit.gps = this.gpsInfo(); this.cockpit.clock = this.ambience.clockText; }
    if (this.cockpit.active) this.cockpit.updateCamera(camera, rawDt);
    else this.player.updateCamera(camera, rawDt);
    this.feel.update(rawDt, camera);
    // v27 : éclat du soleil renvoyé par les tours vitrées (matin / soir)
    if (this.world.skyline?.glint) {
      const A = this.ambience;
      const k = this.world.skyline.glint(camera, A.sun.position, A.sunTarget.position, A.elevation ?? 1, Math.min(1, (A.rainAmt || 0) + (A.fogAmt || 0) + (this.track.inTunnel(this.player.s) ? 1 : 0)));
      this.feel.towerGlare = k; this.feel.towerGlarePos = this.world.skyline.screen;
    }

    if (this.state === 'running') {
      this.checkNearMisses();
      this.checkCollisions();
      this.updateHUD();
      this.updateAids(rawDt, dt);
      this.audio.setEnv({ tunnel: !!tunnel, wet: this.ambience.wet, cockpit: !!this.cockpit?.active });
      this.audio.engine(this.player.v, this.player.vmax, Math.max(this.player.input.throttle, this.player.autoThrottle ? 0.6 : 0), rawDt);
      this.audio.rain(tunnel ? 0 : this.ambience.cur.rain);
      this.updateSounds(rawDt);
      this.hornCooldown -= rawDt;
      this.hitCooldown = Math.max(0, (this.hitCooldown || 0) - dt);
    }
  }

  // ---------- klaxon / appel de phares du joueur ----------------------------
  playerHorn(on) {
    if (this.state !== 'running') { this.audio.playerHorn(false); return; }
    this.audio.playerHorn(on, this.player.isMoto);
    if (on) this.signalReact('horn');
  }
  // v26 : clignotants du joueur
  playerBlink(dir) {
    if (this.state !== 'running') return;
    const d = this.player.toggleBlink(dir);
    if (!d) return;
    const r = this.traffic.playerBlinker(this.player, d);
    if (r === 'yield') this.ui.popup('👍 ON VOUS LAISSE PASSER', '');
    else if (r === 'refuse') this.ui.popup('😤 IL NE VOUS LAISSE PAS', 'fine');
  }
  // v26 : aides et statistiques — boutons de clignotant, tic-tac, angle mort, queue-de-poisson, bilan
  updateAids(rawDt, dt) {
    const p = this.player, st = this.stats;
    const $ = (id) => (this._el ??= {})[id] ?? (this._el[id] = document.getElementById(id));
    for (const [id, d] of [['btn-bl', -1], ['btn-br', 1]]) {
      const on = p.blinkDir === d || p.hazardT > 0;
      $(id).classList.toggle('on', on);
      $(id).classList.toggle('dim', on && !p.blinkOn);
    }
    const blinking = p.blinkDir !== 0 || p.hazardT > 0;
    if (blinking && p.blinkOn !== this._blinkPh) this.audio.tick?.(p.blinkOn);
    this._blinkPh = p.blinkOn;
    // v27 : priorité à droite aux entrées — rappel discret quand une voiture entre à votre hauteur
    this._prioCd = Math.max(0, (this._prioCd || 0) - dt);
    if (!this._prioCd && p.laneIdx >= this.traffic.rightLane(p.s) && this.traffic.entrantNear(p)) {
      this._prioCd = 25;
      this.ui.popup('↖ PRIORITÉ À DROITE : LAISSEZ ENTRER', '');
    }
    // changement de voie : avec ou sans clignotant ?
    if (p.blinkDir) { this._sigDir = p.blinkDir; this._sigT = 0; } else this._sigT += dt;
    const lane = p.laneIdx;
    if (this._lastLane != null && lane !== this._lastLane && !p.ramp && lane >= 0 && lane < CFG.LANES && this._lastLane >= 0 && this._lastLane < CFG.LANES) {
      const dir = Math.sign(lane - this._lastLane);
      st.laneCh++;
      const signalled = this._sigDir === dir && this._sigT < 2.5;
      if (signalled) st.signalled++;
      else if (this.traffic.playerCutIn(p, lane)) st.cutIns++;   // v27 : plus de message à l'écran
    }
    this._lastLane = lane;
    // bilan
    st.time += dt; st.dist += p.v * dt; st.maxKmh = Math.max(st.maxKmh, p.kmh || p.v * 3.6);
    const L = this.track.length;
    for (const n of this.traffic.npcs) {
      const rel = loopDelta(n.s, p.s, L);
      if (n._rel != null && n._rel > 0 && rel <= 0 && Math.abs(rel) < 30 && n.mode !== 'chase') st.overtakes++;
      n._rel = rel;
    }
    // compteurs à aiguilles
    this.drawGauges();
  }
  drawGauges() {
    const on = this.ui.prog.data.settings.gauges !== false && !this.cockpit?.active;
    const cv = (this._gcv ??= document.getElementById('gauges'));
    cv.classList.toggle('hidden', !on);
    if (!on) return;
    if ((this._gFrame = (this._gFrame || 0) + 1) % 2) return;
    const c = cv.getContext('2d'), p = this.player, W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    const dial = (cx, cy, R, val, max, ticks, red, label, unit) => {
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
      c.fillStyle = 'rgba(10,14,22,0.72)'; c.beginPath(); c.arc(cx, cy, R + 6, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.25)'; c.stroke();
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks, a = a0 + (a1 - a0) * t, big = i % 2 === 0;
        c.strokeStyle = red != null && t >= red ? '#ff4a3a' : '#e8edf2'; c.lineWidth = big ? 2.4 : 1.2;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * R * (big ? 0.78 : 0.85), cy + Math.sin(a) * R * (big ? 0.78 : 0.85)); c.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); c.stroke();
        if (big && label) { c.fillStyle = '#cfd7df'; c.font = '700 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(label(i)), cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6); }
      }
      const t = Math.max(0, Math.min(1, val / max)), a = a0 + (a1 - a0) * t;
      c.strokeStyle = '#ff5a2a'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx - Math.cos(a) * 8, cy - Math.sin(a) * 8); c.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); c.stroke();
      c.fillStyle = '#20262e'; c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9aa6b2'; c.font = '800 9px sans-serif'; c.fillText(unit, cx, cy + R * 0.45);
    };
    const GE = p.isMoto ? [0, 30, 55, 80, 105, 130, 175] : [0, 22, 40, 60, 84, 115, 160];
    const g = Math.max(1, Math.min(6, p.gear || 1)), kmh = p.v * 3.6, x = Math.max(0, Math.min(1.05, (kmh - (g === 1 ? 0 : GE[g - 1] - 6)) / (GE[g] - (g === 1 ? 0 : GE[g - 1] - 6))));
    const target = (g === 1 ? 850 : 1700) + x * (p.isMoto ? 6500 : 3900) + (p.input?.throttle || 0) * 250;
    this._rpm = (this._rpm || 900) + (target - (this._rpm || 900)) * 0.35;
    const rpm = p.shiftT > 0 ? this._rpm * 0.8 : this._rpm;
    dial(75, 78, 62, rpm, p.isMoto ? 10000 : 7000, 14, 6 / 7, (i) => (p.isMoto ? Math.round(i / 1.4) : i / 2), '×1000 tr/min');
    dial(225, 78, 62, p.v * 3.6, 140, 14, null, (i) => i * 10, 'km/h');
    c.fillStyle = '#ffd12b'; c.font = '800 16px sans-serif'; c.textAlign = 'center';
    c.fillText(p.isMoto ? '' : String(p.gear || 1), 75, 108);
  }

  playerFlash() {
    if (this.state !== 'running') return;
    this.player.flashLights();
    this.signalReact('flash');
  }
  signalReact(kind) {
    const r = this.traffic.playerSignal(kind, this.player);
    if (r === 'brake') this.ui.popup('⚠ IL PILE !', 'fine');
    else if (r === 'block') this.ui.popup('😠 IL VOUS BLOQUE', 'fine');
    else if (r === 'move') this.ui.popup('👍 IL SE RABAT', '');
  }

  // ---------- HUD -------------------------------------------------------------------
  updateHUD() {
    const p = this.player;
    const next = this.track.nextPorte(p.s);
    let warning = null;
    const ev = this.events.warningAhead(p.s);
    if (p.ramp && p.ramp.kind === 'X') {
      const dest = p.ramp.j?.dests?.find((d) => /^Porte/.test(d[0]))?.[0] || p.ramp.j?.dests?.[0]?.[0];
      warning = `⛔ SORTIE${dest ? ' ' + dest.toUpperCase() : ''} — REVENEZ À GAUCHE !`;
    } else if (this.police.chase) {
      warning = this.police.chaseText(p);
    } else if (this.rules.warning) {
      warning = this.rules.warning;
    } else if (ev) {
      const side = ev.lanes.includes(0) ? 'GAUCHE' : 'DROITE';
      warning = `⚠ ${{ travaux: 'TRAVAUX', panne: 'VÉHICULE EN PANNE', controle: 'CONTRÔLE DE POLICE' }[ev.type] || 'ACCIDENT'} ${Math.round(ev.dist / 10) * 10} m · VOIE ${side}`;
    } else {
      const jam = this.traffic.jamAhead(p.s);
      if (this.traffic.motoBehindPlayer) warning = '🏍 UNE MOTO VEUT PASSER — SERREZ À DROITE';
      else if (this.traffic.flashBehindPlayer > 0) warning = '🔦 APPEL DE PHARES DERRIÈRE — RABATTEZ-VOUS À DROITE';
      else if (jam && jam.dist < 700) warning = `⚠ RALENTISSEMENT ${Math.round(jam.dist / 100) * 100} m`;
    }
    this.ui.updateHUD({
      kmh: p.kmh,
      score: this.score.points,
      coins: this.ui.prog.data.coins + this.score.coins,
      laps: p.laps,
      mult: this.score.multiplier,
      porte: next.porte,
      porteDist: next.dist,
      warning,
      clock: this.ambience.clockText,
      weather: this.ambience.hailT > 0 ? 'grele' : (this.ambience.snowAmt || 0) > 0.2 ? 'neige' : this.ambience.rainAmt > 0.15 ? 'pluie' : (this.ambience.fogAmt > 0.3 ? 'brouillard' : (this.ambience.elevation < 0 ? 'nuit' : 'soleil')),
      health: p.health,
      permis: this.rules.points,
      fines: this.rules.fines,
      gps: this.gpsInfo(),
    });
  }

  // ---------- sons du trafic, sirènes, joints de viaduc, radio ----------
  updateSounds(dt) {
    const p = this.player, L = this.track.length, a = this.audio;
    a.tires?.(p.slip || 0, p.abs, p.v, dt);
    // les 3 véhicules les plus proches : moteur + roulement spatialisés (Doppler)
    const near = [];
    for (const n of this.traffic.npcs) {
      if (n.mode === 'emerg') continue;
      const ds = loopDelta(n.s, p.s, L), dl = n.lat - p.lat;
      const d = Math.hypot(ds, dl);
      if (d < 45) near.push({ n, d, ds, dl });
    }
    near.sort((x, y) => x.d - y.d);
    a.voices?.(near.slice(0, 3).map(({ n, d, ds, dl }) => {
      const dir = ds / Math.max(d, 0.1);
      const vr = (p.v - n.v) * dir; // > 0 : on se rapproche (il est devant et plus lent)
      return { dist: d, pan: clamp(dl / 6, -1, 1), doppler: 343 / (343 - clamp(vr, -40, 40)), rpm: n.moto ? 3500 + n.v * 160 : 900 + Math.min(n.v, 20) * 70 + Math.max(0, n.acc) * 300, moto: n.moto, v: n.v };
    }));
    for (const e of this.traffic.sfx) {
      if (!e.s) continue;
      const ds = loopDelta(e.s, p.s, L), dl = e.lat - p.lat;
      const dist = Math.hypot(ds, dl);
      if (dist < 140) a.hornAt(e.type, clamp(dl / 8, -1, 1) * (this.cockpit?.active ? 1 : 0.7), dist + (e.far ? 15 : 0));
    }
    // sirène la plus proche (Doppler : approche = plus aigu)
    let best = null, bd = 1e9;
    for (const n of this.traffic.npcs) {
      if (n.mode !== 'emerg' && n.mode !== 'chase') continue;
      const ds = loopDelta(n.s, p.s, L);
      const d = Math.hypot(ds, n.lat - p.lat);
      if (d < bd) { bd = d; best = { n, ds }; }
    }
    if (best && bd < 320) {
      const vr = best.ds < 0 ? best.n.v - p.v : p.v - best.n.v; // vitesse de rapprochement
      const dop = 343 / (343 - clamp(vr, -60, 60));
      a.siren(0.16 * Math.pow(1 - bd / 320, 1.6), dop, clamp((best.n.lat - p.lat) / 8, -1, 1), dt);
    } else a.siren(0, 1, 0, dt);
    // (v23 : joints, reprises et tampons → feel.js)
    this.cityAmbience(dt);
    // v24 : revêtement sous les roues
    {
      const t = this.track;
      const km = Math.floor(p.s / 900), h = Math.imul(km + 3, 2654435761) >>> 0;
      a.surface = t.onViaduct(p.s) || t.onBridge(p.s) || t.coverAt(p.s) ? 'beton' : (h % 4 === 0 ? 'neuf' : 'enrobe');
    }
    // radio : station choisie (info-trafic parlée ou musique générée)
    const st = this.radioKey();
    if (a.station !== st) a.setStation(st);
    // v27 : réception coupée dans les tunnels (couvertures longues)
    const tun = !!this.track.inTunnel(p.s);
    a.radioTunnel?.(tun, st !== 'off');
    if (tun) this.radioT = Math.max(this.radioT ?? 0, 3);   // pas de bulletin sous terre
    // v26 : dépanneuse sur place / voie rouverte
    if (this.events.notice) {
      const k = this.events.notice; this.events.notice = null;
      if (k === 'tow') this.ui.popup('🚛 DÉPANNEUSE SUR PLACE', '');
      else { this.ui.popup('✅ VOIE ROUVERTE', ''); if (st === 'info') a.radio('Bonne nouvelle : l\'accident est dégagé, la voie est rouverte. La circulation reprend progressivement.'); }
    }
    if (st === 'info') {
      const nEv = (this.events.active || []).length;
      if (nEv > (this._nEv ?? 0) && this.radioT > 6) this.radioT = 4;   // flash info : nouvel événement
      this._nEv = nEv;
      this.radioT = (this.radioT ?? 22) - dt;
      if (this.radioT <= 0) { this.radioT = 140 + Math.random() * 60; a.radio(this.radioText()); }
    }
  }

  radioKey() {
    const v = this.ui.prog.data.settings.radio;
    return v === false ? 'off' : v === true || v == null ? 'info' : v;
  }
  radioChanged() {
    if (this.state !== 'running') return;
    this.audio.stopRadio();
    this.audio.setStation(this.radioKey());
    if (this.radioKey() === 'info') this.radioT = 2;
  }

  radioText() {
    const t = this.track, L = t.length, amb = this.ambience;
    const h = Math.floor(amb.hour), m = Math.floor((amb.hour - h) * 60);
    const short = (n) => n || 'la porte suivante';
    const lines = [`Périph Info, il est ${h} heures${m ? ' ' + m : ''}.`];
    const lv = this.traffic.level;
    // v24 : l'info trafic parle de ce qui se passe réellement devant vous
    const ps = this.player.s;
    const ahead = (x) => wrap(x - ps, L);
    const km = (d) => (d < 1000 ? `${Math.round(d / 100) * 100} mètres` : `${(d / 1000).toFixed(1).replace('.', ',')} kilomètre${d >= 2000 ? 's' : ''}`);
    const evs = (this.events.active || []).map((e) => ({ e, d: ahead(e.s0) })).filter((o) => o.d > 30 && o.d < 9000).sort((a, b) => a.d - b.d);
    const jam = this.traffic.jams.map((j) => ({ j, d: ahead(j.s - j.len / 2) })).filter((o) => o.d < 8000).sort((a, b) => a.d - b.d)[0]?.j;
    if (evs.length) {
      const { e, d } = evs[0];
      const where = short(t.nextPorte(e.s0).porte?.name);
      const lane = e.lanes?.includes(0) ? 'la voie de gauche' : 'la voie de droite';
      const what = { accident: 'un accident', travaux: 'des travaux', panne: 'un véhicule en panne', controle: 'un contrôle de police sur le bas-côté' }[e.type] || 'un incident';
      lines.push(`Attention, à ${km(d)} devant vous, à hauteur de ${where}, ${what} ${e.type === 'travaux' ? 'neutralisent' : 'neutralise'} ${lane}.`);
      const qj = this.traffic.jams.find((j) => j.ev === e);
      if (qj && qj.len > 120) lines.push(`Ça bouchonne déjà sur ${km(qj.len)} en amont : ralentissez et serrez à ${e.lanes?.includes(0) ? 'droite' : 'gauche'}.`);
      if (e.type === 'accident' && e.phase === 'depannage') lines.push('Les dépanneuses sont sur place.');
      if (e.type === 'travaux' && (amb.hour >= 21.5 || amb.hour < 5.5)) lines.push('Travaux de nuit : le balisage est en place jusqu’à cinq heures.');
    }
    if (jam && !jam.ev) {
      const a = t.nextPorte(wrap(jam.s - jam.len / 2 - 200, L)).porte?.name;
      const b = t.nextPorte(wrap(jam.s + jam.len / 2, L)).porte?.name;
      const k2 = Math.max(1, Math.round((jam.len + (lv === 2 ? 1500 : 0)) / 1000));
      lines.push(`Sur le périphérique intérieur, ${lv === 2 ? 'bouchon' : lv === 3 ? 'ralentissements en accordéon' : 'ralentissement'} de ${k2} kilomètre${k2 > 1 ? 's' : ''} entre ${short(a)} et ${short(b)}.`);
    } else if (!evs.length) lines.push(['Le trafic est fluide sur l’ensemble du périphérique intérieur.', 'Circulation dense mais sans difficulté majeure sur le périphérique intérieur.', 'Le périphérique est saturé sur la quasi-totalité de l’anneau.', 'Trafic très dense sur le périphérique intérieur, avec des ralentissements en accordéon : gardez vos distances.'][lv]);
    if (lv === 2) lines.push('Rappel : la voie de gauche est réservée au covoiturage, aux taxis et aux bus.');
    if ((amb.snowAmt || 0) > 0.2) lines.push('Il neige sur Paris : la chaussée est glissante, la circulation très ralentie. Roulez au pas et gardez vos distances.');
    else if (amb.hailT > 0) lines.push('Une averse de grêle traverse la capitale : ralentissez.');
    else if (amb.rainAmt > 0.3) lines.push('Il pleut sur Paris, chaussée glissante : augmentez vos distances de sécurité.');
    else if ((amb.seineFog || 0) > 0.3) lines.push('Brouillard givrant sur les bords de Seine ce matin : allumez vos feux.');
    else if (amb.fogAmt > 0.3) lines.push('Brouillard sur l’est parisien, allumez vos feux.');
    lines.push('Bonne route avec Périph Info.');
    return lines.join(' ');
  }

  // bandeau GPS : prochaines sorties et position de la sortie (voie de droite)
  gpsInfo() {
    const t = this.track, L = t.length, s = this.player.s;
    const out = [];
    const exits = t.exits.map((x) => ({ x, d: wrap(x.s - s, L) })).filter((o) => o.d > -20).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const { x, d } of exits) {
      const name = x.dests?.find((q) => /^Porte/.test(q[0]))?.[0] || x.dests?.[0]?.[0] || 'Sortie';
      const other = x.dests?.filter((q) => !/^Porte/.test(q[0])).map((q) => q[0]).slice(0, 1)[0];
      out.push({ name, other, d });
    }
    return out;
  }

  // v23 : la ville autour — klaxons lointains, sirènes sur l'autre sens, moto qui remonte l'interfile
  cityAmbience(dt) {
    const a = this.audio, p = this.player, L = this.track.length;
    if (!a.ctx) return;
    const tunnel = !!this.track.inTunnel(p.s);
    this.cityHornT = (this.cityHornT ?? 6) - dt;
    if (this.cityHornT <= 0) {
      this.cityHornT = (this.traffic.busy ? 5 : 11) + Math.random() * 14;
      a.hornAt(Math.random() < 0.15 ? 'airhorn' : Math.random() < 0.3 ? 'mhorn' : 'horn', Math.random() * 2 - 1, 70 + Math.random() * 120);
    }
    this.citySirenT = (this.citySirenT ?? 40) - dt;
    if (this.citySirenT <= 0) {
      this.citySirenT = 55 + Math.random() * 80;
      if (!tunnel) a.distantSiren?.(Math.random() < 0.6 ? 'pompiers' : 'police');
    }
    a.cityBed?.(tunnel ? 0.4 : 1, this.ambience.hour ?? 14);
    // v24 : épaves qui fument (nuage bleuté derrière l'échappement)
    this.smokyT = (this.smokyT || 0) - dt;
    if (this.smokyT <= 0) {
      this.smokyT = 0.14;
      for (const n of this.traffic.npcs) {
        if (!n.smoky || !n.bundle?.group) continue;
        const d = loopDelta(n.s, p.s, L);
        if (d < -40 || d > 90) continue;
        const q = {}; this.track.pointAt(n.s - n.len / 2 - 0.3, q);
        this.emitSmoke(new this.T.Vector3(q.x + q.rx * n.lat, (n.y ?? q.y) + 0.35, q.z + q.rz * n.lat), 1, false);
      }
    }
    // deux-roues qui passe en trombe à côté (interfile) : souffle
    for (const n of this.traffic.npcs) {
      if (!n.moto || n.mode !== 'interfile') continue;
      const d = loopDelta(n.s, p.s, L);
      if (Math.abs(d) < 1.5 && Math.abs(n.lat - p.lat) < 2.4 && n.v - p.v > 3 && !n._whoosh) {
        n._whoosh = true; a.whoosh?.(clamp((n.lat - p.lat) / 2, -1, 1));
        // v24 : vous lui avez laissé de la place → il remercie (pied tendu ou main levée)
        if (Math.abs(n.lat - p.lat) > 1.3 && Math.random() < 0.7) { this.feel.thank(n, n.lat > p.lat ? -1 : 1); this.ui.popup('👋 LE MOTARD VOUS REMERCIE', 'combo'); this.score.points += 150; }
      }
      if (d > 8) n._whoosh = false;
    }
  }

  // ---------- frôlements ---------------------------------------------------------------
  checkNearMisses() {
    const p = this.player;
    const L = this.track.length;
    for (const n of this.traffic.npcs) {
      const d = loopDelta(n.s, p.s, L);
      const overlap = Math.abs(d) < (n.len + p.len) / 2 + 0.6;
      const latGap = Math.abs(this.traffic.latOf(n) - p.lat) - (n.wid + p.wid) / 2;
      const relSpeed = Math.abs(p.v - n.v) + Math.abs(p.latVel);
      if (overlap && latGap < CFG.NEAR_MISS_DIST && latGap > -0.05 && relSpeed > CFG.NEAR_MISS_RELSPEED) {
        n.nearFlag = true;
      }
      if (n.nearFlag && d < -(n.len + p.len) / 2 - 1) {
        n.nearFlag = false;
        const { pts, combo } = this.score.nearMiss();
        this.ui.popup(`FRÔLEMENT +${pts}`, '');
        if (combo > 1) this.ui.popup(`COMBO ×${combo}`, 'combo');
        this.ui.haptic(12);
        this.audio.nearMiss();
        if (this.hornCooldown <= 0 && Math.random() < 0.3) {
          this.audio.horn(false);
          this.hornCooldown = 4;
        }
      }
      if (d < -(n.len + p.len)) n.nearFlag = false;
    }
  }

  // ---------- collisions ------------------------------------------------------------------
  checkCollisions() {
    const p = this.player;
    const L = this.track.length;
    // glissières / séparateur
    if (p.wallContact) {
      const sev = clamp(Math.abs(p.wallContact) / 9 + p.v / (p.vmax * 2.4), 0.15, 1);
      return this.hit(sev * 0.85, p.wallContact > 0 ? 'barrier-right' : 'barrier-left', null);
    }
    if (this.hitCooldown > 0) return;
    // véhicules
    for (const n of this.traffic.npcs) {
      const d = loopDelta(n.s, p.s, L);
      if (Math.abs(d) > (n.len + p.len) / 2) continue;
      const latGap = Math.abs(this.traffic.latOf(n) - p.lat) - (n.wid + p.wid) / 2;
      if (latGap < -0.02) {
        const rel = Math.abs(p.v - n.v);
        const lateral = Math.abs(p.latVel);
        const frontal = d > 0 && rel > lateral * 1.4;
        const sev = clamp((frontal ? rel / 13 : (lateral + rel * 0.3) / 8) + p.v / (p.vmax * 3), 0.12, 1);
        return this.hit(sev, frontal ? 'front' : 'side', n);
      }
    }
    // balisage / véhicules arrêtés des événements
    for (const o of this.events.obstacles()) {
      if (o.hit) continue;
      const d = loopDelta(o.s, p.s, L);
      if (Math.abs(d) > (o.len + p.len) / 2) continue;
      const latGap = Math.abs(o.lat - p.lat) - (o.wid + p.wid) / 2;
      if (latGap < -0.02) {
        const sev = o.cone ? clamp(p.v / 28, 0.1, 0.5) : clamp(p.v / 16, 0.3, 1);
        if (o.cone) { o.hit = true; }
        return this.hit(sev, o.cone ? 'cone' : 'front', null);
      }
    }
  }

  // dégâts progressifs : un accrochage léger abîme la voiture sans finir la partie
  hit(sev, kind, npc) {
    if (this.state !== 'running') return;
    const p = this.player;
    const minor = sev < 0.45 && p.health - sev * 85 > 0;
    if (!minor) return this.crash(sev, kind, npc);
    const dmg = Math.round(sev * 85);
    p.health -= dmg;
    this.hitCooldown = 0.9;
    this.audio.crash(sev * 0.6);
    if (kind.startsWith('barrier')) this.audio.scrape();
    this.ui.haptic([35]);
    this.ui.flashCrack(0);
    this.score.penalty(600 + dmg * 20);
    p.deform(this.impactFor(kind, sev), sev * 0.7);
    if (kind === 'front' || kind === 'cone') { p.headBroken = p.headBroken || sev > 0.2; if (p.lightsOn) p.headlight.intensity = 40; }
    p.camShake = 0.06 + sev * 0.12;   // v27 : secousse seulement au choc, brève
    const pos = p.bundle.group.position.clone(); pos.y += 0.6;
    this.emitSmoke(pos, 6, true);
    // rebond : on s'écarte de l'obstacle et on perd de la vitesse
    if (kind.startsWith('barrier')) p.latVel = (kind === 'barrier-right' ? -1 : 1) * Math.max(1.5, Math.abs(p.latVel) * 0.4);
    else if (npc) {
      const side = Math.sign(p.lat - this.traffic.latOf(npc)) || 1;
      p.latVel = side * 2.6;
      p.lat += side * 0.25;
      npc.v = Math.max(0, npc.v * (kind === 'front' ? 1.05 : 0.85)); npc.brakeFlash = 2; npc.hazardT = 8;
    }
    p.v *= kind === 'front' ? 0.55 : kind === 'cone' ? 0.85 : 0.8;
    // v19 : le choc casse la trajectoire en cours (cap redressé, cible latérale recalculée)
    p.h *= kind === 'front' ? 0.5 : 0.25; p.r = 0;
    p.vl = npc ? (Math.sign(p.lat - this.traffic.latOf(npc)) || 1) * 2.6 : kind.startsWith('barrier') ? (kind === 'barrier-right' ? -1.5 : 1.5) : (p.vl || 0) * 0.3;
    this.ui.popup(`${kind === 'cone' ? 'CÔNE PERCUTÉ' : 'ACCROCHAGE'} · CARROSSERIE −${dmg} %`, 'fine');
  }

  impactFor(kind, severity) {
    const p = this.player;
    const impact = {
      x: kind === 'side' ? (p.latVel > 0 ? -p.wid / 2 : p.wid / 2) : 0,
      y: 0.55,
      z: kind === 'front' || kind === 'cone' ? p.len / 2 : 0,
      nx: kind === 'side' ? (p.latVel > 0 ? 1 : -1) * 0.8 : 0,
      ny: 0.2,
      nz: kind === 'front' ? -1 : -0.3,
    };
    if (kind.startsWith('barrier')) { impact.x = kind === 'barrier-right' ? p.wid / 2 : -p.wid / 2; impact.nx = kind === 'barrier-right' ? -0.9 : 0.9; impact.z = (Math.random() - 0.5) * p.len * 0.6; }
    return impact;
  }

  crash(severity, kind, npc) {
    if (this.state !== 'running') return;
    this.state = 'crashing';
    this.crashSeverity = severity;
    this.crashKind = kind;
    this.player.crash();
    this.audio.crash(severity);
    this.audio.stopEngine();
    if (kind.startsWith('barrier') || severity < 0.3) this.audio.scrape();
    this.ui.haptic(severity < 0.35 ? [40] : severity < 0.7 ? [60, 40, 60] : [90, 50, 90, 50, 120]);
    this.ui.flashCrack(severity);
    // déformation au point d'impact (repère local du véhicule)
    const impact = {
      x: kind === 'side' ? (this.player.latVel > 0 ? -this.player.wid / 2 : this.player.wid / 2) : 0,
      y: 0.55,
      z: kind === 'front' || kind === 'cone' ? this.player.len / 2 : (kind === 'barrier-right' ? 0 : 0),
      nx: kind === 'side' ? (this.player.latVel > 0 ? 1 : -1) * 0.8 : 0,
      ny: 0.2,
      nz: kind === 'front' ? -1 : -0.3,
    };
    if (kind.startsWith('barrier')) { impact.x = kind === 'barrier-right' ? this.player.wid / 2 : -this.player.wid / 2; impact.nx = kind === 'barrier-right' ? -0.9 : 0.9; }
    this.player.deform(impact, severity);
    // fumée + étincelles
    const pos = this.player.bundle.group.position.clone();
    pos.y += 0.7;
    this.emitSmoke(pos, severity > 0.5 ? 10 : 4, false);
    this.emitSmoke(pos, 8, true);
    this.player.camShake = 0.1 + severity * 0.2;
    // ralenti cinématique
    this.slowmoT = 1.15;
    this.timescale = 0.22;
    // le véhicule percuté freine/percute aussi
    if (npc) { npc.v = Math.min(npc.v, this.player.v * 0.4); npc.brakeFlash = 3; }
    this.player.v *= kind === 'front' ? 0.25 : 0.6;
  }

  endRun(title, text) {
    this.audio.stopRadio?.();
    this.state = 'over';
    this.timescale = 1;
    this.audio.stopEngine();
    this.audio.siren?.(0);
    const result = this.withFines(this.score.finalize(this.player));
    const extras = this.ui.prog.applyRun(result);
    this.ui.showGameOver(result, 0.2, text + this.finesText(), extras, title);
    this.result = result;
  }
  withFines(result) { result.fines = this.rules.fines; result.permis = this.rules.points; result.stats = this.statsSummary(); return result; }
  statsSummary() {
    const st = this.stats || {}, r = this.rules;
    return { time: st.time || 0, avg: st.time > 1 ? (st.dist / st.time) * 3.6 : 0, max: st.maxKmh || 0, overtakes: st.overtakes || 0,
      radars: [Math.max(0, (r.radarsPassed || 0) - (r.radarsFlashed || 0)), r.radarsPassed || 0], laneCh: st.laneCh || 0, signalled: st.signalled || 0, cutIns: st.cutIns || 0 };
  }
  finesText() {
    const r = this.rules;
    if (!r.tickets.length) return '';
    return ` · Amendes : ${r.fines.toLocaleString('fr-FR')} € (${r.tickets.length} PV), permis : ${r.points}/12 points.`;
  }

  // le joueur a pris une sortie : hors périphérique = partie perdue
  exitPeriph() {
    this.audio.stopRadio?.();
    this.state = 'over';
    this.timescale = 1;
    this.audio.stopEngine();
    this.ui.haptic([50, 40, 50]);
    const r = this.player.ramp || this.player.lastRamp;
    const dest = r?.j?.dests?.find((d) => /^Porte/.test(d[0]))?.[0];
    this.audio.siren?.(0);
    const result = this.withFines(this.score.finalize(this.player));
    const extras = this.ui.prog.applyRun(result);
    this.ui.showGameOver(result, 0.2, `Vous avez quitté le boulevard périphérique${dest ? ` par la sortie ${dest}` : ''}. Ici, on reste sur l’anneau !` + this.finesText(), extras, 'SORTIE · PERDU');
    this.result = result;
  }

  finishCrash() {
    this.audio.stopRadio?.();
    this.state = 'over';
    this.timescale = 1;
    this.audio.siren?.(0);
    const result = this.withFines(this.score.finalize(this.player));
    const extras = this.ui.prog.applyRun(result);
    const damage = this.damageText(this.crashSeverity, this.crashKind) + this.finesText();
    this.ui.showGameOver(result, this.crashSeverity, damage, extras);
    this.result = result;
  }

  damageText(sev, kind) {
    const where = {
      front: 'à l’avant', side: 'sur le flanc', cone: 'dans le balisage',
      'barrier-right': 'contre la glissière', 'barrier-left': 'contre le séparateur central',
    }[kind] || '';
    if (sev < 0.35) return `Petit accrochage ${where} : rayures profondes, rétroviseur arraché, pare-chocs marqué. Plus de peur que de mal — mais la course s’arrête là.`;
    if (sev < 0.7) return `Accident ${where} : aile enfoncée, optique brisée, la portière ne ferme plus. Le trafic se fige derrière vous…`;
    return `Gros accident ${where} : carrosserie déformée, pare-brise étoilé, fumée sous le capot. La dépanneuse arrive de la ${['Porte de Bagnolet', 'Porte d’Italie', 'Porte de Clichy'][(Math.random() * 3) | 0]}.`;
  }

  // pour l'écran de menu : caméra cinématique au-dessus du trafic
  // aperçu du menu : se place à la porte choisie, au niveau de trafic choisi
  preview(startName, level) {
    this.traffic.level = level;
    this.world.trafficLevel = level;
    const s = this.track.startFor(startName);
    this.player.s = s;
    this.player.v = MS(TRAFFIC_LEVELS[level].startV);
    this.player.place();
    this.world.prebuild(s);
    this.traffic.reset(s);
    this.world.updateVMS(s, true);
    const set = this.ui.prog.data.settings;
    this.ambience.startDay(this.startHour(set), set.weather || 'auto');
    this._night = null;
  }

  attractUpdate(rawDt, camera, t) {
    const dt = Math.min(rawDt, 0.05);
    if (this.cockpit?.active) this.cockpit.setActive(false);
    // fait rouler doucement le "joueur fantôme" pour suivre le flux
    const lim = Math.min(this.traffic.baseLimit(this.player.s + 20, 2), this.traffic.localLimit(this.player.s + 20, 2));
    this.player.v = damp(this.player.v || MS(45), clamp(Math.min(MS(45), lim + MS(4)), MS(6), MS(45)), 1.5, dt);
    this.player.s = wrap(this.player.s + this.player.v * dt, this.track.length);
    this.player.place();
    this.player.bundle.group.visible = false;
    this.traffic.update(dt, this.player, this.events);
    this.world.update(this.player.s);
    this.ambience.update(rawDt, this.player.bundle.group.position, false);
    this.applyNight();
    this.traffic.wet = this.ambience.wet;
    this.traffic.snow = this.player.snow = this.ambience.snow;
    this.ambience.nearSeine = !!this.track.onBridge(this.player.s) || !!this.track.onBridge(this.player.s + 250) || !!this.track.onBridge(this.player.s - 150);
    if (this.ambience.hailT > 0 && !tunnel) { this.hailSndT = (this.hailSndT || 0) - rawDt; if (this.hailSndT <= 0) { this.hailSndT = 0.03 + Math.random() * 0.05; this.audio.burst?.({ dur: 0.03, freq: 3500 + Math.random() * 2500, type: 'bandpass', q: 3, gain: 0.04 + Math.random() * 0.05 }); } if (!this._hailMsg) { this._hailMsg = true; this.ui.popup('☄ AVERSE DE GRÊLE', 'fine'); } } else this._hailMsg = false;
    this.updateSmoke(rawDt);
    // caméra au ras du trafic (sous les ponts)
    const p = {};
    this.track.pointAt(this.player.s - 12, p);
    const sway = Math.sin(t * 0.12);
    camera.position.set(p.x + p.rx * (6 + sway * 2.5), p.y + 3.1 + Math.sin(t * 0.07) * 0.5, p.z + p.rz * (6 + sway * 2.5));
    const look = {};
    this.track.pointAt(this.player.s + 55, look);
    camera.lookAt(look.x, look.y + 1.4, look.z);
    camera.fov = 58;
    camera.updateProjectionMatrix();
  }
}
