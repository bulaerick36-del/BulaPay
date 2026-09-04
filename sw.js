const CACHE_NAME = 'bulapay-v307';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/auth.js',
  './js/supervisor.js',
  './js/agent_v6.js',
  './js/customer.js',
  './js/app.js',
  './assets/logo.svg'
];

// 1. Instalar el Service Worker y forzar la activación inmediata (skipWaiting)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell v307');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activar y purgar de inmediato cualquier versión de caché antigua (v193, v197, v198, etc.)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Reclamando clientes para control inmediato');
      return self.clients.claim();
    })
  );
});

// 3. Estrategia Network-First estricta para navegación y archivos HTML
self.addEventListener('fetch', (e) => {
  const url = e.request ? e.request.url : '';

  // Excluir esquemas no HTTP/HTTPS (como mailto:, tel:) y peticiones de orígenes externos
  if (!url || url.startsWith('mailto:') || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return;
  }

  if (!url.startsWith(self.location.origin)) {
    return;
  }

  const isHTMLRequest = e.request.mode === 'navigate' || 
                        (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) || 
                        url.endsWith('.html') || 
                        url.includes('index.html');

  if (isHTMLRequest) {
    // ESTRATEGIA NETWORK FIRST PARA NAVEGACIÓN Y ARCHIVOS HTML
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn('[Service Worker] Sin conexión. Sirviendo HTML desde caché fallback.');
          return caches.match(e.request).then((cachedResponse) => {
            return cachedResponse || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Estrategia Network-First para activos estáticos (JS, CSS, Imágenes)
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
