// Version: 1.15 | Date: April 2026
const cacheName = 'dnl-app-v1.15';
const staticAssets = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', async e => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
  return self.skipWaiting();
});

// NEW: Automatically delete old caches when the new version activates
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== cacheName) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    (async () => {
      const r = await caches.match(e.request);
      if (r) return r;
      return fetch(e.request);
    })()
  );
});
