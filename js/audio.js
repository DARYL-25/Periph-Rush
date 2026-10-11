// ============================================================
// Périph' Rush — audio 100 % synthétisé (WebAudio) · v16
// Moteur 4 cylindres avec boîte 6 rapports (régime, passages de
// rapport), bruit de roulement (sec / mouillé), joints de dilatation
// des viaducs, vent, pluie, réverbération en tunnel, klaxons
// spatialisés (voitures, motos, avertisseur sonore), sirène deux-tons
// avec effet Doppler, flash radar, crash, et radio info-trafic
// (synthèse vocale de l'appareil, jingle synthétisé).
// ============================================================

const GEARS = [0, 22, 40, 60, 84, 115, 999]; // vitesses (km/h) de passage de rapport

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOn = false;
    this.gear = 1;
    this.shiftT = 0;
    this.env = { tunnel: 0, wet: 0, cockpit: false };
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(ctx.destination);
    // bus sec + réverbération de tunnel (réponse impulsionnelle synthétique)
    this.dry = ctx.createGain(); this.dry.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeIR(2.4);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0;
    this.verb.connect(this.verbGain).connect(this.master);
    this.out = ctx.createGain(); // tout ce qui doit résonner en tunnel
    this.out.connect(this.dry);
    this.out.connect(this.verb);

    // bruit blanc / rose partagés
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const bbuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = bbuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brownBuf = bbuf;
    const loop = (b, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };

    // — moteur : fondamentale d'allumage + harmoniques + grondement —
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 500; this.engFilter.Q.value = 1.8;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    this.osc3 = ctx.createOscillator(); this.osc3.type = 'triangle';
    const og2 = ctx.createGain(); og2.gain.value = 0.35;
    const og3 = ctx.createGain(); og3.gain.value = 0.5;
    this.osc1.connect(this.engFilter);
    this.osc2.connect(og2).connect(this.engFilter);
    this.osc3.connect(og3).connect(this.engFilter);
    const rumble = loop(this.brownBuf, 0.6);
    this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0.25;
    rumble.connect(this.rumbleGain).connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.out);
    this.osc1.start(); this.osc2.start(); this.osc3.start();

    // — roulement : grondement (sec) + chuintement (mouillé) —
    this.rollSrc = loop(this.brownBuf, 1);
    this.rollFilter = ctx.createBiquadFilter(); this.rollFilter.type = 'lowpass'; this.rollFilter.frequency.value = 420;
    this.rollGain = ctx.createGain(); this.rollGain.gain.value = 0;
    this.rollSrc.connect(this.rollFilter).connect(this.rollGain).connect(this.out);
    this.hissSrc = loop(this.noiseBuf, 1);
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3800; hf.Q.value = 0.5;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    this.hissSrc.connect(hf).connect(this.hissGain).connect(this.out);

    // — vent —
    this.windSrc = loop(buf);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 480; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.dry);

    // — pluie —
    this.rainSrc = loop(buf, 0.7);
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2600;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rf).connect(this.rainGain).connect(this.dry);

    // — sirène (deux tons, Doppler) —
    this.sirOsc = ctx.createOscillator(); this.sirOsc.type = 'square';
    this.sirOsc2 = ctx.createOscillator(); this.sirOsc2.type = 'sawtooth';
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2200;
    this.sirPan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    this.sirGain = ctx.createGain(); this.sirGain.gain.value = 0;
    const s2g = ctx.createGain(); s2g.gain.value = 0.4;
    this.sirOsc.connect(sf); this.sirOsc2.connect(s2g).connect(sf);
    sf.connect(this.sirGain).connect(this.sirPan).connect(this.out);
    this.sirOsc.start(); this.sirOsc2.start();
    this.sirT = 0;
    this.engineOn = true;
  }

  makeIR(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2) * (i < 400 ? i / 400 : 1);
    }
    return ir;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.8 : 0;
    if (!on && window.speechSynthesis) speechSynthesis.cancel();
  }

  // environnement sonore : tunnel (réverbération), vue cockpit (moteur feutré)
  setEnv({ tunnel = 0, wet = 0, cockpit = false }) {
    this.env = { tunnel, wet, cockpit };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.verbGain.gain.setTargetAtTime(tunnel ? 0.55 : 0.0, t, 0.3);
    this.dry.gain.setTargetAtTime(tunnel ? 0.85 : 1, t, 0.3);
  }

  // v, vmax en m/s · throttle 0..1
  engine(v, vmax, throttle, dt = 0.016) {
    if (!this.ctx || !this.engineOn) return;
    const kmh = v * 3.6;
    // boîte à 6 rapports avec hystérésis + coupure d'injection au passage
    let g = this.gear;
    if (kmh > GEARS[g] + 3 && g < 6) { g++; this.shiftT = 0.18; }
    else if (g > 1 && kmh < GEARS[g - 1] - 6) { g--; this.shiftT = 0.1; }
    this.gear = g;
    this.shiftT = Math.max(0, this.shiftT - dt);
    const lo = GEARS[g - 1], hi = g === 6 ? 190 : GEARS[g];
    const x = Math.min(1, Math.max(0, (kmh - lo) / (hi - lo)));
    this.rpm = g === 1 ? 850 + x * 4600 : 2100 + x * 3600;
    if (kmh < 2) this.rpm = 850 + throttle * 600;
    const fire = this.rpm / 60 * 2; // 4 cylindres 4 temps : 2 allumages / tour
    const t = this.ctx.currentTime;
    const cut = this.shiftT > 0 ? 0.35 : 1;
    const ck = this.env.cockpit ? 0.7 : 1;
    this.osc1.frequency.setTargetAtTime(fire, t, 0.04);
    this.osc2.frequency.setTargetAtTime(fire / 2, t, 0.04);
    this.osc3.frequency.setTargetAtTime(fire * 1.5, t, 0.04);
    this.engFilter.frequency.setTargetAtTime((240 + this.rpm * 0.18 + throttle * 600) * ck, t, 0.06);
    this.engGain.gain.setTargetAtTime((0.045 + 0.08 * throttle * cut + (this.rpm / 6000) * 0.035) * (this.env.cockpit ? 1.15 : 1), t, 0.06);
    // roulement + vent
    const sp = Math.min(kmh / 90, 1.4);
    this.rollGain.gain.setTargetAtTime(sp * 0.12 * (this.env.cockpit ? 1.2 : 1), t, 0.15);
    this.rollFilter.frequency.setTargetAtTime(260 + sp * 500, t, 0.2);
    this.hissGain.gain.setTargetAtTime(sp * this.env.wet * 0.09, t, 0.2);
    this.windGain.gain.setTargetAtTime(Math.pow(Math.min(v / 55, 1), 2) * (this.env.cockpit ? 0.08 : 0.16), t, 0.15);
  }

  rain(amount) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(amount * (this.env.cockpit ? 0.11 : 0.06), this.ctx.currentTime, 0.4);
  }

  stopEngine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.2);
    this.windGain.gain.setTargetAtTime(0, t, 0.2);
    this.rollGain.gain.setTargetAtTime(0, t, 0.2);
    this.hissGain.gain.setTargetAtTime(0, t, 0.2);
  }

  // burst de bruit utilitaire
  burst({ dur = 0.3, freq = 800, type = 'bandpass', q = 1, gain = 0.3, sweep = 0, rate = 1, dest = null }) {
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
    src.connect(f).connect(g).connect(dest || this.out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  nearMiss() { this.burst({ dur: 0.28, freq: 340, sweep: 1300, q: 2.2, gain: 0.34 }); }
  scrape() { this.burst({ dur: 0.5, freq: 2400, type: 'highpass', gain: 0.3 }); }
  // joint de dilatation (viaducs) : « ta-dam »
  thump() {
    this.burst({ dur: 0.09, freq: 110, type: 'lowpass', gain: 0.35, rate: 0.6 });
    setTimeout(() => this.burst({ dur: 0.08, freq: 120, type: 'lowpass', gain: 0.28, rate: 0.6 }), 95);
  }
  // flash radar : déclic sec + sifflement de condensateur
  flash() {
    if (!this.ctx || !this.enabled) return;
    this.burst({ dur: 0.05, freq: 4000, type: 'highpass', gain: 0.25 });
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(5200, t + 0.5);
    g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(this.dry); o.start(t); o.stop(t + 0.55);
  }

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
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.75);
  }

  // klaxon spatialisé : type 'horn' (voiture), 'mhorn' (moto), 'airhorn' (secours / PL)
  hornAt(type = 'horn', pan = 0, dist = 10) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = Math.min(0.12, 1.6 / (6 + dist)) * (type === 'airhorn' ? 1.4 : 1);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (panner.pan) panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.out);
    const tones = type === 'mhorn' ? [620, 760] : type === 'airhorn' ? [196, 247] : [400 + Math.random() * 60, 505 + Math.random() * 60];
    const pattern = type === 'mhorn' ? [[0, 0.14], [0.2, 0.14]] : Math.random() < 0.4 ? [[0, 0.18], [0.26, 0.5]] : [[0, 0.35 + Math.random() * 0.5]];
    for (const [t0, len] of pattern) {
      for (const fq of tones) {
        const o = ctx.createOscillator();
        o.type = type === 'airhorn' ? 'sawtooth' : 'square'; o.frequency.value = fq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + t0);
        g.gain.linearRampToValueAtTime(vol, t + t0 + 0.02);
        g.gain.setValueAtTime(vol, t + t0 + len);
        g.gain.exponentialRampToValueAtTime(0.0005, t + t0 + len + 0.08);
        o.connect(g).connect(panner);
        o.start(t + t0); o.stop(t + t0 + len + 0.1);
      }
    }
  }
  horn(far = false) { this.hornAt('horn', 0, far ? 40 : 8); }

  // sirène deux-tons (435 / 488 Hz) ; level 0 = coupée ; doppler = rapport de fréquence
  siren(level, doppler = 1, pan = 0, dt = 0.016) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirT += dt;
    const hi = Math.floor(this.sirT / 0.55) % 2;
    const f = (hi ? 488 : 435) * doppler;
    this.sirOsc.frequency.setTargetAtTime(f, t, 0.01);
    this.sirOsc2.frequency.setTargetAtTime(f * 2, t, 0.01);
    this.sirGain.gain.setTargetAtTime(this.enabled ? Math.min(0.16, level) : 0, t, 0.1);
    if (this.sirPan.pan) this.sirPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
  }

  click() { this.burst({ dur: 0.08, freq: 1800, q: 4, gain: 0.15, dest: this.dry }); }
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
    o.connect(g).connect(this.dry);
    o.start(t); o.stop(t + 0.32);
  }

  // ---------- radio info-trafic (fictive) ------------------------------------
  jingle() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [[659, 0], [784, 0.16], [988, 0.32], [1319, 0.5]].forEach(([fq, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = fq;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.07, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.45);
      o.connect(g).connect(this.dry); o.start(t + d); o.stop(t + d + 0.5);
    });
  }
  radio(text) {
    if (!this.enabled || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    try {
      this.jingle();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      const v = speechSynthesis.getVoices().find((x) => /^fr/i.test(x.lang));
      if (v) u.voice = v;
      u.rate = 1.04; u.volume = 0.9;
      setTimeout(() => speechSynthesis.speak(u), 900);
      return true;
    } catch (e) { return false; }
  }
  stopRadio() { if (window.speechSynthesis) speechSynthesis.cancel(); }
}
