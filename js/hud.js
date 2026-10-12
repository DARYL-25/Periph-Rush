// ============================================================
// Périph' Rush — HUD, menus et entrées (tactile multi-touch + clavier)
// ============================================================

import { CATALOG, PLAYER_IDS } from './vehicles.js';
import { fmtInt, fmtKm, clamp } from './utils.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(progression, audio) {
    this.prog = progression;
    this.audio = audio;
    this.input = { steer: 0, throttle: 0, brake: 0 };
    this.keys = new Set();
    this.garageIndex = 0;
    this.garageColor = 0;
    this.cb = {}; // callbacks du jeu
    this.bindButtons();
    this.bindKeyboard();
    this.refreshRadio();
  }

  on(name, fn) { this.cb[name] = fn; return this; }
  emit(name, ...a) { this.cb[name]?.(...a); }

  // ---------- écrans ------------------------------------------------------
  show(id) {
    $('porte-sheet').classList.add('hidden');
    for (const s of ['menu', 'garage', 'defis', 'reglages', 'pause', 'gameover']) {
      $(s).classList.toggle('hidden', s !== id);
    }
    $('hud').classList.toggle('hidden', id !== null);
    if (id === 'menu') this.refreshMenu();
    if (id === 'defis') this.refreshDefis();
    if (id === 'reglages') this.refreshReglages();
    if (id === 'garage') this.refreshGarage();
  }
  showHUD() { this.show(null); }

  // ---------- entrées -------------------------------------------------------
  bindButtons() {
    const hold = (id, on, off) => {
      const el = $(id);
      const set = (v, e) => {
        e.preventDefault();
        el.classList.toggle('pressed', v);
        (v ? on : off)();
      };
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(true, e); });
      el.addEventListener('pointerup', (e) => set(false, e));
      el.addEventListener('pointercancel', (e) => set(false, e));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold('btn-left', () => { this.touchL = true; this.applySteer(); }, () => { this.touchL = false; this.applySteer(); });
    hold('btn-right', () => { this.touchR = true; this.applySteer(); }, () => { this.touchR = false; this.applySteer(); });
    hold('btn-gas', () => { this.input.throttle = 1; }, () => { this.input.throttle = 0; });
    // klaxon (maintenu) et appel de phares (impulsion)
    hold('btn-horn', () => { this.input.horn = true; this.emit('horn', true); }, () => { this.input.horn = false; this.emit('horn', false); });
    hold('btn-flash', () => { this.emit('flash'); }, () => {});
    $('btn-radio').addEventListener('click', () => this.cycleRadio());
    hold('btn-brake', () => { this.input.brake = 1; }, () => { this.input.brake = 0; });
    $('btn-pause').addEventListener('click', () => this.emit('pause'));

    // menus
    const tiltGesture = () => { if (this.prog.data.settings.steerMode === 'inclinaison') { (this.tiltOn ? Promise.resolve() : this.enableTilt()).then(() => setTimeout(() => this.calibrateTilt(), 60)); } };
    $('m-play').onclick = () => { this.audio.click(); tiltGesture(); this.emit('play'); };
    $('m-garage').onclick = () => { this.audio.click(); this.emit('garage'); };
    $('m-defis').onclick = () => { this.audio.click(); this.show('defis'); };
    $('m-reglages').onclick = () => { this.audio.click(); this.show('reglages'); };
    $('g-back').onclick = () => { this.audio.click(); this.emit('garageBack'); };
    $('d-back').onclick = () => { this.audio.click(); this.show('menu'); };
    $('r-back').onclick = () => { this.audio.click(); this.show('menu'); };
    $('g-prev').onclick = () => { this.audio.click(); this.garageMove(-1); };
    $('g-next').onclick = () => { this.audio.click(); this.garageMove(1); };
    $('g-action').onclick = () => this.garageAction();
    $('p-resume').onclick = () => { this.audio.click(); tiltGesture(); this.emit('resume'); };
    $('p-restart').onclick = () => { this.audio.click(); tiltGesture(); this.emit('restart'); };
    $('p-menu').onclick = () => { this.audio.click(); this.emit('quitToMenu'); };
    $('go-retry').onclick = () => { this.audio.click(); tiltGesture(); this.emit('restart'); };
    $('go-garage').onclick = () => { this.audio.click(); this.emit('garage'); };
    $('go-menu').onclick = () => { this.audio.click(); this.emit('quitToMenu'); };

    // réglages
    $('set-audio').onchange = (e) => { this.prog.data.settings.audio = e.target.checked; this.prog.save(); this.audio.setEnabled(e.target.checked); };
    $('set-haptics').onchange = (e) => { this.prog.data.settings.haptics = e.target.checked; this.prog.save(); };
    $('set-auto').onchange = (e) => { this.prog.data.settings.autoThrottle = e.target.checked; this.prog.save(); this.emit('settings'); };
    $('set-sens').oninput = (e) => { this.prog.data.settings.sensitivity = parseFloat(e.target.value); this.prog.save(); this.emit('settings'); };
    $('set-quality').onchange = (e) => { this.prog.data.settings.quality = e.target.value; this.prog.save(); this.emit('settings'); };
    $('set-traffic').onchange = (e) => this.setTraffic(parseInt(e.target.value, 10));
    $('set-weather').onchange = (e) => { this.prog.data.settings.weather = e.target.value; this.prog.save(); this.queuePreview(); };
    $('set-hour').onchange = (e) => { this.prog.data.settings.startHour = e.target.value; this.prog.save(); this.queuePreview(); };
    $('set-camera').onchange = (e) => { this.prog.data.settings.camera = e.target.value; this.prog.save(); this.emit('camera'); };
    $('set-radio').onchange = (e) => { this.prog.data.settings.radio = e.target.value; this.prog.save(); this.refreshRadio(); this.emit('radio'); };
    $('set-mirror').onchange = (e) => { this.prog.data.settings.mirror = e.target.checked; this.prog.save(); this.emit('settings'); };
    $('set-steer').onchange = (e) => {
      this.prog.data.settings.steerMode = e.target.value; this.prog.save();
      if (e.target.value === 'inclinaison') this.enableTilt(); else this.disableTilt();
    };
    $('btn-cam').addEventListener('click', () => {
      const st = this.prog.data.settings;
      st.camera = st.camera === 'cockpit' ? 'chase' : 'cockpit';
      this.prog.save();
      this.emit('camera');
    });

    // menu : porte de départ + niveau de trafic
    $('start-prev').onclick = () => { this.audio.click(); this.stepStart(-1); };
    $('start-next').onclick = () => { this.audio.click(); this.stepStart(1); };
    $('start-open').onclick = () => { this.audio.click(); this.openPorteSheet(); };
    $('sheet-close').onclick = () => { this.audio.click(); $('porte-sheet').classList.add('hidden'); };
    $('porte-sheet').onclick = (e) => { if (e.target.id === 'porte-sheet') $('porte-sheet').classList.add('hidden'); };
    const cycle = (key, vals, ev) => () => {
      this.audio.click();
      const st = this.prog.data.settings;
      st[key] = vals[(vals.indexOf(st[key] || vals[0]) + 1) % vals.length];
      this.prog.save();
      this.refreshSetup();
      if (ev === 'preview') this.queuePreview(); else this.emit(ev);
    };
    $('pill-wx').onclick = cycle('weather', ['auto', 'soleil', 'pluie'], 'preview');
    $('pill-hour').onclick = cycle('startHour', ['auto', 'matin', 'midi', 'soir', 'nuit'], 'preview');
    $('pill-cam').onclick = cycle('camera', ['chase', 'cockpit'], 'camera');
    for (const b of document.querySelectorAll('#traffic-seg button')) {
      b.onclick = () => { this.audio.click(); this.setTraffic(parseInt(b.dataset.lv, 10)); };
    }
  }

  applySteer() {
    if (this.tiltOn) return;
    this.input.steer = (this.touchR ? 1 : 0) - (this.touchL ? 1 : 0);
  }

  // ---------- radio : stations ----------------------------------------------
  static radioKey(v) { return v === false ? 'off' : v === true || v == null ? 'info' : v; }
  cycleRadio() {
    const order = ['info', 'lounge', 'electro', 'off'];
    const st = this.prog.data.settings;
    st.radio = order[(order.indexOf(UI.radioKey(st.radio)) + 1) % order.length];
    this.prog.save();
    this.refreshRadio();
    this.emit('radio');
  }
  refreshRadio() {
    const k = UI.radioKey(this.prog.data.settings.radio);
    $('radio-name').textContent = { info: 'PÉRIPH INFO', lounge: 'NUIT LOUNGE', electro: 'ÉLECTRO PARIS', off: 'RADIO OFF' }[k];
    $('btn-radio').classList.toggle('off', k === 'off');
  }

  // ---------- direction par inclinaison du téléphone ---------------------------
  async enableTilt() {
    try {
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        const r = await DOE.requestPermission(); // iOS : doit venir d'un geste utilisateur
        if (r !== 'granted') { this.popup?.('Inclinaison refusée : direction par boutons', 'fine'); this.prog.data.settings.steerMode = 'boutons'; this.prog.save(); this.refreshReglages?.(); return; }
      }
    } catch (e) { /* ancien navigateur : pas de permission à demander */ }
    if (!this._onTilt) {
      this._onTilt = (ev) => {
        if (ev.gamma == null) return;
        const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
        let t = ev.gamma;
        if (ang === 90) t = ev.beta; else if (ang === -90 || ang === 270) t = -ev.beta; else if (ang === 180) t = -ev.gamma;
        this.tiltRaw = t;
        if (this.tiltZero == null) this.tiltZero = t;
        if (!this.tiltOn) return;
        let x = t - this.tiltZero;
        const dead = 1.2, full = 24;
        x = Math.sign(x) * Math.max(0, Math.abs(x) - dead) / (full - dead);
        x = Math.sign(x) * Math.pow(Math.min(1, Math.abs(x)), 1.35); // plus fin au centre : placement au millimètre
        this.input.steer = clamp(x, -1, 1);
      };
      window.addEventListener('deviceorientation', this._onTilt);
    }
    this.tiltOn = true;
    this.tiltZero = this.tiltRaw ?? null;
    document.body.classList.add('tilt-steer');
  }
  disableTilt() {
    this.tiltOn = false;
    this.input.steer = 0;
    document.body.classList.remove('tilt-steer');
  }
  // position « neutre » = façon dont on tient le téléphone au départ
  calibrateTilt() {
    if (!this.tiltOn) return;
    this.tiltZero = this.tiltRaw ?? null;
    const h = $('tilt-hint');
    h.classList.remove('hidden');
    clearTimeout(this._tiltHintT);
    this._tiltHintT = setTimeout(() => h.classList.add('hidden'), 2500);
  }

  bindKeyboard() {
    const upd = () => {
      const k = this.keys;
      const left = k.has('ArrowLeft') || k.has('KeyA') || k.has('KeyQ');
      const right = k.has('ArrowRight') || k.has('KeyD');
      this.input.steer = (right ? 1 : 0) - (left ? 1 : 0);
      this.input.throttle = (k.has('ArrowUp') || k.has('KeyW') || k.has('KeyZ')) ? 1 : 0;
      this.input.brake = (k.has('ArrowDown') || k.has('KeyS') || k.has('Space')) ? 1 : 0;
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') this.emit('pause');
      if (e.code === 'KeyH') this.emit('horn', true);
      if (e.code === 'KeyF') this.emit('flash');
      if (e.code === 'KeyR') this.cycleRadio();
      upd();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'KeyH') this.emit('horn', false); upd(); });
    window.addEventListener('blur', () => { this.keys.clear(); upd(); });
  }

  // ---------- HUD en jeu -----------------------------------------------------
  updateHUD(state) {
    $('speed-val').textContent = Math.round(state.kmh);
    $('speed-val').classList.toggle('over', state.kmh > 62);
    $('hud-score').textContent = fmtInt(state.score);
    $('hud-coins').textContent = `🪙 ${fmtInt(state.coins)}`;
    $('hud-lap').textContent = state.laps > 0 ? `TOUR ${state.laps + 1}` : 'TOUR 1';
    $('hud-mult').textContent = `×${state.mult.toFixed(1).replace('.', ',')}`;
    if (state.clock) {
      $('hud-time').textContent = state.clock;
      $('hud-wx').textContent = { soleil: '☀', nuit: '☾', pluie: '☂', brouillard: '≋' }[state.weather] || '☀';
    }
    if (state.permis != null) {
      $('hud-permis').textContent = `${state.permis} pts${state.fines ? ` · ${state.fines.toLocaleString('fr-FR')} €` : ''}`;
      $('hud-permis').classList.toggle('bad', state.permis < 12);
    }
    if (state.health != null) {
      const f = $('hud-health-fill');
      f.style.width = `${Math.max(0, state.health)}%`;
      f.style.background = state.health > 60 ? '#3ddc84' : state.health > 30 ? '#ffb020' : '#ff4b3e';
      $('hud-health').classList.toggle('hidden', state.health >= 100);
    }
    if (state.gps) {
      state.gps.forEach((g, i) => {
        const el = $('gps-' + i);
        if (!el) return;
        const d = g.d < 1000 ? `${Math.max(0, Math.round(g.d / 50) * 50)} m` : `${(g.d / 1000).toFixed(1).replace('.', ',')} km`;
        const key = `${g.name}|${d}`;
        if (el._k === key) return;
        el._k = key;
        el.innerHTML = `<i>${i ? 'PUIS' : 'SORTIE'}</i><b>${g.name.replace(/^Porte /, 'P<sup>te</sup> ')}</b><span>${d}</span>`;
      });
    }
    const w = $('hud-warning');
    if (state.warning) {
      w.textContent = state.warning;
      w.classList.remove('hidden');
    } else w.classList.add('hidden');
  }

  flashRadar() {
    const f = $('radar-flash');
    f.classList.remove('hidden');
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    setTimeout(() => f.classList.add('hidden'), 700);
  }

  setCameraButton(mode) { $('btn-cam').textContent = mode === 'cockpit' ? '◎' : '◉'; }

  popup(text, cls = '') {
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    $('hud-popups').appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  // ---------- menu ------------------------------------------------------------
  setTrack(track) {
    this.track = track;
    this.starts = track.startPortes();
    // contour de l'anneau pour la mini-carte
    const pts = [], p = {};
    for (let i = 0; i < 360; i++) { track.pointAt((i / 360) * track.length, p); pts.push([p.x, p.z]); }
    this.ringPts = pts;
  }

  startIndex() {
    const name = this.prog.data.settings.startPorte;
    return Math.max(0, this.starts.findIndex((o) => o.name === name));
  }
  stepStart(dir) {
    const n = this.starts.length;
    this.setStart(this.starts[(this.startIndex() + dir + n) % n].name);
  }
  setStart(name) {
    this.prog.data.settings.startPorte = name;
    this.prog.save();
    this.refreshSetup();
    this.queuePreview();
  }
  setTraffic(lv) {
    this.prog.data.settings.traffic = lv;
    this.prog.save();
    this.refreshSetup();
    this.queuePreview();
  }
  queuePreview() { // évite de reconstruire la scène à chaque appui rapide
    clearTimeout(this._prevT);
    this._prevT = setTimeout(() => this.emit('preview'), 380);
  }

  openPorteSheet() {
    const list = $('porte-list');
    list.innerHTML = '';
    const cur = this.startIndex();
    this.starts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'porte-item' + (i === cur ? ' sel' : '');
      b.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i><span>${o.name.replace(/^Porte /, 'Pte ')}</span>`;
      b.onclick = () => { this.audio.click(); $('porte-sheet').classList.add('hidden'); this.setStart(o.name); };
      list.appendChild(b);
    });
    $('porte-sheet').classList.remove('hidden');
    list.children[cur]?.scrollIntoView({ block: 'center' });
  }

  refreshSetup() {
    if (!this.starts) return;
    const set = this.prog.data.settings;
    const i = this.startIndex(), o = this.starts[i];
    $('start-name').textContent = o.name;
    const km = ((o.s - this.track.startS + this.track.length) % this.track.length) / 1000;
    $('start-sub').textContent = `${i + 1}/${this.starts.length} · ${i === 0 ? 'départ historique' : `${km.toFixed(1).replace('.', ',')} km après Maillot`}`;
    for (const b of document.querySelectorAll('#traffic-seg button')) b.classList.toggle('sel', +b.dataset.lv === set.traffic);
    $('traffic-desc').textContent = ['Ça roule, place aux chronos', 'Quelques ralentissements', 'Saturé, arrêts, motos en interfile', 'Très chargé, coups de frein, ça repart'][set.traffic] || '';
    $('set-traffic').value = String(set.traffic);
    $('pill-wx-v').textContent = { auto: 'Variable', soleil: 'Sec', pluie: 'Pluie' }[set.weather || 'auto'];
    $('pill-hour-v').textContent = { auto: 'Selon trafic', matin: 'Matin', midi: 'Midi', soir: 'Soir', nuit: 'Nuit' }[set.startHour || 'auto'];
    $('pill-cam-v').textContent = set.camera === 'cockpit' ? 'Cockpit' : 'Extérieure';
    this.drawRing(o.s);
  }

  drawRing(selS) {
    const cv = $('ring-map');
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.max(200, Math.round((r.width || 300) * dpr)), H = Math.max(80, Math.round((r.height || 132) * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const pts = this.ringPts;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const pad = 12 * dpr;
    const k = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
    const ox = W / 2 - ((x0 + x1) / 2) * k, oy = H / 2 - ((z0 + z1) / 2) * k;
    const P = (x, z) => [ox + x * k, oy + z * k];
    ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach(([x, z], i) => ctx[i ? 'lineTo' : 'moveTo'](...P(x, z))); ctx.closePath(); };
    path(); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 9 * dpr; ctx.stroke();
    path(); ctx.strokeStyle = 'rgba(255,209,43,0.75)'; ctx.lineWidth = 2.2 * dpr; ctx.stroke();
    // trafic : teinte de l'anneau
    const col = ['#3ddc84', '#ffb020', '#ff4b3e', '#ff8a3d'][this.prog.data.settings.traffic] || '#ffb020';
    path(); ctx.strokeStyle = col; ctx.globalAlpha = 0.28; ctx.lineWidth = 5 * dpr; ctx.stroke(); ctx.globalAlpha = 1;
    // portes
    const p = {};
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const o of this.starts) {
      this.track.pointAt(o.s, p);
      const [x, y] = P(p.x, p.z);
      ctx.beginPath(); ctx.arc(x, y, 1.8 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    // départ choisi + sens de circulation
    this.track.pointAt(selS, p);
    const [sx, sy] = P(p.x, p.z);
    const q = {};
    this.track.pointAt(selS + 400, q);
    const [qx, qy] = P(q.x, q.z);
    const a = Math.atan2(qy - sy, qx - sx);
    ctx.fillStyle = 'rgba(255,209,43,0.25)';
    ctx.beginPath(); ctx.arc(sx, sy, 11 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd12b'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.arc(sx, sy, 5.5 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(18 * dpr, 0); ctx.lineTo(10 * dpr, -5 * dpr); ctx.lineTo(10 * dpr, 5 * dpr); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `700 ${10 * dpr}px -apple-system, sans-serif`;
    ctx.fillText('PARIS', W / 2 - 15 * dpr, H / 2 + 4 * dpr);
  }

  refreshMenu() {
    const d = this.prog.data;
    $('menu-coins').textContent = fmtInt(d.coins);
    $('menu-records').innerHTML =
      `<div class="rec best"><small>Record</small><b>${fmtInt(d.bestScore)}</b></div>` +
      `<div class="rec"><small>Distance max</small><b>${fmtKm(d.bestDistance)}</b></div>` +
      `<div class="rec"><small>Tours bouclés</small><b>${d.totalLaps}</b></div>`;
    $('tile-car').textContent = CATALOG[d.selected]?.name || '';
    const ch = d.challenges?.list || [];
    $('tile-defis').textContent = `${ch.filter((c) => c.done).length}/${ch.length} réussis aujourd’hui`;
    this.refreshSetup();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    $('menu-hint').style.display = standalone ? 'none' : '';
  }

  refreshDefis() {
    const d = this.prog.data;
    const list = $('defis-list');
    list.innerHTML = '';
    for (const ch of d.challenges.list) {
      const div = document.createElement('div');
      div.className = 'defi' + (ch.done ? ' done' : '');
      const prog = ch.done ? '✔' : `${Math.min(ch.progress, ch.goal).toFixed(ch.id === 'dist' ? 1 : 0)}/${ch.goal}`;
      div.innerHTML = `<span>${this.prog.challengeLabel(ch)}<br><small style="opacity:.6">${prog}</small></span>
        <span class="reward">+${ch.reward} 🪙</span>`;
      list.appendChild(div);
    }
    $('stats-globales').innerHTML =
      `<div class="defi"><span>Manches jouées</span><b>${d.runs}</b></div>` +
      `<div class="defi"><span>Kilométrage total</span><b>${d.totalKm.toFixed(1)} km</b></div>` +
      `<div class="defi"><span>Tours du périph cumulés</span><b>${d.totalLaps}</b></div>` +
      `<div class="defi"><span>Meilleur combo</span><b>×${d.bestCombo}</b></div>`;
  }

  refreshReglages() {
    const s = this.prog.data.settings;
    $('set-audio').checked = s.audio;
    $('set-haptics').checked = s.haptics;
    $('set-auto').checked = s.autoThrottle;
    $('set-sens').value = s.sensitivity;
    $('set-quality').value = s.quality;
    $('set-traffic').value = String(s.traffic ?? 1);
    $('set-weather').value = s.weather || 'auto';
    $('set-hour').value = s.startHour || 'auto';
    $('set-camera').value = s.camera || 'chase';
    $('set-radio').value = UI.radioKey(s.radio);
    $('set-mirror').checked = !!s.mirror;
    $('set-steer').value = s.steerMode || 'boutons';
  }

  // ---------- garage -------------------------------------------------------------
  refreshGarage() {
    const id = PLAYER_IDS[this.garageIndex];
    const m = CATALOG[id];
    const st = this.prog.carState(id);
    $('g-coins').textContent = `🪙 ${fmtInt(this.prog.data.coins)}`;
    $('g-name').textContent = m.name;
    $('st-vmax').style.width = `${clamp((m.perf.vmax - 130) / 120, 0.08, 1) * 100}%`;
    $('st-acc').style.width = `${m.perf.acc * 100}%`;
    $('st-man').style.width = `${m.perf.man * 100}%`;
    $('st-frein').style.width = `${m.perf.frein * 100}%`;
    // pastilles couleurs
    const cols = $('g-colors');
    cols.innerHTML = '';
    const saved = this.prog.data.colors[id] ?? 0;
    this.garageColor = Math.min(this.garageColor, m.cols.length - 1);
    m.cols.forEach((hex, i) => {
      const dot = document.createElement('button');
      dot.className = 'color-dot' + (i === (st.owned ? this.garageColor : saved) ? ' sel' : '');
      dot.style.background = '#' + hex.toString(16).padStart(6, '0');
      dot.onclick = () => { this.garageColor = i; this.emit('garageColor', id, i); this.refreshGarage(); };
      cols.appendChild(dot);
    });
    const action = $('g-action');
    if (st.owned) {
      const isSel = this.prog.data.selected === id;
      $('g-status').textContent = isSel ? 'Sélectionnée' : '';
      action.textContent = isSel ? '✔ SÉLECTIONNÉE' : 'CHOISIR';
      action.disabled = false;
    } else if (st.canBuy) {
      $('g-status').textContent = `Prix : ${fmtInt(st.price)} 🪙`;
      action.textContent = `ACHETER · ${fmtInt(st.price)} 🪙`;
      action.disabled = false;
    } else {
      $('g-status').textContent = `🔒 ${st.lockText}`;
      action.textContent = 'VERROUILLÉE';
      action.disabled = true;
    }
  }

  garageMove(dir) {
    this.garageIndex = (this.garageIndex + dir + PLAYER_IDS.length) % PLAYER_IDS.length;
    const id = PLAYER_IDS[this.garageIndex];
    this.garageColor = this.prog.data.colors[id] ?? 0;
    this.emit('garageCar', id, this.garageColor);
    this.refreshGarage();
  }

  garageAction() {
    const id = PLAYER_IDS[this.garageIndex];
    const st = this.prog.carState(id);
    if (st.owned) {
      this.prog.select(id, this.garageColor);
      this.audio.coin();
    } else if (st.canBuy && this.prog.buy(id)) {
      this.audio.coin();
      this.prog.select(id, this.garageColor);
    }
    this.refreshGarage();
  }

  currentGarageCar() { return PLAYER_IDS[this.garageIndex]; }

  // ---------- fin de partie ---------------------------------------------------------
  showGameOver(result, severity, damageText, extras, customTitle = null) {
    const title = $('go-title');
    title.textContent = customTitle || (severity < 0.35 ? 'ACCROCHAGE !' : severity < 0.7 ? 'ACCIDENT !' : 'GROS ACCIDENT !');
    title.classList.toggle('small-hit', severity < 0.35);
    $('go-damage').textContent = damageText;
    $('go-score').textContent = fmtInt(result.points);
    $('go-dist').textContent = fmtKm(result.distance);
    $('go-laps').textContent = result.laps;
    $('go-near').textContent = result.nearMisses;
    $('go-combo').textContent = '×' + result.bestCombo;
    $('go-coins').textContent = '+' + fmtInt(result.coins);
    let extra = '';
    for (const r of extras.rewards) extra += `🏁 Défi réussi : ${r.label} (+${r.reward} 🪙)<br>`;
    for (const id of extras.unlocked) extra += `🔓 Nouveau véhicule débloqué : ${CATALOG[id].name} !<br>`;
    $('go-extra').innerHTML = extra;
    this.show('gameover');
  }

  loading(pct, txt) {
    $('loading-fill').style.width = `${pct}%`;
    if (txt) $('loading-txt').textContent = txt;
    if (pct >= 100) $('loading').style.display = 'none';
  }

  haptic(pattern) {
    if (this.prog.data.settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
  }

  flashCrack(severity) {
    if (severity > 0.45) {
      $('crack').classList.remove('hidden');
      setTimeout(() => $('crack').classList.add('hidden'), 2400);
    }
    const f = $('flash');
    f.classList.remove('hidden');
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    setTimeout(() => f.classList.add('hidden'), 600);
  }
}
