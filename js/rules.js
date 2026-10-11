// ============================================================
// Périph' Rush — code de la route (v16)
// Radars fixes aux emplacements réels du sens intérieur (flash,
// amende, retrait de points selon le barème français), radars de
// voie réservée en heure de pointe, refus de céder le passage aux
// secours, solde de points du permis (12 au départ).
// ============================================================

import { CFG, MS, interfileCenter } from './config.js';
import { wrap, loopDelta } from './utils.js';

// barème : excès retenu (km/h, limite ≤ 50) → [amende €, points]
function bareme(excess) {
  if (excess < 20) return [135, 1];
  if (excess < 30) return [135, 2];
  if (excess < 40) return [135, 3];
  if (excess < 50) return [135, 4];
  return [1500, 6];
}

export class Rules {
  constructor(track, world, ui, audio, score) {
    Object.assign(this, { track, world, ui, audio, score });
    this.reset(1);
  }

  reset(level) {
    this.level = level;
    this.points = 12;
    this.fines = 0;
    this.tickets = [];
    this.lastS = null;
    this.hovT = 0;
    this.blockT = 0;
    this.blockedEmerg = null;
    this.flagged = new Set();
  }

  ticket(label, euros, pts) {
    this.fines += euros;
    this.points = Math.max(0, this.points - pts);
    this.tickets.push({ label, euros, pts });
    this.score.penalty?.(euros * 6);
    this.ui.popup(`${label} · ${euros} €${pts ? ` · −${pts} pt${pts > 1 ? 's' : ''}` : ''}`, 'fine');
    this.ui.haptic([20, 30, 20]);
  }

  // à appeler à chaque image pendant la course ; renvoie 'permis' si plus de points
  update(dt, player, traffic) {
    const L = this.track.length;
    const s = player.s;
    const radars = this.world.radars || [];
    const inLeft = player.lat < CFG.INNER_EDGE + CFG.LANE_WIDTH && !player.ramp;
    if (this.lastS != null) {
      for (const r of radars) {
        const a = loopDelta(this.lastS, r.s, L), b = loopDelta(s, r.s, L);
        if (!(a < 0 && b >= 0)) continue;
        if (r.kind === 'speed') {
          const kmh = player.v * 3.6;
          const retenue = kmh - 5; // marge technique de 5 km/h sous 100 km/h
          if (retenue > CFG.SPEED_LIMIT_KMH) {
            const [eur, pts] = bareme(retenue - CFG.SPEED_LIMIT_KMH);
            this.ui.flashRadar?.();
            this.audio.flash?.();
            this.ticket(`📸 FLASHÉ À ${Math.round(kmh)} km/h`, eur, pts);
          }
        } else if (r.kind === 'hov' && traffic.reserved && inLeft) {
          this.ui.flashRadar?.();
          this.ticket('📸 VOIE RÉSERVÉE', 135, 0);
        }
      }
    }
    this.lastS = s;

    // voie réservée (heure de pointe) : rappel à l'ordre
    if (traffic.reserved && inLeft) this.hovT += dt; else this.hovT = 0;

    // secours derrière : laisser le corridor libre (entre voie 1 et voie 2)
    const eb = traffic.emergBehindPlayer;
    this.emergWarn = null;
    if (eb) {
      const corridor = interfileCenter(0);
      const blocking = Math.abs(player.lat - corridor) < (player.wid + eb.npc.wid) / 2 + 0.1;
      this.emergWarn = { dist: eb.dist, blocking };
      if (blocking && eb.dist < 35) this.blockT += dt; else this.blockT = Math.max(0, this.blockT - dt * 0.5);
      if (this.blockT > 4 && !this.flagged.has(eb.npc)) {
        this.flagged.add(eb.npc);
        this.ticket('🚨 REFUS DE CÉDER LE PASSAGE', 135, 4);
      }
    } else this.blockT = 0;

    return this.points <= 0 ? 'permis' : null;
  }

  get warning() {
    if (this.emergWarn) return this.emergWarn.blocking ? '🚨 SECOURS — SERREZ-VOUS, LIBÉREZ LE CORRIDOR !' : '🚨 VÉHICULE DE SECOURS DERRIÈRE VOUS';
    if (this.hovT > 2.5) return '◇ VOIE RÉSERVÉE AU COVOITURAGE — RABATTEZ-VOUS';
    return null;
  }
}
