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

    // — moteur : couches d'impulsions d'échappement synthétisées (voir buildEngine) —
    this.engBus = ctx.createGain(); this.engBus.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 2400; this.engFilter.Q.value = 0.5;
    this.engBody = ctx.createBiquadFilter();
    this.engBody.type = 'peaking'; this.engBody.frequency.value = 140; this.engBody.Q.value = 0.9; this.engBody.gain.value = 3;
    this.engShaper = ctx.createWaveShaper();
    this.engShaper.curve = this.makeCurve(1.6);
    this.engBus.connect(this.engShaper).connect(this.engBody).connect(this.engFilter);
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter.connect(this.engGain).connect(this.out);
    // admission : souffle filtré qui suit le régime
    this.intake = loop(buf, 1);
    this.intakeF = ctx.createBiquadFilter(); this.intakeF.type = 'bandpass'; this.intakeF.frequency.value = 600; this.intakeF.Q.value = 1.2;
    this.intakeG = ctx.createGain(); this.intakeG.gain.value = 0;
    this.intake.connect(this.intakeF).connect(this.intakeG).connect(this.out);
    this.layers = [];
    this.setVehicle('car4');
    // — pneus : crissement (dérive) + vibration ABS —
    this.sqSrc = loop(buf, 1);
    this.sqF = ctx.createBiquadFilter(); this.sqF.type = 'bandpass'; this.sqF.frequency.value = 1050; this.sqF.Q.value = 9;
    this.sqF2 = ctx.createBiquadFilter(); this.sqF2.type = 'bandpass'; this.sqF2.frequency.value = 1650; this.sqF2.Q.value = 12;
    this.sqG = ctx.createGain(); this.sqG.gain.value = 0;
    this.sqSrc.connect(this.sqF).connect(this.sqG);
    this.sqSrc.connect(this.sqF2).connect(this.sqG);
    this.sqG.connect(this.out);
    // — véhicules voisins : 3 voix spatialisées (moteur + roulement, Doppler) —
    this.voicePool = [];
    for (let i = 0; i < 3; i++) {
      const src = ctx.createBufferSource(); src.loop = true;
      src.buffer = this.genLayer('car4', 1900, 1.2).buf;
      const msrc = ctx.createBufferSource(); msrc.loop = true;
      msrc.buffer = this.genLayer('scoot1', 5200, 1.0).buf;
      const tire = ctx.createBufferSource(); tire.buffer = this.brownBuf; tire.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const gC = ctx.createGain(), gM = ctx.createGain(), gT = ctx.createGain();
      gC.gain.value = 0; gM.gain.value = 0; gT.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      src.connect(gC).connect(lp); msrc.connect(gM).connect(lp); tire.connect(gT).connect(lp);
      lp.connect(pan).connect(this.out);
      src.start(ctx.currentTime + i * 0.13); msrc.start(ctx.currentTime + i * 0.07); tire.start();
      this.voicePool.push({ src, msrc, tire, gC, gM, gT, lp, pan });
    }

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

  // ---------- moteur : synthèse par impulsions d'échappement ----------------
  // Chaque couche est une boucle de cycles moteur à un régime donné : une
  // impulsion amortie par allumage (résonances du collecteur et de la ligne),
  // irrégularités cylindre par cylindre. En jeu, on fond les couches voisines
  // du régime courant et on ajuste légèrement leur vitesse de lecture : les
  // résonances restent à leur place (pas d'effet « accéléré » artificiel).
  makeCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  genLayer(type, rpm, dur = 1.6) {
    const ctx = this.ctx, sr = ctx.sampleRate;
    const T = {
      car4: { cyl: [0, 0.25, 0.5, 0.75], amp: [1, 0.86, 0.95, 0.9], f1: 105, f2: 330, f3: 920, tau1: 0.016, noise: 0.25 },
      moto2: { cyl: [0, 0.375], amp: [1, 0.92], f1: 140, f2: 420, f3: 1300, tau1: 0.012, noise: 0.35 },
      scoot1: { cyl: [0], amp: [1], f1: 190, f2: 560, f3: 1700, tau1: 0.008, noise: 0.45 },
    }[type];
    const cycle = 120 / rpm; // 4 temps : un cycle = 2 tours
    const nCyc = Math.max(2, Math.round(dur / cycle));
    const len = Math.round(nCyc * cycle * sr);
    const out = new Float32Array(len);
    let seed = rpm * 7 + type.length * 131;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pulseLen = Math.min(Math.round(sr * 0.06), Math.round(cycle * sr));
    const pulse = (amp, j) => {
      const p = new Float32Array(pulseLen);
      const f1 = T.f1 * (1 + (rnd() - 0.5) * 0.04), ph = rnd() * 0.6;
      for (let i = 0; i < pulseLen; i++) {
        const t = i / sr;
        p[i] = amp * (Math.exp(-t / T.tau1) * Math.sin(2 * Math.PI * f1 * t + ph)
          + 0.55 * Math.exp(-t / 0.005) * Math.sin(2 * Math.PI * T.f2 * t)
          + 0.22 * Math.exp(-t / 0.0022) * Math.sin(2 * Math.PI * T.f3 * t)
          + T.noise * Math.exp(-t / 0.0025) * (rnd() * 2 - 1));
      }
      return p;
    };
    for (let c = 0; c < nCyc; c++) {
      T.cyl.forEach((phase, k) => {
        const jitter = (rnd() - 0.5) * 0.012;
        const start = Math.round(((c + phase + jitter) * cycle) * sr);
        const p = pulse(T.amp[k] * (0.9 + rnd() * 0.2), k);
        for (let i = 0; i < pulseLen; i++) out[(start + i) % len] += p[i];
      });
    }
    // grave continu (inertie de l'échappement) : passe-bas à 1 pôle bouclé
    let y = 0;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < len; i++) { y += (out[i] - y) * 0.08; if (pass) out[i] = out[i] * 0.7 + y * 1.4; }
    let rms = 0;
    for (let i = 0; i < len; i++) rms += out[i] * out[i];
    rms = Math.sqrt(rms / len) || 1;
    for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i] / rms * 0.28));
    const buf = ctx.createBuffer(1, len, sr);
    buf.getChannelData(0).set(out);
    return { buf, rpm };
  }
  setVehicle(type) {
    if (!this.ctx || this.vehType === type) return;
    this.vehType = type;
    this.engCache = this.engCache || {};
    const rpms = type === 'scoot1' ? [3200, 5200, 7400] : type === 'moto2' ? [1200, 3000, 5600, 8500] : [850, 1900, 3400, 5400];
    if (!this.engCache[type]) this.engCache[type] = rpms.map((r) => this.genLayer(type, r));
    for (const l of this.layers) { try { l.src.stop(); } catch (e) { /* déjà arrêtée */ } l.src.disconnect(); }
    const t = this.ctx.currentTime;
    this.layers = this.engCache[type].map(({ buf, rpm }) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(g).connect(this.engBus);
      src.start(t + Math.random() * 0.05);
      return { src, g, rpm };
    });
    this.engBody.frequency.value = type === 'car4' ? 140 : 220;
  }

  // v, vmax en m/s · throttle 0..1
  engine(v, vmax, throttle, dt = 0.016) {
    if (!this.ctx || !this.engineOn) return;
    const kmh = v * 3.6;
    const scooter = this.vehType === 'scoot1';
    if (scooter) {
      // variateur (CVT) : régime qui monte vite puis reste haut sous charge
      const target = kmh < 3 ? 1700 + throttle * 1500 : 3600 + throttle * 3200 + Math.min(kmh, 140) * 12;
      this.rpm = (this.rpm || 1700) + (target - (this.rpm || 1700)) * Math.min(1, dt * 4);
    } else {
      // boîte à 6 rapports avec hystérésis + coupure au passage
      const GE = this.vehType === 'moto2' ? [0, 30, 55, 80, 105, 130, 999] : GEARS;
      let g = this.gear;
      if (kmh > GE[g] + 3 && g < 6) { g++; this.shiftT = 0.22; }
      else if (g > 1 && kmh < GE[g - 1] - 6) { g--; this.shiftT = 0.12; }
      this.gear = g;
      this.shiftT = Math.max(0, this.shiftT - dt);
      const lo = GE[g - 1], hi = g === 6 ? 200 : GE[g];
      const x = Math.min(1, Math.max(0, (kmh - lo) / (hi - lo)));
      const top = this.vehType === 'moto2' ? 9000 : 5800, low = this.vehType === 'moto2' ? 3000 : 2000;
      let rpm = g === 1 ? 850 + x * (top - 1300) : low + x * (top - low - 400);
      if (kmh < 2) rpm = 850 + throttle * 700;
      this.rpm = (this.rpm || rpm) + (rpm - (this.rpm || rpm)) * Math.min(1, dt * (this.shiftT > 0 ? 10 : 6));
    }
    const rpm = this.rpm;
    const t = this.ctx.currentTime;
    // fondu entre couches voisines + lecture légèrement accélérée/ralentie
    const L = this.layers;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      const prev = L[i - 1]?.rpm ?? a.rpm * 0.5, next = L[i + 1]?.rpm ?? a.rpm * 1.6;
      let w = 0;
      if (rpm <= a.rpm) w = Math.max(0, (rpm - prev) / (a.rpm - prev));
      else w = Math.max(0, (next - rpm) / (next - a.rpm));
      if (i === 0 && rpm < a.rpm) w = 1;
      if (i === L.length - 1 && rpm > a.rpm) w = 1;
      a.g.gain.setTargetAtTime(Math.sqrt(w), t, 0.03);
      a.src.playbackRate.setTargetAtTime(Math.min(1.6, Math.max(0.6, rpm / a.rpm)), t, 0.03);
    }
    const load = this.shiftT > 0 ? 0.1 : throttle;
    const ck = this.env.cockpit;
    this.engBus.gain.setTargetAtTime(1, t, 0.05);
    // sous charge : plus de grave et d'aigu ; en décélération : son creux et étouffé
    this.engFilter.frequency.setTargetAtTime((ck ? 900 : 1300) + load * (ck ? 1600 : 3200) + rpm * 0.12, t, 0.06);
    this.engBody.gain.setTargetAtTime(2 + load * 4, t, 0.1);
    this.engGain.gain.setTargetAtTime((0.05 + 0.12 * load + (rpm / 7000) * 0.05) * (ck ? 1.2 : 1) * (scooter ? 0.8 : 1), t, 0.05);
    this.intakeF.frequency.setTargetAtTime(300 + rpm * 0.25, t, 0.05);
    this.intakeG.gain.setTargetAtTime(load * (rpm / 7000) * 0.05 * (ck ? 1.4 : 0.6), t, 0.05);
    // roulement + vent
    const sp = Math.min(kmh / 90, 1.4);
    this.rollGain.gain.setTargetAtTime(sp * 0.13 * (ck ? 1.2 : 1), t, 0.15);
    this.rollFilter.frequency.setTargetAtTime(240 + sp * 520, t, 0.2);
    this.hissGain.gain.setTargetAtTime(sp * this.env.wet * 0.1, t, 0.2);
    this.windGain.gain.setTargetAtTime(Math.pow(Math.min(v / 55, 1), 2) * (ck ? 0.07 : 0.16), t, 0.15);
  }

  // crissement des pneus (dérive) et broutement de l'ABS
  tires(slip, abs, v, dt = 0.016) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.absT = (this.absT || 0) + dt;
    const sq = Math.max(0, slip - 0.06) * 6 * Math.min(1, v / 8);
    let g = Math.min(0.09, sq * 0.09);
    if (abs && v > 2) g = Math.max(g, 0.05 * (0.5 + 0.5 * Math.sign(Math.sin(this.absT * 2 * Math.PI * 14))));
    this.sqG.gain.setTargetAtTime(this.enabled ? g * (1 - 0.6 * this.env.wet) : 0, t, 0.03);
    this.sqF.frequency.setTargetAtTime(950 + Math.min(v, 30) * 6, t, 0.05);
  }

  // véhicules proches : [{ dist, pan, doppler, rpm, moto }]
  voices(list) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.voicePool.forEach((vp, i) => {
      const o = list[i];
      if (!o || !this.enabled) { vp.gC.gain.setTargetAtTime(0, t, 0.1); vp.gM.gain.setTargetAtTime(0, t, 0.1); vp.gT.gain.setTargetAtTime(0, t, 0.1); return; }
      const att = Math.min(1, 6 / (4 + o.dist * o.dist * 0.08));
      vp.gC.gain.setTargetAtTime(o.moto ? 0 : att * 0.22, t, 0.08);
      vp.gM.gain.setTargetAtTime(o.moto ? att * 0.3 : 0, t, 0.08);
      vp.gT.gain.setTargetAtTime(att * Math.min(1, o.v / 14) * 0.35, t, 0.08);
      const rate = Math.min(1.8, Math.max(0.5, (o.rpm || 1900) / (o.moto ? 5200 : 1900) * o.doppler));
      vp.src.playbackRate.setTargetAtTime(rate, t, 0.05);
      vp.msrc.playbackRate.setTargetAtTime(rate, t, 0.05);
      vp.lp.frequency.setTargetAtTime(500 + 3000 * att, t, 0.08);
      if (vp.pan.pan) vp.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, o.pan)), t, 0.05);
    });
  }

  rain(amount) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(amount * (this.env.cockpit ? 0.11 : 0.06), this.ctx.currentTime, 0.4);
  }

  stopEngine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.2);
    this.intakeG?.gain.setTargetAtTime(0, t, 0.2);
    this.sqG?.gain.setTargetAtTime(0, t, 0.1);
    this.voices?.([]);
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
