// ============================================================
// Périph' Rush — sensations de conduite (v23)
//  • vitesse : vignettage qui se resserre, traînées en bord d'écran,
//    micro-vibrations de caisse proportionnelles à la vitesse ;
//  • revêtement : joints de dilatation des viaducs (« clac-clac » essieu
//    avant puis arrière), reprises d'enrobé, tampons de regard → secousse
//    de caméra + son, calés sur les éléments dessinés par world.js ;
//  • pluie : flaques (gerbe, aquaplaning bref au-delà de ~75 km/h),
//    rideau d'eau quand on suit un poids lourd de près ;
//  • dégâts : frottement contre la DBA (étincelles, rayures, son), fumée
//    sous le capot quand la voiture est abîmée, optique cassée.
// ============================================================

import { clamp, loopDelta, wrap } from './utils.js';
import { CFG } from './config.js';

export class Feel {
  constructor(game) {
    this.g = game;
    this.time = 0;
    this.bumpY = 0; this.bumpV = 0; this.pitchK = 0;
    this.queue = [];             // secousses programmées (essieu arrière)
    this.spray = 0; this.splash = 0;
    this.smokeT = 0; this.scrapeT = 0; this.scrapeSndT = 0;
    // calques plein écran
    const mk = (id, css) => {
      let el = document.getElementById(id);
      if (!el) { el = document.createElement(id === 'fx-streaks' ? 'canvas' : 'div'); el.id = id; document.body.insertBefore(el, document.getElementById('hud')); }
      Object.assign(el.style, { position: 'fixed', inset: '0', pointerEvents: 'none', ...css });
      return el;
    };
    this.vig = mk('fx-speed', { zIndex: 6, opacity: 0, background: 'radial-gradient(ellipse at 50% 55%, transparent 48%, rgba(0,0,0,0.55) 100%)' });
    this.streaks = mk('fx-streaks', { zIndex: 6, width: '100%', height: '100%' });
    this.streaks.width = 320; this.streaks.height = 180;
    this.sctx = this.streaks.getContext('2d');
    this.sprayEl = mk('fx-spray', { zIndex: 7, opacity: 0, background: 'radial-gradient(ellipse at 50% 60%, rgba(215,222,228,0.95) 0%, rgba(200,208,216,0.75) 55%, rgba(190,198,206,0.45) 100%)' });
    this.glare = mk('fx-glare', { zIndex: 6, opacity: 0, mixBlendMode: 'screen' });
    this.lines = Array.from({ length: 26 }, () => this.newLine());
    this._last = { s: null };
  }

  newLine() {
    const a = Math.random() * Math.PI * 2;
    return { a, r: 0.55 + Math.random() * 0.4, len: 0.08 + Math.random() * 0.14, sp: 0.6 + Math.random() * 1.2, w: 0.6 + Math.random() * 1.4 };
  }

  hide() {
    this.vig.style.opacity = 0; this.sprayEl.style.opacity = 0; if (this.glare) this.glare.style.opacity = 0;
    if (this._drawn) { this.sctx.clearRect(0, 0, 320, 180); this._drawn = false; }
  }

  // appelé après la mise en place de la caméra (vue extérieure ou cockpit)
  update(dt, camera) {
    const G = this.g, p = G.player;
    if (G.state !== 'running') { this.hide(); this._last.s = null; return; }
    this.time += dt;
    const kmh = p.kmh, cockpit = !!G.cockpit?.active;
    const k = clamp((kmh - 55) / 95, 0, 1);

    this.updateThanks(dt);
    // ---- vitesse : vignettage + traînées (une image sur deux) ----
    this.vig.style.opacity = (0.12 + 0.6 * k * k).toFixed(3);
    if ((this.frame = (this.frame || 0) + 1) % 2 === 0) {
      const c = this.sctx;
      c.clearRect(0, 0, 320, 180);
      this._drawn = false;
      if (k > 0.05) {
        c.lineCap = 'round';
        for (const L of this.lines) {
          L.r += dt * 2 * L.sp * (0.6 + k);
          if (L.r > 1.25) Object.assign(L, this.newLine(), { r: 0.55 });
          const x0 = 160 + Math.cos(L.a) * L.r * 190, y0 = 100 + Math.sin(L.a) * L.r * 110;
          const x1 = 160 + Math.cos(L.a) * (L.r + L.len * (0.5 + k)) * 190, y1 = 100 + Math.sin(L.a) * (L.r + L.len * (0.5 + k)) * 110;
          c.strokeStyle = `rgba(255,255,255,${(0.05 + 0.22 * k) * Math.min(1, (L.r - 0.55) * 4)})`;
          c.lineWidth = L.w;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
        this._drawn = true;
      }
    }

    // ---- soleil rasant dans l'axe : éblouissement (lever / coucher) ----
    {
      const A = G.ambience, e = A.elevation ?? 1;
      let gl = 0;
      if (e > -0.02 && e < 0.32 && !G.track.inTunnel(p.s)) {
        const sd = this._sd || (this._sd = A.sun.position.clone());
        sd.copy(A.sun.position).sub(A.sunTarget.position).normalize();
        const fw = this._fw || (this._fw = sd.clone());
        camera.getWorldDirection(fw);
        const dot = fw.dot(sd);
        gl = clamp((dot - 0.8) / 0.18, 0, 1) * clamp(1 - Math.abs(e - 0.1) / 0.22, 0, 1) * (1 - clamp((A.rainAmt || 0) + (A.fogAmt || 0), 0, 1));
        if (gl > 0.01) {
          const v = this._sv || (this._sv = sd.clone());
          v.copy(camera.position).addScaledVector(sd, 500).project(camera);
          const x = (v.x * 0.5 + 0.5) * 100, y = (-v.y * 0.5 + 0.5) * 100;
          this.glare.style.background = `radial-gradient(circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgba(255,236,190,0.95) 0%, rgba(255,200,120,0.45) 9%, rgba(255,170,90,0.12) 32%, transparent 60%)`;
        }
      }
      this.glare.style.opacity = (gl * 0.85).toFixed(3);
    }

    // ---- revêtement : joints, reprises, tampons ----
    const s = p.s, L = G.track.length, W = G.world, t = G.track;
    const prev = this._last.s;
    this._last.s = s;
    if (prev != null && p.v > 2) {
      const ds = loopDelta(s, prev, L);
      if (ds > 0 && ds < 20) {
        const a = prev, b = prev + ds;
        // joints de dilatation des ouvrages (tous les 42 m, cf. world.buildPaint)
        for (let d = Math.ceil(a / 42) * 42; d < b; d += 42) {
          const dw = wrap(d, L);
          if (t.onViaduct(dw) || t.onBridge(dw)) this.bump(0.045, 'joint', p);
        }
        for (const d of W.seams(a, b)) this.bump(0.018, 'seam', p);
        // tampons de regard (un tous les 140 m, alterné entre les deux sens)
        for (let d = Math.ceil(a / 140) * 140; d < b; d += 140) {
          if (t.coverAt(d) || t.onBridge(d) || !(Math.floor(d / 140) % 2)) continue;
          const kk = (Math.floor(d / 140) * 7) % 4;
          const lat = CFG.INNER_EDGE + CFG.LANE_WIDTH * (0.5 + (kk % Math.max(1, t.lanesAt(d))));
          const off = Math.abs(p.lat - lat);
          if (Math.abs(off - 0.75) < 0.42) this.bump(0.03, 'manhole', p);
        }
        // flaques
        if ((W.wetLevel || 0) > 0.3) {
          for (const q of W.puddles(a, b)) {
            const dl = Math.abs(p.lat - q.lat);
            if (dl < q.wid / 2 + 0.75 && dl > -1) this.hitPuddle(p, q);
          }
        }
      }
    }
    // essieu arrière : seconde secousse après l'empattement
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) { this.kick(q.amp); this.queue.splice(i, 1); }
    }

    // ---- rideau d'eau derrière un poids lourd ----
    let sprayT = 0;
    const wet = W.wetLevel || 0;
    if (wet > 0.35 && !t.inTunnel(s)) {
      for (const n of G.traffic.npcs) {
        if (n.len < 7 || n.v < 7) continue;
        const d = loopDelta(n.s, s, L) - (n.len + p.len) / 2;
        if (d < 0 || d > 34 || Math.abs(n.lat - p.lat) > 2.6) continue;
        sprayT = Math.max(sprayT, wet * Math.min(1, n.v / 18) * (1 - d / 34) * (1 - Math.abs(n.lat - p.lat) / 3.2));
      }
    }
    this.splash = Math.max(0, this.splash - dt * 1.8);
    this.spray += (Math.max(sprayT * 0.85, this.splash) - this.spray) * Math.min(1, dt * (Math.max(sprayT, this.splash) > this.spray ? 6 : 1.8));
    this.sprayEl.style.opacity = this.spray.toFixed(3);
    if (G.cockpit) G.cockpit.extraRain = this.spray * 1.6;

    // ---- caméra : micro-vibrations + secousses amorties ----
    // v24 : plus de tremblement lié à la vitesse (jugé irréaliste) — seules les secousses
    // ponctuelles (joints, tampons, flaques) restent, amorties
    this.bumpV += (-this.bumpY * 520 - this.bumpV * 26) * dt;
    this.bumpY += this.bumpV * dt;
    camera.position.y += this.bumpY * 0.7;
    camera.rotateX(this.bumpY * 0.4);

    // ---- frottements contre la DBA / dégâts visibles ----
    if (p.scraping && p.v > 3) {
      this.scrapeT -= dt; this.scrapeSndT -= dt;
      p.health = Math.max(8, p.health - dt * (1.5 + p.v * 0.12));
      if (this.scrapeT <= 0) {
        this.scrapeT = 0.06;
        const pos = p.bundle.group.position.clone();
        const side = p.scraping;
        const q = {}; t.pointAt(s, q);
        pos.x += q.rx * side * (p.wid / 2); pos.z += q.rz * side * (p.wid / 2); pos.y += 0.45;
        G.emitSmoke(pos, 2, true);
      }
      if (this.scrapeSndT <= 0) {
        this.scrapeSndT = 0.38;
        G.audio.scrape();
        // rayures / enfoncement léger le long du flanc
        if (Math.random() < 0.5) p.deform({ x: p.scraping * p.wid / 2, y: 0.55, z: (Math.random() - 0.5) * p.len * 0.7, nx: -p.scraping * 0.9, ny: 0.1, nz: 0 }, 0.04);
        if (!this._scrapeMsg || this.time - this._scrapeMsg > 4) { this._scrapeMsg = this.time; G.ui.popup('ÇA FROTTE CONTRE LA GLISSIÈRE !', 'fine'); }
      }
    }
    // fumée sous le capot quand la voiture est abîmée
    if (p.health < 55 && !cockpit) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.12 + p.health / 120;
        const q = {}; t.pointAt(s + p.len * 0.35, q);
        const pos = p.bundle.group.position.clone();
        pos.x += q.tx * p.len * 0.32; pos.z += q.tz * p.len * 0.32; pos.y += 1.0;
        G.emitSmoke(pos, p.health < 30 ? 2 : 1, false);
      }
    }
    if (p.headBroken && p.lightsOn && !p.flashT) p.headlight.intensity = 40;
  }

  // v24 : remerciement d'un motard (jambe tendue ou main levée) pendant ~1,3 s
  thank(n, side) {
    const T = this.g.T;
    if (!this.legMesh) {
      const mat = new T.MeshLambertMaterial({ color: 0x1b1d22 });
      const g = new T.Group();
      const leg = new T.Mesh(new T.CylinderGeometry(0.07, 0.055, 0.85, 7), mat);
      leg.position.y = -0.42;
      const boot = new T.Mesh(new T.BoxGeometry(0.11, 0.1, 0.26), new T.MeshLambertMaterial({ color: 0x0e0f11 }));
      boot.position.set(0, -0.85, 0.06);
      g.add(leg, boot);
      const arm = new T.Group();
      const a = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.62, 7), mat);
      a.position.y = 0.31;
      const hand = new T.Mesh(new T.SphereGeometry(0.06, 6, 5), mat);
      hand.position.y = 0.64;
      arm.add(a, hand);
      this.legMesh = g; this.armMesh = arm;
      this.g.scene.add(g, arm);
    }
    this.thanks = { n, side, t: 1.3, kind: Math.random() < 0.6 ? 'leg' : 'hand' };
  }
  updateThanks(dt) {
    const th = this.thanks;
    if (!this.legMesh) return;
    this.legMesh.visible = this.armMesh.visible = false;
    if (!th || th.t <= 0 || !th.n.bundle?.group) return;
    th.t -= dt;
    const g = th.n.bundle.group, e = Math.sin(Math.min(1, (1.3 - th.t) / 0.25) * Math.PI / 2) * Math.min(1, th.t / 0.3);
    const o = th.kind === 'leg' ? this.legMesh : this.armMesh;
    o.visible = true;
    o.position.copy(g.position);
    o.rotation.copy(g.rotation);
    // côté vers le joueur : repère local de la moto (x latéral)
    o.translateX(th.side * 0.32);
    o.translateY(th.kind === 'leg' ? 0.62 : 1.25);
    o.translateZ(th.kind === 'leg' ? -0.15 : 0.2);
    o.rotateZ(-th.side * (th.kind === 'leg' ? 1.25 : 2.3) * e);
  }

  bump(amp, kind, p) {
    this.kick(amp);
    const a = this.g.audio;
    if (kind === 'joint') a.joint?.(1); else if (kind === 'manhole') a.joint?.(0.55); else a.joint?.(0.35);
    const delay = (p.spec?.wb || 2.6) / Math.max(p.v, 3);
    this.queue.push({ t: delay, amp: amp * 0.8 });
    if (kind === 'joint') setTimeout(() => a.joint?.(0.85), delay * 1000);
  }
  kick(amp) { this.bumpV += amp * 22; }

  hitPuddle(p, q) {
    const G = this.g, wet = G.world.wetLevel || 0;
    this.splash = Math.min(0.55, this.splash + 0.18 + p.v / 160) * wet;
    G.audio.splash?.(Math.min(1, p.v / 25));
    this.kick(0.012);
    // aquaplaning : la voiture flotte une fraction de seconde et part de côté
    if (p.kmh > 75 && wet > 0.55 && q.len > 2.2) {
      p.aquaT = 0.35 + Math.min(0.4, (p.kmh - 75) / 120);
      p.aquaDir = Math.sign(q.lat - p.lat) || (Math.random() < 0.5 ? -1 : 1);
      G.ui.popup('AQUAPLANING !', 'fine');
      G.ui.haptic([20, 30, 20]);
    }
  }

  reset() { this.queue = []; this.spray = this.splash = 0; this.bumpY = this.bumpV = 0; this._last.s = null; this.hide(); }
}
