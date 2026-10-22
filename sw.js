const CACHE = 'emanaratul-v2'; // naikkan versi agar cache lama terhapus

const BASE = self.registration.scope; // mis. https://user.github.io/emanaratul/

const ASSETS = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // JANGAN cache request ke script.google.com (iframe GAS)
  if (e.request.url.indexOf('script.google.com') !== -1) {
    return; // biarkan network langsung
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
