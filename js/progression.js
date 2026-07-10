// ============================================================
// Périph' Rush — progression persistante (localStorage)
// Pièces, déblocages, records, défis quotidiens, réglages.
// Aucun achat réel : tout se gagne en jouant.
// ============================================================

import { CATALOG, PLAYER_IDS } from './vehicles.js';
import { rng, hashStr, todayKey } from './utils.js';

const KEY = 'periph-rush-save-v1';

const DEFAULT = {
  coins: 0,
  totalKm: 0, totalLaps: 0, runs: 0,
  bestScore: 0, bestDistance: 0, bestLaps: 0, bestCombo: 0,
  unlocked: ['clio3'],
  purchased: [],
  selected: 'clio3',
  colors: {},
  challenges: null,
  settings: { audio: true, haptics: true, autoThrottle: false, sensitivity: 1.0, quality: 'auto' },
};

const CHALLENGE_POOL = [
  { id: 'dist', label: (g) => `Parcourir ${g} km en une manche`, goals: [6, 9, 12, 18], reward: 220, stat: (r) => r.distance / 1000 },
  { id: 'near', label: (g) => `Réussir ${g} frôlements en une manche`, goals: [8, 14, 22, 30], reward: 260, stat: (r) => r.nearMisses },
  { id: 'lap', label: (g) => `Boucler ${g} tour(s) du périph`, goals: [1, 1, 2], reward: 420, stat: (r) => r.laps },
  { id: 'combo', label: (g) => `Atteindre un combo de ${g} frôlements`, goals: [3, 5, 8], reward: 300, stat: (r) => r.bestCombo },
  { id: 'over', label: (g) => `Rouler ${g} s au-dessus de 60 km/h`, goals: [45, 90, 150], reward: 240, stat: (r) => r.overspeed },
];

export class Progression {
  constructor() {
    this.data = this.load();
    this.ensureChallenges();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return { ...structuredClone(DEFAULT), ...d, settings: { ...DEFAULT.settings, ...(d.settings || {}) } };
      }
    } catch (e) { /* sauvegarde corrompue → repartir proprement */ }
    return structuredClone(DEFAULT);
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* stockage plein */ }
  }

  // ---------- défis quotidiens (générés depuis la date) ----------------
  ensureChallenges() {
    const today = todayKey();
    if (this.data.challenges?.date === today) return;
    const rand = rng(hashStr('periph' + today));
    const pool = [...CHALLENGE_POOL];
    const list = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = (rand() * pool.length) | 0;
      const c = pool.splice(idx, 1)[0];
      const goal = c.goals[(rand() * c.goals.length) | 0];
      list.push({ id: c.id, goal, reward: c.reward, done: false, claimed: false, progress: 0 });
    }
    this.data.challenges = { date: today, list };
    this.save();
  }

  challengeLabel(ch) {
    const def = CHALLENGE_POOL.find((c) => c.id === ch.id);
    return def ? def.label(ch.goal) : '';
  }

  // ---------- fin de manche ------------------------------------------------
  applyRun(result) {
    const d = this.data;
    d.coins += result.coins;
    d.totalKm += result.distance / 1000;
    d.totalLaps += result.laps;
    d.runs++;
    d.bestScore = Math.max(d.bestScore, result.points);
    d.bestDistance = Math.max(d.bestDistance, result.distance);
    d.bestLaps = Math.max(d.bestLaps, result.laps);
    d.bestCombo = Math.max(d.bestCombo, result.bestCombo);
    // défis
    const rewards = [];
    for (const ch of d.challenges.list) {
      if (ch.done) continue;
      const def = CHALLENGE_POOL.find((c) => c.id === ch.id);
      const v = def.stat(result);
      ch.progress = Math.max(ch.progress, v);
      if (v >= ch.goal) {
        ch.done = true;
        d.coins += ch.reward;
        rewards.push({ label: this.challengeLabel(ch), reward: ch.reward });
      }
    }
    // déblocages automatiques (km / tours cumulés)
    const unlocked = [];
    for (const id of PLAYER_IDS) {
      if (d.unlocked.includes(id)) continue;
      const u = CATALOG[id].unlock;
      if (!u) continue;
      if (u.km && !u.coins && d.totalKm >= u.km) { d.unlocked.push(id); unlocked.push(id); }
    }
    this.save();
    return { rewards, unlocked };
  }

  // ---------- garage ---------------------------------------------------------
  carState(id) {
    const d = this.data;
    const u = CATALOG[id].unlock || {};
    if (d.unlocked.includes(id)) return { owned: true };
    const needLaps = u.laps && d.totalLaps < u.laps;
    const needKm = u.km && !u.coins && d.totalKm < u.km;
    const price = u.coins || 0;
    return {
      owned: false,
      price,
      canBuy: price > 0 && !needLaps && d.coins >= price,
      lockText: needLaps ? `${u.laps} tours cumulés requis (${d.totalLaps})`
        : needKm ? `${u.km} km cumulés requis (${d.totalKm.toFixed(0)} km)`
          : price ? `${price} pièces` : '',
    };
  }

  buy(id) {
    const st = this.carState(id);
    if (!st.canBuy) return false;
    this.data.coins -= st.price;
    this.data.unlocked.push(id);
    this.data.purchased.push(id);
    this.save();
    return true;
  }

  select(id, colorIdx) {
    if (!this.data.unlocked.includes(id)) return;
    this.data.selected = id;
    if (colorIdx !== undefined) this.data.colors[id] = colorIdx;
    this.save();
  }

  selectedColor(id) {
    const idx = this.data.colors[id] ?? 0;
    return CATALOG[id].cols[idx % CATALOG[id].cols.length];
  }
}
