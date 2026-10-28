// ============================================================
// eManaratulQur'an — Service Worker (v6 — Install Ready)
// ============================================================
const CACHE_VERSION = 'v6';
const CACHE = 'emanaratul-' + CACHE_VERSION;
const BASE = self.location.pathname.replace(/service-worker\.js.*$/, '');

const CORE_ASSETS = [
  BASE + 'index.html',
  BASE + 'manifest.json'
];

const OPTIONAL_ASSETS = [
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'icon-192-maskable.png',
  BASE + 'icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (err) {
          console.warn('[SW] Gagal cache core:', url, err);
        }
      }
      await Promise.allSettled(
        OPTIONAL_ASSETS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (err) {
            console.warn('[SW] Gagal cache optional:', url);
          }
        })
      );
      await self.skipWaiting();
    } catch (err) {
      console.error('[SW] Install error:', err);
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('emanaratul-') && k !== CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    } catch (err) {
      console.error('[SW] Activate error:', err);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Jangan ganggu request ke script.google.com (isi iframe)
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(req));
  } else if (
    req.destination === 'image' ||
    req.destination === 'font' ||
    req.destination === 'style' ||
    req.destination === 'script'
  ) {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirstNavigate(req) {
  try {
    const fresh = await fetchWithTimeout(req, 4000);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      try { await cache.put(req, fresh.clone()); } catch (e) {}
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fallback = await caches.match(BASE + 'index.html');
    if (fallback) return fallback;
    return offlinePage();
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetchWithTimeout(req, 6000);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      try { await cache.put(req, fresh.clone()); } catch (e) {}
    }
    return fresh;
  } catch (err) {
    if (req.destination === 'image') return transparentPixel();
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function fetchWithTimeout(req, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(req).then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

function offlinePage() {
  const html =
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline</title><style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'font-family:system-ui,sans-serif;background:linear-gradient(135deg,#0D3B26,#1F8A52);' +
    'color:#fff;text-align:center;padding:24px;box-sizing:border-box}' +
    'button{padding:12px 24px;border:none;border-radius:99px;background:#C9A24A;' +
    'color:#0D3B26;font-weight:800;cursor:pointer}</style></head><body>' +
    '<div><h2>Anda Sedang Offline</h2>' +
    '<p>Sambungkan internet lalu muat ulang.</p>' +
    '<button onclick="location.reload()">Coba Lagi</button></div></body></html>';
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function transparentPixel() {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
}
