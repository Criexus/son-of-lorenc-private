// Son of Lorenc – Service Worker v1.0
const CACHE_NAME = 'sol-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/app.js',
  '/assets/logo.png',
  '/config/admin.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Daten-JSON immer frisch vom Netz (never stale)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Alles andere: Cache-First
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
