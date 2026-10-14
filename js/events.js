// ============================================================
// Périph' Rush — événements dynamiques : chantiers & accidents
// Fermetures de voie balisées (cônes, barrières, flèche lumineuse,
// véhicules d'intervention), annoncées en amont par panneaux + PMV.
// Fournit au trafic les voies fermées et zones lentes, et au jeu
// la liste d'obstacles solides (toute collision = fin de partie).
// ============================================================

import { CFG, MS, laneCenter, ROAD_OUTER } from './config.js';
import { rng, clamp, wrap, mergeGeoms, colorize, xform, pick, loopDelta } from './utils.js';
import { worksPanelTexture } from './signs.js';
import { personGeometry, OUTFITS } from './people.js';

export class Events {
  constructor(THREE, scene, track, factory, world) {
    this.T = THREE;
    this.scene = scene;
    this.track = track;
    this.factory = factory;
    this.world = world;
    this.rand = rng(987654);
    this.active = [];          // événements en cours
    this.nextAt = 2200;        // distance joueur avant le prochain
    this.lapBoost = 1;
    this.time = 0;
    this._p = {};
    // matériaux partagés
    this.coneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.arrowOn = new THREE.MeshBasicMaterial({ color: 0xffb020 });
    this.blueMat = new THREE.MeshBasicMaterial({ color: 0x2a6cff });
  }

  get closures() {
    return this.active.filter((e) => e.opened).map((e) => ({ s0: e.s0, s1: e.s1, lanes: e.lanes }));
  }
  get slowZones() {
    // ralentissement : approche du balisage + curiosité au droit d'un accident
    return this.active.filter((e) => e.opened).map((e) => ({
      s0: wrap(e.s0 - 220, this.track.length), s1: e.s1, v: e.type === 'accident' ? MS(e.phase === 'frais' ? 17 : 22) : e.type === 'panne' || e.type === 'controle' ? MS(36) : MS(28),
    }));
  }
  // sens extérieur : on ralentit aussi pour regarder (bouchon de curiosité)
  get oppZones() {
    return this.active.filter((e) => e.type === 'accident').map((e) => ({ s0: wrap(e.s0 - 40, this.track.length), s1: wrap(e.s1 + 80, this.track.length) }));
  }

  obstacles() {
    const out = [];
    for (const e of this.active) for (const o of e.obstacles) out.push(o);
    return out;
  }

  update(dt, player, traffic) {
    this.time += dt;
    const L = this.track.length;
    // accrochage entre usagers, hors de vue devant : deux véhicules trop proches se percutent
    this.crashT = (this.crashT ?? 40 + this.rand() * 60) - dt * (traffic && traffic.level ? (traffic.busy ? 1.6 : 1) : 0.4);
    if (this.crashT <= 0 && traffic && this.active.length < 3) {
      this.crashT = 70 + this.rand() * 110;
      this.npcCrash(player, traffic);
    }
    this.nextAt -= player.v * dt;
    if (this.nextAt <= 0) {
      this.spawn(player.s);
      const gap = CFG.EVENT_MIN_GAP + this.rand() * (CFG.EVENT_MAX_GAP - CFG.EVENT_MIN_GAP);
      this.nextAt = gap / this.lapBoost;
    }
    // v26 : intervention de la dépanneuse — appelée sur un accident frais, elle remonte la file en
    // interfile (gyrophare orange), charge l'épave, puis la voie est rouverte
    for (const e of this.active.slice()) {
      if (e.type !== 'accident') continue;
      if (!e.towTried && e.phase !== 'depannage' && traffic && traffic.level >= 1) {
        const ahead = loopDelta(e.s0, player.s, L);
        if (ahead > 350 && ahead < 900) {
          e.towTried = true;
          if (this.rand() < 0.6) e.tow = traffic.spawnTow(player.s);
        }
      }
      if (e.tow) {
        const d = loopDelta(e.s0, e.tow.s, L);
        if (e.tow.gone) e.tow = null;
        else if (d < 70) {
          e.tow.gone = true;
          const i = this.active.indexOf(e);
          this.dispose(e); this.active.splice(i, 1);
          const e2 = this.spawnAccident(e.s0, { phase: 'depannage', lane: e.lanes[0], towed: true });
          if (e2) { e2.clearAt = this.time + 28 + this.rand() * 14; e2.towTried = true; }
          this.notice = 'tow';
        }
      }
      if (e.clearAt && this.time > e.clearAt) {
        const i = this.active.indexOf(e);
        if (i >= 0) { this.dispose(e); this.active.splice(i, 1); }
        this.notice = 'reopen';
      }
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      // clignotement flèche / gyrophares
      const blink = Math.sin(this.time * 6) > 0;
      for (const b of e.blinkers) b.visible = blink;
      const blink2 = Math.sin(this.time * 9 + 2) > 0;
      for (const b of e.strobes) b.visible = blink2;
      // suppression une fois loin derrière le joueur
      const behind = loopBehind(player.s, e.s1, L);
      if (behind > 600 && behind < L - 2000) {
        this.dispose(e);
        this.active.splice(i, 1);
      }
    }
  }

  npcCrash(player, traffic) {
    const L = this.track.length, T0 = this.track;
    for (const a of traffic.npcs) {
      if (a.mode !== 'lane' || a.heavy || a.moto) continue;
      const d = loopDeltaE(a.s, player.s, L);
      if (d < 250 || d > traffic.LV.winA - 15) continue;
      if (T0.coverAt(a.s) || T0.onBridge(a.s) || T0.lanesAt(a.s) < 4 || (T0.ramps && T0.ramps.at(a.s, 0).some((o) => !o.parallel && o.g < 3))) continue;
      const b = traffic.npcs.find((o) => o !== a && o.mode === 'lane' && !o.heavy && !o.moto && Math.abs(o.lat - a.lat) < 2.5 && loopDeltaE(o.s, a.s, L) > 0 && loopDeltaE(o.s, a.s, L) < 24);
      if (!b) continue;
      const lane = a.laneTo;
      const ids = [a.id, b.id].map((id) => (traffic.factory.glb?.has(id) ? id : 'concorde'));
      const cols = [a.bundle?.color?.getHex?.(), b.bundle?.color?.getHex?.()];
      for (const n of [a, b]) n.gone = true;
      this.spawnAccident(wrap(a.s - 18, L), { phase: 'frais', lane, ids, cols });
      return true;
    }
    return false;
  }

  // annonce pour le HUD : événement le plus proche devant
  warningAhead(playerS) {
    let best = null, bestD = Infinity;
    for (const e of this.active) {
      const d = wrap(e.s0 - playerS, this.track.length);
      if (d < CFG.EVENT_WARN_DIST + 200 && d > 10 && d < bestD) {
        bestD = d;
        best = { dist: d, type: e.type, lanes: e.lanes };
      }
    }
    return best;
  }

  spawn(playerS) {
    const L = this.track.length;
    // pas d'événement en tunnel, sur pont ni dans une divergence de bretelle : plusieurs essais
    const T0 = this.track;
    let s0 = null;
    for (let tries = 0; tries < 10 && s0 == null; tries++) {
      const c = wrap(playerS + 1150 + this.rand() * 900, L);
      let ok = true;
      for (const d of [0, 120, 250]) {
        const q = wrap(c + d, L);
        if (T0.coverAt(q) || T0.onBridge(q) || T0.lanesAt(q) < 4 || (T0.ramps && T0.ramps.at(q, 0).some((o) => !o.parallel && o.g < 3))) { ok = false; break; }
      }
      if (ok) s0 = c;
    }
    if (s0 == null) return;
    // travaux surtout la nuit (fermetures 22 h 30 – 5 h) ; accidents à toute heure, plus fréquents en trafic dense
    const h = this.hour ?? 14, night = h >= 21.5 || h < 5.5;
    const pW = night ? 0.7 : 0.18;
    const u = this.rand();
    // v22 : pannes et contrôles routiers sur la bande dérasée de droite (fréquents de jour)
    const pP = night ? 0.12 : 0.34;
    if (u < pP) this.spawnShoulder(s0);
    else if (u < pP + (1 - pP) * pW) this.spawnRoadworks(s0);
    else this.spawnAccident(s0);
  }

  // ---------- chantier (v20) ----------------------------------------------
  // Le plus souvent la nuit (22 h 30 – 5 h) comme sur le vrai périph : remorque
  // à flèche lumineuse loin en amont, long biseau de cônes, camion de
  // protection avec atténuateur de choc et flèche, barrières à lampes
  // clignotantes, engin (raboteuse), agents en orange.
  spawnRoadworks(s0) {
    // v21 : balisage tel qu'on le voit en France sur voie rapide — fourgon(s)
    // d'intervention à flèche lumineuse, long biseau de cônes, zone de travaux
    // derrière des cônes (et la nuit, un vrai chantier : barrières à lampes,
    // camion, parfois une raboteuse), agents en orange.
    const track = this.track, L = track.length;
    const h = this.hour ?? 14, night = h >= 21.5 || h < 5.5;
    const big = night && this.rand() < 0.55;          // chantier de nuit
    const len = (big ? 190 : 120) + this.rand() * 90;
    const right = this.rand() < 0.7;
    const two = big && this.rand() < 0.35;
    const lanes = right ? (two ? [2, 3] : [3]) : (two ? [0, 1] : [0]);
    const s1 = wrap(s0 + len, L);
    const e = this.newEvent('travaux', s0, s1, lanes);
    const cones = [], statics = [];
    const closedEdge = right ? laneCenter(Math.min(...lanes)) - CFG.LANE_WIDTH / 2 : laneCenter(Math.max(...lanes)) + CFG.LANE_WIDTH / 2;
    const openEdge = right ? laneCenter(Math.max(...lanes)) + CFG.LANE_WIDTH / 2 : laneCenter(Math.min(...lanes)) - CFG.LANE_WIDTH / 2;
    const midClosed = (closedEdge + openEdge) / 2;
    const taper = 60 + this.rand() * 25;
    const arrow = right ? 'left' : 'right';
    // fourgon de protection en tête de biseau, flèche de rabattement
    this.patrolVan(e, s0 + 2, midClosed + (right ? 0.25 : -0.25), 0, { arrow, pmv: 'TRAVAUX' });
    // fourgon de pré-signalisation ~130 m en amont, dans la voie neutralisée (le périph n'a
    // pas de bande d'arrêt d'urgence) : la neutralisation commence à lui
    if (this.rand() < 0.6) {
      const sp = wrap(s0 - 115 - this.rand() * 40, L);
      this.patrolVan(e, sp, midClosed, 0, { arrow, pmv: 'RALENTIR' });
      e.s0 = sp;
    }
    // biseau puis alignement de cônes (espacement réglementaire plus serré dans le biseau)
    for (let d = 9; d < len; d += d < taper ? 6 : 10) {
      const t = clamp((d - 9) / taper, 0, 1);
      this.addCone(cones, e, s0 + d, openEdge + (closedEdge - openEdge) * t + (right ? 0.15 : -0.15));
    }
    // fin de chantier : cônes en biseau de sortie
    for (let d = 0; d < 30; d += 6) this.addCone(cones, e, s1 - 30 + d, closedEdge + (openEdge - closedEdge) * 0 + (right ? 0.15 : -0.15) + (d / 30) * (right ? 1 : -1) * 0.2);
    // agents + matériel dans la zone
    const nW = 2 + ((this.rand() * 3) | 0);
    for (let k = 0; k < nW; k++) {
      const pose = pick(this.rand, ['stand', 'arms', 'point', 'stand']);
      this.addPerson(e, { ...OUTFITS.worker, pose }, s0 + taper + 25 + this.rand() * (len - taper - 40), midClosed + (this.rand() - 0.5) * 2.0, this.rand() * Math.PI * 2);
    }
    if (big) {
      for (let d = taper + 40; d < len - 20; d += 24) this.barrierWithLamp(e, statics, s0 + d, closedEdge + (right ? 0.6 : -0.6));
      const truck = this.factory.build('municipal', { color: 0x3d5f43 });
      this.placeVehicle(e, truck, wrap(s0 + len * 0.72, L), midClosed, 0.04);
      if (truck.beacon) e.strobes.push(truck.beacon);
      if (this.rand() < 0.6) this.planer(e, statics, s0 + len * 0.5, midClosed);
    } else if (this.rand() < 0.5) {
      // petite intervention de jour : second fourgon dans la zone
      this.patrolVan(e, s0 + taper + 30, midClosed, 0.02, { arrow, pmv: 'TRAVAUX' });
    }
    for (const dz of [200, 380]) this.roadSign(e, s0 - dz, right, dz === 200 ? 'TRAVAUX' : `TRAVAUX ${dz} m`);
    this.finalize(e, cones, statics);
    this.world.setVMSAhead(wrap(s0 - 500, L), ['TRAVAUX', right ? 'VOIE DE DROITE NEUTRALISEE' : 'VOIE DE GAUCHE NEUTRALISEE']);
  }

  // ---------- v22 : véhicule arrêté sur la bande dérasée / BAU de droite --------
  //  • « panne » : véhicule en détresse à cheval sur la bande dérasée, feux de détresse,
  //    triangle 30 m en amont, occupants en gilet derrière / contre la DBA, parfois la
  //    dépanneuse déjà arrivée devant, plateau baissé ;
  //  • « contrôle » : voiture interceptée suivie de la voiture de police (gyrophares),
  //    un policier à la portière, un autre qui surveille le trafic.
  // La voie de droite est neutralisée au droit (le périph n'a presque jamais de vraie BAU).
  spawnShoulder(s0) {
    const L = this.track.length, R = this.track.ramps;
    const kind = this.rand() < 0.55 ? 'panne' : 'controle';
    const sV = wrap(s0 + 60, L);
    const B = R ? R.barrier(sV) : { face: ROAD_OUTER - 0.3, R: ROAD_OUTER - 0.9 };
    const ids = ['lutece', 'mistral', 'aurore', 'concorde', 'riviera', 'atlas', 'odyssee', 'cargo', 'pro_plomb', 'livr_expr', 'auto_ecole'];
    const id = pick(this.rand, ids);
    const car = this.factory.build(id, { forPlayer: true, color: this.randColor() });
    car._own = true;
    const W = car.ud.W;
    // collé à la DBA (roues droites sur le talon), donc mordant sur la voie de droite
    const latV = B.face - 0.12 - W / 2;
    const len = 90 + this.rand() * 30;
    const e = this.newEvent(kind === 'panne' ? 'panne' : 'controle', s0, wrap(s0 + len, L), [3]);
    const cones = [], statics = [];
    this.placeVehicle(e, car, sV, latV, -0.025);
    this.hazards(e, car);
    if (kind === 'panne') {
      // triangle de présignalisation 30 m en amont, contre la DBA
      this.warnTriangle(cones, e, wrap(sV - 30, L), B.face - 0.35);
      const nP = 1 + ((this.rand() * 2) | 0);
      for (let k = 0; k < nP; k++) {
        this.addPerson(e, { ...OUTFITS.driver, pose: k === 0 ? 'phone' : pick(this.rand, ['arms', 'stand']) }, sV - 6 - k * 1.6, B.face - 0.25, Math.PI * (0.3 + this.rand() * 0.4));
      }
      if (this.rand() < 0.45) {   // dépanneuse arrivée devant, gyrophare orange
        const tow = this.factory.build('depanneuse', { color: 0xd9b430 });
        this.placeVehicle(e, tow, wrap(sV + 10, L), B.face - 0.12 - tow.ud.W / 2, -0.02);
        this.hazards(e, tow);
        if (tow.beacon) e.strobes.push(tow.beacon);
        this.addPerson(e, { ...OUTFITS.depanneur, pose: 'point' }, sV + 4, latV - W / 2 - 0.5, -Math.PI / 2);
      }
    } else {
      const pol = this.factory.build(this.rand() < 0.75 ? 'police' : 'crs', {});
      this.placeVehicle(e, pol, wrap(sV - 9, L), B.face - 0.12 - pol.ud.W / 2 - 0.25, -0.03);
      this.blueLights(e, pol);
      this.hazards(e, pol);
      this.addPerson(e, { ...OUTFITS.policeVest, pose: 'stand' }, sV + 0.6, latV - W / 2 - 0.45, -Math.PI / 2);
      this.addPerson(e, { ...OUTFITS.policeVest, pose: 'wave' }, sV - 16, latV - 0.6, Math.PI);
      this.warnTriangle(cones, e, wrap(sV - 34, L), B.face - 0.35);
    }
    // quelques cônes en biseau devant le véhicule le plus en amont
    for (let k = 0; k < 4; k++) this.addCone(cones, e, sV - (kind === 'panne' ? 20 : 26) + k * 4, B.face - 0.3 - k * 0.45);
    this.finalize(e, cones, statics);
  }

  // triangle de présignalisation rouge (réfléchissant) posé au sol
  warnTriangle(cones, e, s, lat) {
    const T = this.T, p = this._p;
    this.track.pointAt(s, p);
    const g = new T.CylinderGeometry(0.26, 0.26, 0.03, 3, 1, true);
    g.rotateX(Math.PI / 2);
    g.rotateY(Math.atan2(p.tx, p.tz));
    const n = g.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = 0.9; col[i * 3 + 1] = 0.08; col[i * 3 + 2] = 0.06; }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    xform(g, { x: p.x + p.rx * lat, y: p.y + 0.24, z: p.z + p.rz * lat });
    cones.push(g);
  }

  // ---------- accident (v20) ------------------------------------------------
  // Scène selon l'ancienneté de l'accident :
  //  • « frais » : véhicules immobilisés de travers, feux de détresse, débris,
  //    conducteurs en gilet jaune réfugiés le long de la glissière (l'un téléphone) ;
  //  • « police » : voiture de police garée en protection en amont, gyrophares,
  //    biseau de cônes, policier qui fait ralentir et serrer ;
  //  • « dépannage » : + dépanneuse à plateau (un véhicule déjà chargé),
  //    fourgon jaune à flèche lumineuse 100 m en amont, parfois les pompiers.
  // Ralentissement « de curiosité » des deux côtés.
  spawnAccident(s0, opts = {}) {
    const T = this.T, track = this.track, L = track.length;
    const r = this.rand();
    const phase = opts.phase || (r < 0.32 ? 'frais' : r < 0.72 ? 'police' : 'depannage');
    const laneA = opts.lane ?? (this.rand() < 0.6 ? 2 + ((this.rand() * 2) | 0) : (this.rand() * 2) | 0);
    const side = this.rand() < 0.5 ? 1 : -1;
    const laneB = this.rand() < 0.55 ? laneA : clamp(laneA + side, 0, CFG.LANES - 1);
    const lanes = [...new Set([laneA, laneB])].sort();
    const ids = ['lutece', 'mistral', 'aurore', 'concorde', 'riviera', 'atlas', 'odyssee', 'taxi', 'cargo'];
    const lead = phase === 'frais' ? 0 : phase === 'police' ? 45 : 140; // protection en amont
    const len = lead + 40 + this.rand() * 20;
    const sAcc = wrap(s0 + lead + 18, L);
    const s1 = wrap(s0 + len, L);
    const e = this.newEvent('accident', s0, s1, lanes);
    e.phase = phase;
    const cones = [], statics = [];
    const towed = phase === 'depannage' && (opts.towed ?? this.rand() < 0.6);
    // véhicules accidentés (carrosseries enfoncées), feux de détresse
    const carB = this.factory.build(opts.ids?.[1] || pick(this.rand, ids), { forPlayer: true, color: opts.cols?.[1] ?? this.randColor() });
    carB._own = true;
    this.placeVehicle(e, carB, wrap(sAcc + 7.5, L), laneCenter(laneB) + side * 0.3, -side * (0.25 + this.rand() * 0.35));
    this.dent(carB, -1, 0.8);
    this.hazards(e, carB);
    let carA = null;
    if (!towed) {
      carA = this.factory.build(opts.ids?.[0] || pick(this.rand, ids), { forPlayer: true, color: opts.cols?.[0] ?? this.randColor() });
      carA._own = true;
      this.placeVehicle(e, carA, sAcc, laneCenter(laneA) - side * 0.2, side * (0.15 + this.rand() * 0.45));
      this.dent(carA, 1, 0.9);
      this.hazards(e, carA);
    }
    this.debris(e, statics, sAcc + 3, laneCenter(laneA), 5 + this.rand() * 4);
    // automobilistes en gilet, à l'abri le long de la glissière la plus proche
    const nearRight = laneA >= 2;
    const latSafe = nearRight ? (this.track.ramps?.barrier ? this.track.ramps.barrier(sAcc).face - 0.32 : ROAD_OUTER - 0.4) : (this.track.ramps ? this.track.ramps.medianHalfAt(sAcc) + 0.62 : CFG.LATERAL_MIN - 0.55);
    const nP = 2 + ((this.rand() * 2) | 0);
    for (let k = 0; k < nP; k++) {
      this.addPerson(e, { ...OUTFITS.driver, pose: k === 0 ? 'phone' : pick(this.rand, ['stand', 'arms', 'stand']) }, sAcc + 4 + k * 2.2, latSafe + (this.rand() - 0.5) * 0.25, Math.PI * (0.4 + this.rand() * 1.2));
    }
    if (phase !== 'frais') {
      // voiture de police en protection, de biais, gyrophares
      const pol = this.factory.build('police', {});
      const sPol = wrap(sAcc - 28, L);
      this.placeVehicle(e, pol, sPol, laneCenter(laneA) - side * 0.4, side * 0.35);
      this.blueLights(e, pol);
      this.hazards(e, pol);
      this.addPerson(e, { ...OUTFITS.policeVest, pose: 'wave' }, sAcc - 40, laneCenter(laneA) + (laneA >= 2 ? -1.4 : 1.4), Math.PI);
      // biseau de cônes depuis la voiture de police
      const lo = Math.min(...lanes), hi = Math.max(...lanes);
      const openSide = lo > 0 ? -1 : 1;
      const edge = openSide < 0 ? laneCenter(lo) - CFG.LANE_WIDTH / 2 + 0.2 : laneCenter(hi) + CFG.LANE_WIDTH / 2 - 0.2;
      const far = openSide < 0 ? laneCenter(hi) + 1.0 : laneCenter(lo) - 1.0;
      for (let d = 0; d < 26; d += 4) this.addCone(cones, e, sPol - 30 + d, far + (edge - far) * (d / 26));
      for (let d = 0; d < 60; d += 6) this.addCone(cones, e, sPol - 4 + d, edge);
    } else {
      // tout frais : quelques conducteurs ont mis leurs warnings plus haut, pas de balisage
      e.slowExtra = 1;
    }
    if (phase === 'depannage') {
      // fourgon d'intervention à flèche lumineuse 100 m en amont, dans la voie neutralisée (zone tampon)
      this.patrolVan(e, s0 + 8, laneCenter(laneA), 0, { arrow: laneA >= 2 ? 'left' : 'right', pmv: 'ACCIDENT' });
      for (let d = -40; d < 6; d += 5) this.addCone(cones, e, s0 + d, laneCenter(laneA) + (laneA >= 2 ? -1 : 1) * (CFG.LANE_WIDTH / 2) * (1 - (d + 40) / 46) + (laneA >= 2 ? -1 : 1) * 0.2);
      // dépanneuse à plateau devant, véhicule chargé ou en attente
      const tow = this.factory.build('depanneuse', {});
      this.placeVehicle(e, tow, wrap(sAcc + 20, L), laneCenter(laneA), 0.04);
      if (tow.beacon) e.strobes.push(tow.beacon);
      if (towed) {
        const loaded = this.factory.build(pick(this.rand, ids), { forPlayer: true, color: this.randColor() });
        loaded._own = true;
        this.dent(loaded, 1, 0.9);
        e.group.add(loaded.group);
        loaded.group.position.copy(tow.group.position);
        loaded.group.position.y += 1.05;
        loaded.group.rotation.y = tow.group.rotation.y;
        loaded.group.translateZ(-1.2);
        e.vehicles.push(loaded);
      }
      this.addPerson(e, { ...OUTFITS.depanneur, pose: 'stand' }, sAcc + 13, laneCenter(laneA) + 1.3, Math.PI * 0.5);
      if (this.rand() < 0.35) {
        const vs = this.factory.build('pompiers', {});
        this.placeVehicle(e, vs, wrap(sAcc - 12, L), laneCenter(laneB === laneA ? clamp(laneA + (laneA >= 2 ? -1 : 1), 0, 3) : laneB), 0.05);
        this.blueLights(e, vs);
        for (let k = 0; k < 2; k++) this.addPerson(e, { ...OUTFITS.pompier, pose: 'stand' }, sAcc - 2 + k * 3, laneCenter(laneA) + 1.2 * (k ? -1 : 1), this.rand() * 6);
      }
    }
    for (const dz of [150, 320]) this.roadSign(e, s0 - dz, true, 'ACCIDENT');
    this.finalize(e, cones, statics);
    this.world.setVMSAhead(wrap(s0 - 500, L), ['ACCIDENT', laneA >= 2 ? 'VOIE DE DROITE NEUTRALISEE' : 'VOIE DE GAUCHE NEUTRALISEE']);
    return e;
  }

  // ---------- fourgon d'intervention (v21) ------------------------------------
  // Fourgon jaune fluo à chevrons + équipement de toit : flèche lumineuse de
  // rabattement (matrice de feux jaunes ronds), PMV à LED « RALENTIR / TRAVAUX »,
  // rampe de feux à éclats jaunes, gyrophares bleus à l'avant.
  patrolVan(e, s, lat, yaw, { arrow = 'left', pmv = 'RALENTIR', shoulder = false } = {}) {
    const T = this.T, L = this.track.length;
    const van = this.factory.build('patrouilleur', { color: 0xd5e81e });
    this.placeVehicle(e, van, wrap(s, L), lat, yaw);
    const g = van.group, ud = van.ud;
    const H = Math.max(ud.H, 2.2), zr = -ud.L / 2 + 0.55;
    const frameM = this.frameMat || (this.frameMat = new T.MeshLambertMaterial({ color: 0x1b1d20 }));
    const greyM = this.greyM || (this.greyM = new T.MeshLambertMaterial({ color: 0x8d9298 }));
    const housM = this.housM || (this.housM = new T.MeshBasicMaterial({ color: 0x4a3410 }));
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
    // galerie de toit + vérins
    add(new T.BoxGeometry(1.7, 0.06, 2.6), greyM, 0, H + 0.05, -0.2);
    for (const x of [-0.7, 0.7]) add(new T.BoxGeometry(0.06, 0.55, 0.06), greyM, x, H + 0.32, zr + 0.15);
    // panneau flèche relevé (face vers l'arrière)
    const bw = 1.8, bh = 1.25, yB = H + 0.62 + bh / 2;
    add(new T.BoxGeometry(bw, bh, 0.12), frameM, 0, yB, zr);
    const disc = this.discG || (this.discG = new T.CircleGeometry(0.075, 14));
    const pat = arrow === 'right'
      ? ['....X..', '.....X.', 'XXXXXXX', '.....X.', '....X..']
      : arrow === 'left' ? ['..X....', '.X.....', 'XXXXXXX', '.X.....', '..X....']
        : ['X.....X', '.X...X.', '..X.X..', '.X...X.', 'X.....X']; // croix : voie fermée
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 7; c++) {
        const x = -(c - 3) * 0.22, y = yB + (2 - r) * 0.22; // motif écrit tel que vu de l'arrière
        // vue de l'arrière : la droite de l'observateur est la gauche du véhicule (+X local)
        add(disc, housM, x, y, zr - 0.065, Math.PI);
        if (pat[r][c] === 'X') e.blinkers.push(add(disc, this.arrowOn, x, y, zr - 0.068, Math.PI));
      }
    }
    // rampe de feux à éclats jaunes au sommet du panneau
    for (let k = 0; k < 6; k++) {
      const b = add(new T.CylinderGeometry(0.07, 0.07, 0.11, 10), this.arrowOn, (k - 2.5) * 0.3, yB + bh / 2 + 0.07, zr);
      (k % 2 ? e.blinkers : e.strobes).push(b);
    }
    // PMV à LED sous la flèche
    const pm = new T.Mesh(new T.PlaneGeometry(1.7, 0.34), new T.MeshBasicMaterial({ map: ledTexture(T, pmv), toneMapped: false }));
    pm.position.set(0, H + 0.42, zr - 0.07); pm.rotation.y = Math.PI; g.add(pm);
    add(new T.BoxGeometry(1.78, 0.4, 0.1), frameM, 0, H + 0.42, zr + 0.01);
    // gyrophares bleus avant + feux à éclats jaunes arrière
    for (const sd of [-1, 1]) {
      e.strobes.push(add(new T.CylinderGeometry(0.08, 0.08, 0.14, 10), this.blueMat, sd * 0.7, H + 0.12, ud.L / 2 - 0.9));
      e.blinkers.push(add(new T.CylinderGeometry(0.07, 0.07, 0.1, 10), this.arrowOn, sd * 0.78, H + 0.1, zr + 0.4));
    }
    this.hazards(e, van);
    if (shoulder) e.obstacles[e.obstacles.length - 1].wid = ud.W;
    return van;
  }

  // ---------- éléments de scène ----------------------------------------------
  randColor() { return pick(this.rand, [0xf2f3f5, 0x1d1f23, 0x9aa1a8, 0x5d6670, 0x8e1b1b, 0x1d3f73, 0xd7d1c4, 0x2d4a3a]); }

  // carrosserie enfoncée à l'avant (front = 1) ou à l'arrière (-1)
  dent(bundle, front, sev) {
    const geom = bundle.mesh.geometry;
    const pos = geom.getAttribute('position');
    if (!pos) return;
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const L = bb.max.x - bb.min.x;
    const xi = front > 0 ? bb.max.x : bb.min.x;
    const arr = pos.array, zc = (this.rand() - 0.5) * 0.8;
    for (let i = 0; i < pos.count; i++) {
      const dx = Math.abs(arr[i * 3] - xi);
      if (dx > L * 0.22) continue;
      const k = (1 - dx / (L * 0.22)) * sev * 0.28 * (1 - Math.min(1, Math.abs(arr[i * 3 + 2] - zc) / 1.4) * 0.5);
      arr[i * 3] -= front * k;
      arr[i * 3 + 1] -= k * 0.25 * Math.max(0, arr[i * 3 + 1] - 0.5);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  }

  hazards(e, bundle) {
    const T = this.T, ud = bundle.ud;
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const q = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.06), this.arrowOn);
      q.position.set(x * (ud.W / 2 - 0.12), (ud.yBot || 0.4) + 0.42, z * (ud.L / 2 + 0.02));
      bundle.group.add(q);
      e.blinkers.push(q);
    }
  }

  blueLights(e, bundle) {
    const T = this.T, m = bundle.spec || {}, ud = bundle.ud;
    const b = m.beacon || { x: ud.L * 0.12, y: ud.H + 0.07, z: 0.32 };
    for (const sd of [-1, 1]) {
      const q = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 0.22), this.blueMat);
      q.position.set(sd * b.z, b.y, b.x);
      bundle.group.add(q);
      (sd < 0 ? e.strobes : e.blinkers).push(q);
    }
  }

  debris(e, statics, s, lat, spread) {
    const T = this.T, track = this.track, p = this._p;
    for (let k = 0; k < 26; k++) {
      track.pointAt(wrap(s + (this.rand() - 0.3) * spread * 1.6, track.length), p);
      const l = lat + (this.rand() - 0.5) * spread;
      const big = this.rand() < 0.3;
      const g = new T.BoxGeometry(big ? 0.35 : 0.08 + this.rand() * 0.1, 0.03, big ? 0.22 : 0.08 + this.rand() * 0.1);
      const col = big ? pick(this.rand, [0x1b1c1f, 0x2a2c30, 0x8e1b1b, 0x9aa1a8]) : (this.rand() < 0.6 ? 0xcfd8de : 0x3a3d42);
      statics.push(colorize(T, xform(g, { x: p.x + p.rx * l, y: p.y + 0.02, z: p.z + p.rz * l, ry: this.rand() * 6 }), col));
    }
  }

  // remorque à flèche lumineuse (FLR) : panneau noir, chevrons orange clignotants
  arrowTrailer(e, statics, s, lat, toLeft) {
    const T = this.T, track = this.track, p = this._p;
    track.pointAt(wrap(s, track.length), p);
    const ry = Math.atan2(p.tx, p.tz);
    statics.push(colorize(T, xform(new T.BoxGeometry(1.7, 0.6, 2.2), { x: p.x + p.rx * lat, y: p.y + 0.5, z: p.z + p.rz * lat, ry }), 0xf2c200));
    statics.push(colorize(T, xform(new T.BoxGeometry(2.0, 1.6, 0.12), { x: p.x + p.rx * lat, y: p.y + 1.85, z: p.z + p.rz * lat, ry }), 0x15171a));
    this.chevrons(e, p, lat, p.y + 1.85, toLeft, -0.08);
    e.obstacles.push({ s: wrap(s, track.length), lat, len: 2.4, wid: 2.0, v: 0 });
  }
  chevrons(e, p, lat, y, toLeft, back) {
    const T = this.T;
    const dir = toLeft ? 1 : -1; // pointe vers la voie restée ouverte
    for (let k = 0; k < 3; k++) {
      for (const sgn of [1, -1]) {
        const q = new T.Mesh(new T.PlaneGeometry(0.5, 0.11), this.arrowOn);
        const off = (k - 1) * 0.42 * dir;
        q.position.set(p.x + p.rx * (lat + off) + p.tx * back, y + sgn * 0.14, p.z + p.rz * (lat + off) + p.tz * back);
        q.rotation.set(0, Math.atan2(p.tx, p.tz) + Math.PI, sgn * dir * 0.75);
        e.group.add(q);
        e.blinkers.push(q);
      }
    }
  }
  // atténuateur de choc + flèche à l'arrière d'un fourgon de protection
  attenuator(e, statics, bundle, toLeft) {
    const T = this.T, ud = bundle.ud;
    const g = bundle.group;
    const box = new T.Mesh(new T.BoxGeometry(ud.W * 0.95, 0.75, 1.1), new T.MeshLambertMaterial({ color: 0xf2c200 }));
    box.position.set(0, 0.75, -ud.L / 2 - 0.6);
    g.add(box);
    for (let k = 0; k < 4; k++) {
      const st = new T.Mesh(new T.PlaneGeometry(0.18, 0.75), new T.MeshBasicMaterial({ color: 0x15171a }));
      st.position.set(-ud.W * 0.36 + k * ud.W * 0.24, 0.75, -ud.L / 2 - 1.16);
      st.rotation.set(0, Math.PI, 0.6);
      g.add(st);
    }
    const panel = new T.Mesh(new T.BoxGeometry(1.5, 1.1, 0.08), new T.MeshLambertMaterial({ color: 0x15171a }));
    panel.position.set(0, ud.H + 0.55, -ud.L / 2 + 0.2);
    g.add(panel);
    const dir = toLeft ? -1 : 1; // repère du fourgon : la droite du véhicule = -X local
    for (let k = 0; k < 3; k++) for (const sgn of [1, -1]) {
      const q = new T.Mesh(new T.PlaneGeometry(0.38, 0.09), this.arrowOn);
      q.position.set(-(k - 1) * 0.36 * dir, ud.H + 0.55 + sgn * 0.11, -ud.L / 2 + 0.15);
      q.rotation.set(0, Math.PI, -sgn * dir * 0.75);
      g.add(q);
      e.blinkers.push(q);
    }
  }
  barrierWithLamp(e, statics, s, lat) {
    const T = this.T, track = this.track, p = this._p;
    track.pointAt(wrap(s, track.length), p);
    const ry = Math.atan2(p.tx, p.tz);
    statics.push(colorize(T, xform(new T.BoxGeometry(0.12, 0.25, 2.4), { x: p.x + p.rx * lat, y: p.y + 0.85, z: p.z + p.rz * lat, ry }), this.rand() < 0.5 ? 0xd94f30 : 0xe8eaed));
    for (const dz of [-1.1, 1.1]) statics.push(colorize(T, xform(new T.BoxGeometry(0.08, 0.85, 0.08), { x: p.x + p.rx * lat + p.tx * dz, y: p.y + 0.42, z: p.z + p.rz * lat + p.tz * dz, ry }), 0x9aa1a8));
    const lamp = new T.Mesh(new T.SphereGeometry(0.08, 6, 4), this.arrowOn);
    lamp.position.set(p.x + p.rx * lat, p.y + 1.08, p.z + p.rz * lat);
    e.group.add(lamp);
    (this.rand() < 0.5 ? e.blinkers : e.strobes).push(lamp);
    e.obstacles.push({ s: wrap(s, track.length), lat, len: 2.4, wid: 0.3, v: 0 });
  }
  // raboteuse : châssis, cabine, tapis d'évacuation incliné
  planer(e, statics, s, lat) {
    const T = this.T, track = this.track, p = this._p;
    track.pointAt(wrap(s, track.length), p);
    const ry = Math.atan2(p.tx, p.tz);
    const at = (dx, dy, dz) => ({ x: p.x + p.rx * (lat + dx) + p.tx * dz, y: p.y + dy, z: p.z + p.rz * (lat + dx) + p.tz * dz, ry });
    statics.push(colorize(T, xform(new T.BoxGeometry(2.3, 1.0, 5.2), at(0, 0.75, 0)), 0xd9a400));
    statics.push(colorize(T, xform(new T.BoxGeometry(2.4, 0.5, 5.0), at(0, 0.25, 0)), 0x1d1f22));
    statics.push(colorize(T, xform(new T.BoxGeometry(1.5, 1.1, 1.4), at(0, 1.8, -0.8)), 0x2a2d31));
    const belt = xform(new T.BoxGeometry(0.8, 0.25, 4.5).rotateX(-0.42), at(0, 2.2, 4.2));
    statics.push(colorize(T, belt, 0x2a2d31));
    const b = new T.Mesh(new T.BoxGeometry(0.2, 0.12, 0.2), this.arrowOn);
    b.position.set(at(0, 2.45, -0.8).x, p.y + 2.45, at(0, 2.45, -0.8).z);
    e.group.add(b); e.blinkers.push(b);
    e.obstacles.push({ s: wrap(s, track.length), lat, len: 6, wid: 2.5, v: 0 });
  }
  addPerson(e, outfit, s, lat, face) {
    const T = this.T, track = this.track, p = this._p;
    const sw = wrap(s, track.length);
    track.pointAt(sw, p);
    const g = personGeometry(T, { ...outfit, rnd: this.rand });
    g.rotateY(Math.atan2(p.tx, p.tz) + face);
    g.translate(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
    const m = new T.Mesh(g, this.coneMat);
    m.castShadow = true;
    e.group.add(m);
    e.geoms.push(g);
    e.obstacles.push({ s: sw, lat, len: 0.5, wid: 0.6, v: 0 });
  }
  roadSign(e, s, rightSide, label) {
    const T = this.T, track = this.track, p = this._p;
    const sSign = wrap(s, track.length);
    track.pointAt(sSign, p);
    const lat2 = rightSide ? track.mainEdgeAt(sSign) + 1.6 : -0.9;
    const sign = new T.Mesh(new T.PlaneGeometry(2.2, 0.75), new T.MeshBasicMaterial({ map: worksPanelTexture(T, label) }));
    sign.position.set(p.x + p.rx * lat2, p.y + 1.4, p.z + p.rz * lat2);
    sign.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
    e.group.add(sign);
  }

  // ---------- aides ---------------------------------------------------------
  newEvent(type, s0, s1, lanes) {
    const e = {
      type, s0, s1, lanes, opened: true,
      group: new this.T.Group(), geoms: [], vehicles: [],
      obstacles: [], blinkers: [], strobes: [],
    };
    this.scene.add(e.group);
    this.active.push(e);
    return e;
  }

  addCone(cones, e, s, lat) {
    const T = this.T, track = this.track;
    const sw = wrap(s, track.length);
    track.pointAt(sw, this._p);
    const p = this._p;
    const cone = new T.CylinderGeometry(0.05, 0.19, 0.55, 7);
    // bandes : orange + blanc via couleurs de sommets (haut blanc)
    const posA = cone.getAttribute('position');
    const colArr = new Float32Array(posA.count * 3);
    for (let i = 0; i < posA.count; i++) {
      const y = posA.getY(i);
      const white = y > 0.05 && y < 0.18;
      colArr[i * 3] = white ? 0.95 : 0.95;
      colArr[i * 3 + 1] = white ? 0.95 : 0.35;
      colArr[i * 3 + 2] = white ? 0.92 : 0.08;
    }
    cone.setAttribute('color', new T.BufferAttribute(colArr, 3));
    xform(cone, { x: p.x + p.rx * lat, y: p.y + 0.28, z: p.z + p.rz * lat });
    cones.push(cone);
    e.obstacles.push({ s: sw, lat, len: 0.42, wid: 0.42, v: 0, cone: true });
  }

  placeVehicle(e, bundle, s, lat, yaw) {
    const track = this.track;
    track.pointAt(s, this._p);
    const p = this._p;
    bundle.group.position.set(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
    bundle.group.rotation.y = Math.atan2(p.tx, p.tz) + yaw;
    e.group.add(bundle.group);
    e.vehicles.push(bundle);
    e.obstacles.push({ s, lat, len: bundle.ud.L, wid: bundle.ud.W + 0.15, v: 0 });
  }

  finalize(e, cones, statics) {
    const T = this.T;
    if (cones.length) {
      const merged = mergeGeoms(T, cones);
      e.group.add(new T.Mesh(merged, this.coneMat));
      e.geoms.push(merged);
      for (const c of cones) c.dispose();
    }
    if (statics.length) {
      const merged = mergeGeoms(T, statics);
      e.group.add(new T.Mesh(merged, this.world.mats.concrete));
      e.geoms.push(merged);
      for (const s of statics) s.dispose();
    }
  }

  dispose(e) {
    this.scene.remove(e.group);
    for (const g of e.geoms) g.dispose();
    for (const v of e.vehicles) if (v._own) v.mesh.geometry.dispose();
  }

  reset() {
    for (const e of this.active) this.dispose(e);
    this.active = [];
    this.nextAt = 2200;
    this.lapBoost = 1;
  }
}

// PMV à LED orange (matrice de points) sur fond noir
const _led = new Map();
function ledTexture(T, text) {
  if (_led.has(text)) return _led.get(text);
  const W = 512, H = 100;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b0c0d'; c.fillRect(0, 0, W, H);
  // texte rendu en basse définition puis échantillonné en points ronds
  const lo = document.createElement('canvas'); lo.width = 128; lo.height = 20;
  const l = lo.getContext('2d');
  l.fillStyle = '#000'; l.fillRect(0, 0, 128, 20);
  l.fillStyle = '#fff'; l.font = 'bold 15px sans-serif'; l.textAlign = 'center'; l.textBaseline = 'middle';
  l.fillText(text, 64, 11);
  const d = l.getImageData(0, 0, 128, 20).data;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 128; x++) {
    const on = d[(y * 128 + x) * 4] > 110;
    c.fillStyle = on ? '#ffa31a' : '#231a0c';
    c.beginPath(); c.arc(x * 4 + 2, y * 5 + 2.5, on ? 1.9 : 1.1, 0, Math.PI * 2); c.fill();
  }
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  _led.set(text, t);
  return t;
}

function loopDeltaE(a, b, L) { let d = (a - b) % L; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }

function loopBehind(playerS, s, L) {
  return wrap(playerS - s, L);
}
