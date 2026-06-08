/* Clash HQ service worker. Bump CACHE on every deploy so clients pick up new code. */
const CACHE = 'clashhq-v5';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/analysis-core.js', './js/profiles-core.js', './js/render.js', './js/app.js',
  './data/roster.js', './data/comps.js', './data/meta.js', './data/analysis.js',
  './data/players/shabir.json', './data/players/harendra.json', './data/players/steven.json',
  './data/players/eshantha.json', './data/players/geeth.json',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Network-first for live player data so daily refreshes show through; fall back to cache offline.
  if (url.pathname.includes('/data/players/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for the app shell.
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
  );
});
