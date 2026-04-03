const CACHE_NAME = 'inspector-app-v30';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Instalar y cachear todos los archivos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: network-first para archivos propios, cache-first para externos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isOwn = url.origin === self.location.origin;

  if (isOwn) {
    // Network-first: intenta red, si falla usa cache
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(cached => {
        return cached || caches.match('./index.html');
      }))
    );
  } else {
    // Cache-first para librerías externas (jsPDF, Lucide)
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
});
