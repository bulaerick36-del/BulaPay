const CACHE_NAME = 'bulapay-v355';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css?v=355',
  './js/db.js?v=355',
  './js/ads.js?v=355',
  './js/auth.js?v=355',
  './js/supervisor.js?v=355',
  './js/agent_v6.js?v=355',
  './js/customer.js?v=355',
  './js/superadmin.js?v=355',
  './js/app.js?v=355',
  './assets/logo.svg'
];

// 1. Instalar el Service Worker y forzar la activación inmediata (skipWaiting)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell bulapay-v355');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activar y purgar de inmediato cualquier versión de caché antigua
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker bulapay-v355] Purgando y auto-destruyendo caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker bulapay-v355] Reclamando clientes para control inmediato');
      return self.clients.claim();
    })
  );
});

// 3. Estrategia Network-First estricta para navegación, HTML y recursos estáticos
self.addEventListener('fetch', (e) => {
  const url = e.request ? e.request.url : '';

  // Excluir esquemas no HTTP/HTTPS (como mailto:, tel:) y peticiones a Supabase / APIs externas (Real-time Cloud-Only)
  if (!url || url.startsWith('mailto:') || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return;
  }

  // Las peticiones a Supabase Cloud NUNCA se guardan en caché para garantizar respuesta limpia en tiempo real
  if (url.includes('supabase.co') || url.includes('/rest/v1/') || !url.startsWith(self.location.origin)) {
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

  // Estrategia Network-First para activos estáticos (JS, CSS, Imágenes) con bypass de caché del navegador
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
        return caches.match(e.request);
      })
  );
});
