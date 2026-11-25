// Chatbot service worker
// Təhlükəsizlik: yazışmalar, Supabase və başqa domen sorğuları HEÇ VAXT keşlənmir.
// Yalnız tətbiqin öz statik faylları (qabıq) keşlənir.

const CACHE = 'chatbot-shell-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Bir fayl tapılmasa belə quraşdırma pozulmasın
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

  // Səhifə açılışı: əvvəl şəbəkə, internet yoxdursa keşdən
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Statik fayllar: əvvəl keş, sonra şəbəkə
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
