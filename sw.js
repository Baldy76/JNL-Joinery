// Version: 1.11 | Date: April 2026
const cacheName = 'dnl-app-v1.11';
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

self.addEventListener('fetch', e => {
  e.respondWith(
    (async () => {
      const r = await caches.match(e.request);
      if (r) return r;
      return fetch(e.request);
    })()
  );
});
