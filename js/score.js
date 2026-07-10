// ============================================================
// Périph' Rush — score d'une manche
// Distance, frôlements (combo), tours, excès de vitesse maîtrisé,
// conduite propre (multiplicateur), conversion en pièces.
// ============================================================

import { CFG, MS } from './config.js';
import { clamp } from './utils.js';

export class Score {
  constructor() { this.reset(); }

  reset() {
    this.points = 0;
    this.nearMisses = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.cleanTime = 0;      // temps sans freinage brusque ni mur
    this.cleanDistance = 0;
    this.lapBonuses = 0;
    this.coins = 0;
    this.speedBonusPts = 0;
  }

  get multiplier() { return 1 + Math.min(1, this.cleanTime / 75); }

  update(dt, player) {
    const ds = player.v * dt;
    const speedBonus = player.v > MS(65) ? 0.5 : 0;
    this.points += ds * CFG.SCORE_PER_METER * this.multiplier * (1 + speedBonus);
    if (speedBonus) this.speedBonusPts += ds * speedBonus;
    this.cleanTime += dt;
    this.cleanDistance += ds;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  dirty() { // freinage brusque / frottement de mur
    this.cleanTime = Math.max(0, this.cleanTime - 18);
    this.cleanDistance = 0;
  }

  nearMiss() {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 4;
    this.nearMisses++;
    const pts = CFG.NEAR_MISS_SCORE * Math.min(this.combo, 10);
    this.points += pts;
    this.coins += CFG.COIN_PER_NEARMISS;
    return { pts, combo: this.combo };
  }

  lap() {
    this.points += CFG.LAP_SCORE;
    this.lapBonuses++;
    this.coins += CFG.COIN_PER_LAP;
  }

  finalize(player) {
    this.coins += Math.round((player.distance / 1000) * CFG.COIN_PER_KM);
    return {
      points: Math.round(this.points),
      distance: player.distance,
      laps: player.laps,
      nearMisses: this.nearMisses,
      bestCombo: this.bestCombo,
      coins: this.coins,
      overspeed: player.overspeedTime,
    };
  }
}
