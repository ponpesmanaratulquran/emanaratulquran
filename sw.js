// ============================================================
// eManaratulQur'an — Service Worker (v5 — Production Ready)
// ============================================================

const CACHE_VERSION = 'v5';
const CACHE = 'emanaratul-' + CACHE_VERSION;

// Tentukan BASE URL dari lokasi SW itu sendiri
// Ini lebih aman daripada self.registration.scope (yang kadang undefined)
const BASE = self.location.pathname.replace(/service-worker\.js.*$/, '');

// Asset yang WAJIB ada (dengan fallback aman)
const CORE_ASSETS = [
  BASE + 'index.html',
  BASE + 'manifest.json'
];

// Asset opsional (kalau tidak ada, tidak bikin install gagal)
const OPTIONAL_ASSETS = [
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);

        // 1. Cache asset wajib — kalau gagal, JANGAN install
        //    (pakai addOne agar tidak crash total seperti addAll)
        for (const url of CORE_ASSETS) {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (err) {
            console.warn('[SW] Gagal cache core asset:', url, err);
          }
        }

        // 2. Cache asset opsional — kalau gagal, abaikan
        await Promise.allSettled(
          OPTIONAL_ASSETS.map(async (url) => {
            try {
              await cache.add(new Request(url, { cache: 'reload' }));
            } catch (err) {
              console.warn('[SW] Gagal cache optional asset:', url);
            }
          })
        );

        // 3. Aktifkan SW segera
        await self.skipWaiting();
      } catch (err) {
        console.error('[SW] Install error:', err);
        // Tetap aktifkan agar tidak stuck di state "waiting"
        await self.skipWaiting();
      }
    })()
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Hapus cache versi lama
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('emanaratul-') && k !== CACHE)
            .map((k) => {
              console.log('[SW] Hapus cache lama:', k);
              return caches.delete(k);
            })
        );

        // Ambil kontrol semua tab yang terbuka
        await self.clients.claim();
      } catch (err) {
        console.error('[SW] Activate error:', err);
      }
    })()
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Hanya handle same-origin (jangan ganggu request ke script.google.com)
  if (url.origin !== self.location.origin) return;

  // Hanya http(s)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Strategi berdasarkan tipe request
  if (req.mode === 'navigate') {
    // Navigasi (buka halaman) → Network-first dengan offline fallback
    event.respondWith(networkFirstNavigate(req));
  } else if (
    req.destination === 'image' ||
    req.destination === 'font' ||
    req.destination === 'style' ||
    req.destination === 'script'
  ) {
    // Asset statis → Cache-first (cepat)
    event.respondWith(cacheFirst(req));
  }
  // Request lain (fetch/XHR) → biarkan browser handle (network)
});

// ---------- STRATEGI: Network-First untuk Navigasi ----------
async function networkFirstNavigate(req) {
  try {
    // Coba ambil dari network dulu (dengan timeout 4 detik)
    const fresh = await fetchWithTimeout(req, 4000);

    if (fresh && fresh.ok) {
      // Simpan ke cache (await agar benar-benar tersimpan)
      const cache = await caches.open(CACHE);
      try {
        await cache.put(req, fresh.clone());
      } catch (e) {
        // Abaikan error cache (misal quota penuh)
      }
    }

    return fresh;
  } catch (err) {
    // Network gagal → coba cache
    const cached = await caches.match(req);
    if (cached) return cached;

    // Fallback ke index.html (SPA behavior)
    const fallback = await caches.match(BASE + 'index.html');
    if (fallback) return fallback;

    // Fallback terakhir: halaman offline
    return offlinePage();
  }
}

// ---------- STRATEGI: Cache-First untuk Asset Statis ----------
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetchWithTimeout(req, 6000);

    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      try {
        await cache.put(req, fresh.clone());
      } catch (e) {
        // Abaikan error cache
      }
    }

    return fresh;
  } catch (err) {
    // Kembalikan placeholder transparan untuk gambar yang gagal
    if (req.destination === 'image') {
      return transparentPixel();
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

// ---------- HELPER: Fetch dengan Timeout ----------
function fetchWithTimeout(req, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Fetch timeout: ' + timeoutMs + 'ms'));
    }, timeoutMs);

    fetch(req)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------- HELPER: Halaman Offline ----------
function offlinePage() {
  const html =
    '<!DOCTYPE html><html lang="id"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline — eManaratulQur\'an</title>' +
    '<style>' +
    'html,body{margin:0;padding:0;height:100%;font-family:system-ui,sans-serif;' +
    'background:linear-gradient(135deg,#0D3B26,#1F8A52);color:#fff;' +
    'display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box;}' +
    '.box{max-width:360px;}' +
    'h2{margin:0 0 12px;font-size:20px;}' +
    'p{margin:0 0 20px;opacity:0.85;font-size:14px;line-height:1.5;}' +
    'button{padding:12px 24px;border:none;border-radius:99px;' +
    'background:#C9A24A;color:#0D3B26;font-weight:800;font-size:14px;' +
    'cursor:pointer;font-family:inherit;}' +
    'button:hover{filter:brightness(1.05);}' +
    '</style></head><body>' +
    '<div class="box">' +
    '<h2>📡 Anda Sedang Offline</h2>' +
    '<p>Koneksi internet terputus. Silakan sambungkan kembali lalu muat ulang halaman.</p>' +
    '<button onclick="location.reload()">🔄 Coba Lagi</button>' +
    '</div></body></html>';

  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ---------- HELPER: Placeholder Transparan ----------
function transparentPixel() {
  // 1x1 pixel PNG transparan
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
}
