// ============================================================
// Périph' Rush — orchestration d'une manche
// Collisions (véhicules, balisage, glissières), frôlements avec
// combo, séquence de crash (ralenti + déformation + fumée),
// montée en difficulté par tour, PMV et annonces HUD.
// ============================================================

import { CFG, MS, KMH } from './config.js';
import { clamp, lerp, loopDelta, wrap } from './utils.js';
import { LAP_SEQUENCE } from './weather.js';

export class Game {
  constructor({ THREE, scene, track, world, traffic, events, player, ambience, score, ui, audio }) {
    Object.assign(this, { T: THREE, scene, track, world, traffic, events, player, ambience, score, ui, audio });
    this.state = 'idle';
    this.timescale = 1;
    this.slowmoT = 0;
    this.hornCooldown = 0;
    this.smoke = this.makeSmoke();
    this.result = null;
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
    this.player.reset(carId, this.track.startS, color);
    this.player.bundle.group.visible = true;
    this.player.autoThrottle = this.ui.prog.data.settings.autoThrottle;
    this.player.input = this.ui.input;
    this.traffic.reset(this.player.s);
    this.ambIndex = 0;
    this.ambience.setPreset(LAP_SEQUENCE[0], 0);
    this.applyNight();
    this.world.prebuild(this.player.s);
    this.ui.showHUD();
    this.world.setVMSAhead(this.player.s, ['PERIPH FLUIDE', 'PRUDENCE']);
  }

  onLap(lap) {
    this.score.lap();
    this.traffic.lap = lap;
    this.events.lapBoost = 1 + lap * CFG.LAP_EVENT_GAIN;
    this.ambIndex = lap % LAP_SEQUENCE.length;
    this.ambience.setPreset(LAP_SEQUENCE[this.ambIndex], 24);
    this.ui.popup(`TOUR ${lap} BOUCLÉ  +${CFG.LAP_SCORE.toLocaleString('fr-FR')}`, '');
    this.ui.popup('La circulation se densifie…', 'combo');
    this.ui.haptic([30, 40, 30]);
    this.audio.coin();
    setTimeout(() => this.applyNight(), 24000);
  }

  applyNight() {
    const night = this.ambience.headlightsOn;
    this.player.setHeadlights(night);
    this.player.factory.setNight(night); // lentilles émissives de tout le parc
    this.traffic.setNightGlows(night);
  }

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
      this.score.update(dt, this.player);
      if (this.player.input.brake > 0.6 && this.player.v > MS(40)) this.score.dirty();
    }
    this.traffic.update(dt, this.player, this.events);
    this.events.update(dt, this.player, this.traffic);
    this.world.update(this.player.s);
    const tunnel = this.track.inTunnel(this.player.s);
    this.ambience.update(rawDt, this.player.bundle.group.position, !!tunnel);
    this.updateSmoke(rawDt);
    this.player.updateCamera(camera, rawDt);

    if (this.state === 'running') {
      this.checkNearMisses();
      this.checkCollisions();
      this.updateHUD();
      this.audio.engine(this.player.v, this.player.vmax, Math.max(this.player.input.throttle, this.player.autoThrottle ? 0.6 : 0));
      this.audio.rain(this.ambience.cur.rain);
      this.hornCooldown -= rawDt;
    }
  }

  // ---------- HUD -------------------------------------------------------------------
  updateHUD() {
    const p = this.player;
    const next = this.track.nextPorte(p.s);
    let warning = null;
    const ev = this.events.warningAhead(p.s);
    if (ev) {
      const side = ev.lanes.includes(0) ? 'GAUCHE' : 'DROITE';
      warning = `⚠ ${ev.type === 'travaux' ? 'TRAVAUX' : 'ACCIDENT'} ${Math.round(ev.dist / 10) * 10} m · VOIE ${side}`;
    } else {
      const jam = this.traffic.jamAhead(p.s);
      if (jam && jam.dist < 700) warning = `⚠ RALENTISSEMENT ${Math.round(jam.dist / 100) * 100} m`;
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
    });
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
      return this.crash(sev, p.wallContact > 0 ? 'barrier-right' : 'barrier-left', null);
    }
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
        return this.crash(sev, frontal ? 'front' : 'side', n);
      }
    }
    // balisage / véhicules arrêtés des événements
    for (const o of this.events.obstacles()) {
      const d = loopDelta(o.s, p.s, L);
      if (Math.abs(d) > (o.len + p.len) / 2) continue;
      const latGap = Math.abs(o.lat - p.lat) - (o.wid + p.wid) / 2;
      if (latGap < -0.02) {
        const sev = o.cone ? clamp(p.v / 28, 0.1, 0.5) : clamp(p.v / 16, 0.3, 1);
        return this.crash(sev, o.cone ? 'cone' : 'front', null);
      }
    }
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

  finishCrash() {
    this.state = 'over';
    this.timescale = 1;
    const result = this.score.finalize(this.player);
    const extras = this.ui.prog.applyRun(result);
    const damage = this.damageText(this.crashSeverity, this.crashKind);
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
  attractUpdate(rawDt, camera, t) {
    const dt = Math.min(rawDt, 0.05);
    // fait rouler doucement le "joueur fantôme" pour suivre le flux
    this.player.v = MS(45);
    this.player.s = wrap(this.player.s + this.player.v * dt, this.track.length);
    this.player.place();
    this.player.bundle.group.visible = false;
    this.traffic.update(dt, this.player, this.events);
    this.world.update(this.player.s);
    this.ambience.update(rawDt, this.player.bundle.group.position, false);
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
