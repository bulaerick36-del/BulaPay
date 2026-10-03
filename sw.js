const CACHE_NAME = 'bulapay-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/auth.js',
  './js/agent_v6.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/logo.png',
  './assets/favicon.png'
];

// 1. Instalar Service Worker y precargar shell de la aplicación
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precargando activos de la app BulaPay');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Advertencia en precarga de assets:', err);
      });
    })
  );
});

// 2. Activar Service Worker y limpiar cachés anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estrategia Network-First (Online-First) con Fallback a Caché
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Interceptar únicamente peticiones GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Excluir peticiones no HTTP/HTTPS (mailto, tel, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Excluir peticiones API a Supabase Cloud / backend para garantizar tiempo real sin respuestas en caché
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/')) {
    return;
  }

  // Ejecutar Network-First (Intenta red -> Guarda en Caché -> Si falla red, entrega Caché)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        console.warn('[Service Worker] Sin red. Buscando recurso en caché:', request.url);
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si es una navegación HTML y no hay red, servir index.html precargado
          if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
