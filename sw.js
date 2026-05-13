// ── Control de Vacaciones — Service Worker ────────────────────
// Versión de caché: cambia este número cuando actualices la app
// para que los usuarios reciban la versión nueva automáticamente
const CACHE_NAME = 'vacaciones-v1';

// Archivos que se guardan en caché para funcionar sin internet
const ASSETS = [
  '/Control-de-Vacaciones/',
  '/Control-de-Vacaciones/index.html',
  '/Control-de-Vacaciones/manifest.json',
  '/Control-de-Vacaciones/icon-192.png',
  '/Control-de-Vacaciones/icon-512.png',
];

// ── INSTALL: guarda los archivos en caché ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ SW: archivos en caché');
      return cache.addAll(ASSETS);
    })
  );
  // Activa el nuevo SW inmediatamente sin esperar a que cierren la pestaña
  self.skipWaiting();
});

// ── ACTIVATE: elimina cachés antiguas ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('🗑 SW: eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estrategia Network First ──────────────────────────
// Intenta siempre la red primero (para tener datos frescos de Firebase)
// Si no hay internet, sirve desde caché
self.addEventListener('fetch', event => {
  // Ignorar peticiones a Firebase, CDNs y APIs externas
  // (esas siempre necesitan red y no deben cachearse aquí)
  const url = new URL(event.request.url);
  const isExternal =
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('gstatic');

  if (isExternal) return;

  // Para archivos propios: Network First con fallback a caché
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, guárdala en caché
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Sin internet: sirve desde caché
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Si no está en caché y no hay red, devuelve index.html
          return caches.match('/Control-de-Vacaciones/index.html');
        });
      })
  );
});
