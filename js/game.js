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
import { Cockpit } from './cockpit.js';

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
    const set = this.ui.prog.data.settings;
    this.traffic.level = set.traffic ?? 1;
    this.world.trafficLevel = this.traffic.level;
    const LV = TRAFFIC_LEVELS[this.traffic.level];
    this.player.reset(carId, this.track.startFor(set.startPorte), color);
    this.rules.reset(this.traffic.level);
    this.hitCooldown = 0;
    this.radioT = 20;
    this.player.v = MS(LV.startV);
    this.player.bundle.group.visible = true;
    this.player.autoThrottle = this.ui.prog.data.settings.autoThrottle;
    this.player.input = this.ui.input;
    this.traffic.reset(this.player.s);
    this.ambIndex = 0;
    this.ambience.startDay(this.startHour(set), set.weather || 'auto');
    this._night = null;
    this.applyNight();
    this.world.prebuild(this.player.s);
    this.ui.showHUD();
    this.world.setVMSAhead(this.player.s, [['PERIPH FLUIDE', 'BONNE ROUTE'], ['TRAFIC DENSE', 'RALENTISSEMENTS'], ['PERIPH SATURE', 'BOUCHONS · PRUDENCE']][this.traffic.level]);
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
    return [12 + Math.random() * 3, 17.1 + Math.random() * 0.6, 7.9 + Math.random() * 0.5][this.traffic.level] ?? 14;
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
    this.events.update(dt, this.player, this.traffic);
    this.world.update(this.player.s);
    const tunnel = this.track.inTunnel(this.player.s);
    this.ambience.update(rawDt, this.player.bundle.group.position, !!tunnel);
    this.applyNight();
    this.traffic.wet = this.ambience.wet;
    this.player.wet = this.ambience.wet;
    this.world.wetLevel = this.ambience.wet;
    this.traffic.dayFactor = this.dayFactor(this.ambience.hour ?? 14);
    this.updateSmoke(rawDt);
    if (!this.cockpit) { this.cockpit = new Cockpit(this.T, this.scene, camera, this.player, this.track); this.applyCamera(); }
    this.cockpit.rain = this.ambience.rainAmt;
    if (this.cockpit.active) this.cockpit.updateCamera(camera, rawDt);
    else this.player.updateCamera(camera, rawDt);

    if (this.state === 'running') {
      this.checkNearMisses();
      this.checkCollisions();
      this.updateHUD();
      this.audio.setEnv({ tunnel: !!tunnel, wet: this.ambience.wet, cockpit: !!this.cockpit?.active });
      this.audio.engine(this.player.v, this.player.vmax, Math.max(this.player.input.throttle, this.player.autoThrottle ? 0.6 : 0), rawDt);
      this.audio.rain(tunnel ? 0 : this.ambience.cur.rain);
      this.updateSounds(rawDt);
      this.hornCooldown -= rawDt;
      this.hitCooldown = Math.max(0, (this.hitCooldown || 0) - dt);
    }
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
    } else if (this.rules.warning) {
      warning = this.rules.warning;
    } else if (ev) {
      const side = ev.lanes.includes(0) ? 'GAUCHE' : 'DROITE';
      warning = `⚠ ${ev.type === 'travaux' ? 'TRAVAUX' : 'ACCIDENT'} ${Math.round(ev.dist / 10) * 10} m · VOIE ${side}`;
    } else {
      const jam = this.traffic.jamAhead(p.s);
      if (this.traffic.motoBehindPlayer) warning = '🏍 UNE MOTO VEUT PASSER — SERREZ À DROITE';
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
      weather: this.ambience.rainAmt > 0.15 ? 'pluie' : (this.ambience.fogAmt > 0.3 ? 'brouillard' : (this.ambience.elevation < 0 ? 'nuit' : 'soleil')),
      health: p.health,
      permis: this.rules.points,
      fines: this.rules.fines,
      gps: this.gpsInfo(),
    });
  }

  // ---------- sons du trafic, sirènes, joints de viaduc, radio ----------
  updateSounds(dt) {
    const p = this.player, L = this.track.length, a = this.audio;
    for (const e of this.traffic.sfx) {
      if (!e.s) continue;
      const ds = loopDelta(e.s, p.s, L), dl = e.lat - p.lat;
      const dist = Math.hypot(ds, dl);
      if (dist < 140) a.hornAt(e.type, clamp(dl / 8, -1, 1) * (this.cockpit?.active ? 1 : 0.7), dist + (e.far ? 15 : 0));
    }
    // sirène la plus proche (Doppler : approche = plus aigu)
    let best = null, bd = 1e9;
    for (const n of this.traffic.npcs) {
      if (n.mode !== 'emerg') continue;
      const ds = loopDelta(n.s, p.s, L);
      const d = Math.hypot(ds, n.lat - p.lat);
      if (d < bd) { bd = d; best = { n, ds }; }
    }
    if (best && bd < 320) {
      const vr = best.ds < 0 ? best.n.v - p.v : p.v - best.n.v; // vitesse de rapprochement
      const dop = 343 / (343 - clamp(vr, -60, 60));
      a.siren(0.16 * Math.pow(1 - bd / 320, 1.6), dop, clamp((best.n.lat - p.lat) / 8, -1, 1), dt);
    } else a.siren(0, 1, 0, dt);
    // joints de dilatation sur les viaducs
    if (this.track.onViaduct(p.s)) {
      const k = Math.floor(p.s / 33);
      if (this._joint !== undefined && k !== this._joint && p.v > 3) a.thump();
      this._joint = k;
    } else this._joint = undefined;
    // radio info-trafic
    if (this.ui.prog.data.settings.radio !== false) {
      this.radioT = (this.radioT ?? 22) - dt;
      if (this.radioT <= 0) { this.radioT = 140 + Math.random() * 60; a.radio(this.radioText()); }
    }
  }

  radioText() {
    const t = this.track, L = t.length, amb = this.ambience;
    const h = Math.floor(amb.hour), m = Math.floor((amb.hour - h) * 60);
    const short = (n) => n || 'la porte suivante';
    const lines = [`Périph Info, il est ${h} heures${m ? ' ' + m : ''}.`];
    const lv = this.traffic.level;
    const jam = this.traffic.jams[0];
    if (jam) {
      const a = t.nextPorte(wrap(jam.s - jam.len / 2 - 200, L)).porte?.name;
      const b = t.nextPorte(wrap(jam.s + jam.len / 2, L)).porte?.name;
      const km = Math.max(1, Math.round((jam.len + (lv === 2 ? 1500 : 0)) / 1000));
      lines.push(`Sur le périphérique intérieur, ${lv === 2 ? 'bouchon' : 'ralentissement'} de ${km} kilomètre${km > 1 ? 's' : ''} entre ${short(a)} et ${short(b)}.`);
    } else lines.push(['Le trafic est fluide sur l’ensemble du périphérique intérieur.', 'Circulation dense mais sans difficulté majeure sur le périphérique intérieur.', 'Le périphérique est saturé sur la quasi-totalité de l’anneau.'][lv]);
    const ev = this.events.active?.[0];
    if (ev) lines.push(`${ev.type === 'travaux' ? 'Des travaux' : 'Un accident'} neutralise${ev.type === 'travaux' ? 'nt' : ''} une voie à hauteur de ${short(t.nextPorte(ev.s0).porte?.name)}.`);
    if (lv === 2) lines.push('Rappel : la voie de gauche est réservée au covoiturage, aux taxis et aux bus.');
    if (amb.rainAmt > 0.3) lines.push('Il pleut sur Paris, chaussée glissante : augmentez vos distances de sécurité.');
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
        this.player.camShake = Math.min(this.player.camShake + 0.05, 0.14);
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
    p.camShake = 0.18 + sev * 0.3;
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
    this.player.camShake = 0.25 + severity * 0.5;
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
  withFines(result) { result.fines = this.rules.fines; result.permis = this.rules.points; return result; }
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
