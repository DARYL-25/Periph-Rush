// ============================================================
// Périph' Rush — point d'entrée
// Boot Three.js, machine à états (menu / garage / course / pause /
// fin), showroom garage, qualité adaptative 60 FPS, PWA.
// ============================================================

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { rng } from './utils.js';
import { Track } from './track.js';
import { PlatePool } from './plates.js';
import { VehicleFactory, CATALOG, PLAYER_IDS } from './vehicles.js';
import { World } from './world.js';
import { Ambience } from './weather.js';
import { Traffic } from './traffic.js';
import { Events } from './events.js';
import { Player } from './player.js';
import { Score } from './score.js';
import { Progression } from './progression.js';
import { GameAudio } from './audio.js';
import { UI } from './hud.js';
import { Game } from './game.js';

const canvas = document.getElementById('gl');

// ---------- boot asynchrone avec barre de progression ----------
async function boot() {
  const prog = new Progression();
  const audio = new GameAudio();
  const ui = new UI(prog, audio);
  // setTimeout (pas rAF : jamais déclenché si l'onglet charge en arrière-plan)
  const step = (pct, txt) => new Promise((r) => { ui.loading(pct, txt); setTimeout(r, 16); });

  await step(5, 'Allumage des moteurs…');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.PIXEL_RATIO_MAX));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.FOV_BASE, innerWidth / innerHeight, 0.3, 4200);

  // environnement de réflexion (studio simple) pour les carrosseries
  await step(12, 'Polissage des carrosseries…');
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x445566);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xdfe8f2 }));
    top.position.y = 12; top.rotation.x = Math.PI / 2;
    env.add(top);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshBasicMaterial({ color: 0x8fa4bd }));
    side.position.set(0, 4, -14);
    env.add(side);
    const warm = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    warm.position.set(-12, 5, 6); warm.rotation.y = Math.PI / 2.4;
    env.add(warm);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
  }

  await step(22, 'Tracé du périphérique…');
  const track = new Track();

  await step(30, 'Immatriculations préfecture…');
  const plates = new PlatePool(THREE, rng(777), 48);
  const factory = new VehicleFactory(THREE, plates);

  await step(40, 'Assemblage des véhicules…');
  // pré-chauffe des géométries des modèles courants (évite les à-coups en jeu)
  const warm = Object.keys(CATALOG);
  for (let i = 0; i < warm.length; i++) {
    factory.geometry(warm[i]);
    if (i % 8 === 7) await step(40 + (i / warm.length) * 20, 'Assemblage des véhicules…');
  }

  await step(62, 'Béton, bitume et panneaux…');
  const world = new World(THREE, scene, track);
  const ambience = new Ambience(THREE, scene, camera);
  ambience.register(world.ambienceHooks());
  ambience.register({ renderer });

  const traffic = new Traffic(THREE, scene, track, factory);
  const events = new Events(THREE, scene, track, factory, world);
  const player = new Player(THREE, scene, track, factory);
  player.input = ui.input;
  const score = new Score();
  const game = new Game({ THREE, scene, track, world, traffic, events, player, ambience, score, ui, audio });

  await step(78, 'Ouverture de la Porte Maillot…');
  player.reset(prog.data.selected, track.startS, prog.selectedColor(prog.data.selected));
  world.prebuild(track.startS);
  traffic.reset(track.startS);
  ambience.setPreset('jour', 0);
  ambience.update(0.016, player.bundle.group.position, false);

  // ---------- garage (showroom séparé) ----------
  const garageScene = new THREE.Scene();
  garageScene.background = new THREE.Color(0x11161f);
  garageScene.fog = new THREE.Fog(0x11161f, 18, 42);
  {
    const hemi = new THREE.HemisphereLight(0xcdd8e6, 0x20242c, 1.0);
    const key = new THREE.DirectionalLight(0xfff2dd, 2.2);
    key.position.set(4, 7, 6);
    const rim = new THREE.DirectionalLight(0x88b4ff, 1.4);
    rim.position.set(-6, 4, -7);
    garageScene.add(hemi, key, rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x272d38, roughness: 0.35, metalness: 0.4 }),
    );
    garageScene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(8.6, 9, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd12b }),
    );
    ring.position.y = 0.01;
    garageScene.add(ring);
  }
  const garageCam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.2, 100);
  let garageBundle = null;
  let garageEnv = null;
  function showGarageCar(id, colorIdx) {
    if (garageBundle) {
      garageScene.remove(garageBundle.group);
      garageBundle.mesh.geometry.dispose();
    }
    const color = CATALOG[id].cols[(colorIdx ?? 0) % CATALOG[id].cols.length];
    garageBundle = factory.build(id, { color, forPlayer: true });
    garageBundle.group.position.set(0, 0, 0);
    garageScene.add(garageBundle.group);
    garageScene.environment = scene.environment;
  }

  // ---------- machine à états ----------
  let state = 'menu';
  ui.show('menu');

  ui.on('play', () => {
    audio.unlock();
    state = 'running';
    game.start(prog.data.selected, prog.selectedColor(prog.data.selected));
  });
  ui.on('garage', () => {
    state = 'garage';
    ui.garageIndex = Math.max(0, PLAYER_IDS.indexOf(prog.data.selected));
    ui.garageColor = prog.data.colors[prog.data.selected] ?? 0;
    showGarageCar(prog.data.selected, ui.garageColor);
    ui.show('garage');
  });
  ui.on('garageBack', () => { state = 'menu'; ui.show('menu'); });
  ui.on('garageCar', (id, colorIdx) => showGarageCar(id, colorIdx));
  ui.on('garageColor', (id, colorIdx) => showGarageCar(id, colorIdx));
  ui.on('pause', () => {
    if (state !== 'running' || game.state !== 'running') return;
    state = 'paused';
    audio.stopEngine();
    ui.show('pause');
  });
  ui.on('resume', () => { state = 'running'; ui.showHUD(); });
  ui.on('restart', () => {
    state = 'running';
    game.start(prog.data.selected, prog.selectedColor(prog.data.selected));
  });
  ui.on('quitToMenu', () => {
    state = 'menu';
    audio.stopEngine();
    ui.show('menu');
  });
  ui.on('settings', () => {
    player.autoThrottle = prog.data.settings.autoThrottle;
    applyQuality(prog.data.settings.quality);
  });

  // déblocage audio iOS au premier geste
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  audio.setEnabled(prog.data.settings.audio);

  // pause auto quand l'app passe en arrière-plan
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'running' && game.state === 'running') {
      state = 'paused';
      audio.stopEngine();
      ui.show('pause');
    }
  });

  // ---------- qualité adaptative ----------
  let fpsEMA = 60, qualityTier = 'high', autoQuality = prog.data.settings.quality === 'auto';
  function applyQuality(q) {
    autoQuality = q === 'auto';
    const tier = autoQuality ? qualityTier : q;
    qualityTier = tier;
    const dpr = Math.min(devicePixelRatio, tier === 'high' ? 2 : tier === 'med' ? 1.6 : 1.15);
    renderer.setPixelRatio(dpr);
    traffic.quality = tier === 'high' ? 1 : tier === 'med' ? 0.8 : 0.6;
  }
  applyQuality(prog.data.settings.quality);
  let qualityTimer = 0;
  function autoTuneQuality(dt) {
    if (!autoQuality) return;
    qualityTimer += dt;
    if (qualityTimer < 3) return;
    qualityTimer = 0;
    if (fpsEMA < 47 && qualityTier !== 'low') {
      qualityTier = qualityTier === 'high' ? 'med' : 'low';
      applyQuality('auto');
    } else if (fpsEMA > 57.5 && qualityTier !== 'high') {
      qualityTier = qualityTier === 'low' ? 'med' : 'high';
      applyQuality('auto');
    }
  }

  // ---------- redimensionnement ----------
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    garageCam.aspect = camera.aspect;
    garageCam.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 250));

  await step(96, 'Dernier coup de clé à molette…');
  await step(100, 'Bonne route !');

  // ---------- boucle principale ----------
  let last = performance.now();
  let attractT = 0;
  player.updateCamera(camera, 1, true);

  const tick = (now) => {
    const rawDt = Math.min((now - last) / 1000, 0.1);
    if (rawDt <= 0) return;
    last = now;
    fpsEMA = fpsEMA * 0.95 + (1 / Math.max(rawDt, 0.001)) * 0.05;

    if (state === 'running') {
      game.update(rawDt, camera);
      autoTuneQuality(rawDt);
      if (game.state === 'over') state = 'over';
      renderer.render(scene, camera);
    } else if (state === 'garage') {
      attractT += rawDt;
      const r = 9.2 + Math.max(0, (garageBundle?.ud.L ?? 4) - 4) * 1.1;
      garageCam.position.set(Math.sin(attractT * 0.35) * r, 2.9, Math.cos(attractT * 0.35) * r);
      garageCam.lookAt(0, 0.55, 0);
      renderer.render(garageScene, garageCam);
    } else if (state === 'menu' || state === 'over' || state === 'paused') {
      if (state === 'menu') {
        attractT += rawDt;
        game.attractUpdate(rawDt, camera, attractT);
      }
      renderer.render(scene, camera);
    }
  };
  renderer.setAnimationLoop(tick);

  // hook de debug/tests (console)
  window.__periph = {
    renderer, scene, camera, track, world, traffic, events, player, game, ambience, prog,
    fps: () => fpsEMA, state: () => state, tier: () => qualityTier,
    // mini-capture : rend une frame et renvoie un JPEG data-URL (test hors écran)
    snap: (w = 420, q = 0.6) => {
      if (state === 'garage') renderer.render(garageScene, garageCam);
      else renderer.render(scene, camera);
      const src = renderer.domElement;
      const h = Math.round((w * src.height) / src.width);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(src, 0, 0, w, h);
      return cv.toDataURL('image/jpeg', q);
    },
  };
  // mode test (?test) : continue de simuler même onglet caché (rAF suspendu)
  // + avance déterministe de n frames pour les tests automatisés
  if (new URLSearchParams(location.search).has('test')) {
    setInterval(() => { if (document.hidden) tick(performance.now()); }, 33);
    window.__periph.step = (n = 1, dtMs = 16.7) => {
      for (let i = 0; i < n; i++) tick(last + dtMs);
    };
  }

  // ---------- service worker (pas en local) ----------
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((e) => {
  document.getElementById('loading-txt').textContent = 'Erreur au chargement : ' + e.message;
  console.error(e);
});
