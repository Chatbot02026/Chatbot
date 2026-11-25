// Chatbot service worker
// Təhlükəsizlik: yazışmalar, Supabase, /api və admin panel HEÇ VAXT keşlənmir.
// Yalnız tətbiqin öz statik qabığı (index.html, manifest, ikonlar) keşlənir.

const CACHE = 'chatbot-shell-v2';
const SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Bu yollar həmişə birbaşa şəbəkədən gedir
const BYPASS = [/^\/api\//, /^\/admin/, /^\/supabase-config\.js$/, /^\/sw\.js$/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Yalnız GET və yalnız öz domenimiz
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (BYPASS.some((re) => re.test(url.pathname))) return;

  // Çat səhifəsinin açılışı: əvvəl şəbəkə, internet yoxdursa keşdən
  if (req.mode === 'navigate') {
    const isHome = url.pathname === '/' || url.pathname === '/index.html';
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isHome && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => (isHome ? caches.match('/') : Response.error()))
    );
    return;
  }

  // Statik fayllar (manifest, ikonlar): əvvəl keş, sonra şəbəkə
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
