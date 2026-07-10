// ============================================================
// Périph' Rush — audio 100 % synthétisé (WebAudio)
// Moteur avec rapports de boîte, vent, pluie, frôlements,
// klaxons, crash. Débloqué au premier geste tactile (iOS).
// ============================================================

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOn = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    // — bruit blanc partagé —
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // — moteur : 2 oscillateurs + passe-bas —
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 500; this.engFilter.Q.value = 2.5;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth'; this.osc1.frequency.value = 60;
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square'; this.osc2.frequency.value = 30;
    const og2 = ctx.createGain(); og2.gain.value = 0.4;
    this.osc1.connect(this.engFilter);
    this.osc2.connect(og2).connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.master);
    this.osc1.start(); this.osc2.start();

    // — vent —
    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = buf; this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 480; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.windSrc.start();

    // — pluie —
    this.rainSrc = ctx.createBufferSource();
    this.rainSrc.buffer = buf; this.rainSrc.loop = true;
    this.rainSrc.playbackRate.value = 0.7;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2600;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rf).connect(this.rainGain).connect(this.master);
    this.rainSrc.start();
    this.engineOn = true;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.8 : 0;
  }

  // v, vmax en m/s · throttle 0..1
  engine(v, vmax, throttle) {
    if (!this.ctx || !this.engineOn) return;
    // rapports de boîte simulés
    const ratio = v / vmax;
    const gears = 5;
    const g = Math.min(gears - 1, Math.floor(ratio * gears));
    const inGear = ratio * gears - g;
    const rpm = 0.25 + inGear * 0.75;
    const t = this.ctx.currentTime;
    this.osc1.frequency.setTargetAtTime(55 + rpm * 105 + g * 6, t, 0.05);
    this.osc2.frequency.setTargetAtTime((55 + rpm * 105) / 2, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(320 + rpm * 900 + throttle * 500, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.05 + 0.075 * throttle + rpm * 0.035, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.pow(Math.min(v / 55, 1), 2) * 0.16, t, 0.15);
  }

  rain(amount) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(amount * 0.06, this.ctx.currentTime, 0.4);
  }

  stopEngine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.2);
    this.windGain.gain.setTargetAtTime(0, t, 0.2);
  }

  // burst de bruit utilitaire
  burst({ dur = 0.3, freq = 800, type = 'bandpass', q = 1, gain = 0.3, sweep = 0, rate = 1 }) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  nearMiss() { this.burst({ dur: 0.28, freq: 340, sweep: 1300, q: 2.2, gain: 0.34 }); }
  scrape() { this.burst({ dur: 0.5, freq: 2400, type: 'highpass', gain: 0.3 }); }

  crash(severity) {
    if (!this.ctx || !this.enabled) return;
    this.burst({ dur: 0.5 + severity * 0.5, freq: 120, type: 'lowpass', gain: 0.85, rate: 0.5 });
    this.burst({ dur: 0.3, freq: 3200, type: 'highpass', gain: 0.35 * severity }); // verre/métal
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = 160;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.5 * severity + 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.7);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.75);
  }

  horn(far = false) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const fq of [420, 528]) {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = fq * (0.94 + Math.random() * 0.12);
      const g = ctx.createGain();
      const vol = far ? 0.035 : 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol, t + 0.25 + Math.random() * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.7);
    }
  }

  click() { this.burst({ dur: 0.08, freq: 1800, q: 4, gain: 0.15 }); }
  coin() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1320, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }
}
