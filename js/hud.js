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
  }

  on(name, fn) { this.cb[name] = fn; return this; }
  emit(name, ...a) { this.cb[name]?.(...a); }

  // ---------- écrans ------------------------------------------------------
  show(id) {
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
    hold('btn-brake', () => { this.input.brake = 1; }, () => { this.input.brake = 0; });
    $('btn-pause').addEventListener('click', () => this.emit('pause'));

    // menus
    $('m-play').onclick = () => { this.audio.click(); this.emit('play'); };
    $('m-garage').onclick = () => { this.audio.click(); this.emit('garage'); };
    $('m-defis').onclick = () => { this.audio.click(); this.show('defis'); };
    $('m-reglages').onclick = () => { this.audio.click(); this.show('reglages'); };
    $('g-back').onclick = () => { this.audio.click(); this.emit('garageBack'); };
    $('d-back').onclick = () => { this.audio.click(); this.show('menu'); };
    $('r-back').onclick = () => { this.audio.click(); this.show('menu'); };
    $('g-prev').onclick = () => { this.audio.click(); this.garageMove(-1); };
    $('g-next').onclick = () => { this.audio.click(); this.garageMove(1); };
    $('g-action').onclick = () => this.garageAction();
    $('p-resume').onclick = () => { this.audio.click(); this.emit('resume'); };
    $('p-restart').onclick = () => { this.audio.click(); this.emit('restart'); };
    $('p-menu').onclick = () => { this.audio.click(); this.emit('quitToMenu'); };
    $('go-retry').onclick = () => { this.audio.click(); this.emit('restart'); };
    $('go-garage').onclick = () => { this.audio.click(); this.emit('garage'); };
    $('go-menu').onclick = () => { this.audio.click(); this.emit('quitToMenu'); };

    // réglages
    $('set-audio').onchange = (e) => { this.prog.data.settings.audio = e.target.checked; this.prog.save(); this.audio.setEnabled(e.target.checked); };
    $('set-haptics').onchange = (e) => { this.prog.data.settings.haptics = e.target.checked; this.prog.save(); };
    $('set-auto').onchange = (e) => { this.prog.data.settings.autoThrottle = e.target.checked; this.prog.save(); this.emit('settings'); };
    $('set-sens').oninput = (e) => { this.prog.data.settings.sensitivity = parseFloat(e.target.value); this.prog.save(); this.emit('settings'); };
    $('set-quality').onchange = (e) => { this.prog.data.settings.quality = e.target.value; this.prog.save(); this.emit('settings'); };
  }

  applySteer() {
    this.input.steer = (this.touchR ? 1 : 0) - (this.touchL ? 1 : 0);
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
      upd();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); upd(); });
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
    if (state.porte) {
      $('hud-porte').textContent = `${state.porte.name} · ${Math.max(0, Math.round(state.porteDist / 10) * 10)} m`;
    }
    const w = $('hud-warning');
    if (state.warning) {
      w.textContent = state.warning;
      w.classList.remove('hidden');
    } else w.classList.add('hidden');
  }

  popup(text, cls = '') {
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    $('hud-popups').appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  // ---------- menu ------------------------------------------------------------
  refreshMenu() {
    const d = this.prog.data;
    $('menu-records').innerHTML =
      `Record : <b>${fmtInt(d.bestScore)}</b> pts · ${fmtKm(d.bestDistance)} · ${d.bestLaps} tour(s)<br>` +
      `Total : ${d.totalKm.toFixed(0)} km · ${d.totalLaps} tours · 🪙 ${fmtInt(d.coins)}`;
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
  showGameOver(result, severity, damageText, extras) {
    const title = $('go-title');
    title.textContent = severity < 0.35 ? 'ACCROCHAGE !' : severity < 0.7 ? 'ACCIDENT !' : 'GROS ACCIDENT !';
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
