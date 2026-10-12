// ============================================================
// Périph' Rush — service worker (précache versionné)
// À CHAQUE déploiement : incrémenter CACHE (periph-vN).
// Les requêtes matchent en ignoreSearch (les ?v=N de index.html).
// ============================================================

const CACHE = 'periph-v17';
const ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'vendor/three.module.min.js',
  'js/main.js', 'js/config.js', 'js/utils.js', 'js/track.js', 'js/plates.js',
  'js/signs.js', 'js/vehicles.js', 'js/world.js', 'js/weather.js', 'js/traffic.js',
  'js/events.js', 'js/player.js', 'js/score.js', 'js/progression.js',
  'js/audio.js', 'js/hud.js', 'js/game.js',
  'js/periph-data.js', 'js/geo.js', 'js/atlas.js', 'js/textures.js', 'js/scenery.js', 'js/signfont.js', 'js/survey.js', 'js/landmarks.js', 'js/fleet.js', 'js/rules.js', 'js/cockpit.js',
  'fonts/barlow-semi-condensed-latin-500-normal.woff2', 'fonts/barlow-semi-condensed-latin-600-normal.woff2',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'assets/clio3.glb',
  'assets/fleet/lutece_hi.glb', 'assets/fleet/lutece.glb', 'assets/fleet/mistral.glb', 'assets/fleet/aurore.glb', 'assets/fleet/concorde.glb', 'assets/fleet/taxi.glb', 'assets/fleet/riviera.glb', 'assets/fleet/atlas.glb', 'assets/fleet/odyssee.glb', 'assets/fleet/cargo.glb', 'assets/fleet/furia.glb',
  'assets/fleet/lutece_far.glb', 'assets/fleet/mistral_far.glb', 'assets/fleet/aurore_far.glb', 'assets/fleet/concorde_far.glb', 'assets/fleet/taxi_far.glb', 'assets/fleet/riviera_far.glb', 'assets/fleet/atlas_far.glb', 'assets/fleet/odyssee_far.glb', 'assets/fleet/cargo_far.glb', 'assets/fleet/furia_far.glb',
  'assets/fleet/lutece_ufar.glb', 'assets/fleet/mistral_ufar.glb', 'assets/fleet/aurore_ufar.glb', 'assets/fleet/concorde_ufar.glb', 'assets/fleet/taxi_ufar.glb', 'assets/fleet/riviera_ufar.glb', 'assets/fleet/atlas_ufar.glb', 'assets/fleet/odyssee_ufar.glb', 'assets/fleet/cargo_ufar.glb', 'assets/fleet/furia_ufar.glb',
  'assets/fonts/barlow-condensed-latin-600-normal.woff2', 'assets/fonts/barlow-condensed-latin-700-normal.woff2', 'assets/fonts/barlow-condensed-latin-800-italic.woff2', 'assets/fonts/barlow-condensed-latin-900-italic.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) => hit || fetch(e.request)
    )
  );
});
