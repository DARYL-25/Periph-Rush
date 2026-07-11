// ============================================================
// Périph' Rush — service worker (précache versionné)
// À CHAQUE déploiement : incrémenter CACHE (periph-vN).
// Les requêtes matchent en ignoreSearch (les ?v=N de index.html).
// ============================================================

const CACHE = 'periph-v3';
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
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
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
