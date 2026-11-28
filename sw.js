// Chatbot service worker — v3
// Təhlükəsizlik: yazışmalar, Supabase, /api və admin panel HEÇ VAXT keşlənmir.
// Yalnız tətbiqin öz statik qabığı (index.html, manifest, ikonlar) keşlənir.
// v3: hər şey "əvvəl şəbəkə" — yeni ikon/fayl dərhal görünür,
//     keş yalnız internet olmayanda istifadə olunur.

const CACHE = 'chatbot-shell-v3';   // ad dəyişəndə köhnə keş avtomatik silinir
const SHELL = [
  '/',
  '/manifest.json?v=3',
  '/icon-192.png?v=2',
  '/icon-512.png?v=2',
  '/icon-maskable-512.png?v=2'
];

// Bu yollar həmişə birbaşa şəbəkədən gedir, keşə heç düşmür
const BYPASS = [/^\/api\//, /^\/admin/, /^\/supabase-config\.js$/, /^\/sw\.js$/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Yalnız GET və yalnız öz domenimiz (Supabase sorğularına toxunmuruq)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (BYPASS.some((re) => re.test(url.pathname))) return;

  const isNav = req.mode === 'navigate';
  const isHome = url.pathname === '/' || url.pathname === '/index.html';
  if (isNav && !isHome) return;          // başqa səhifələr keşlənmir

  // Əvvəl şəbəkə (həmişə ən təzə), internet yoxdursa keşdən
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(isNav ? '/' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(isNav ? '/' : req).then((hit) => hit || Response.error()))
  );
});
