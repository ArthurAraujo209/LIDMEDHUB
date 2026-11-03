const VERSION = 'v1.0.6';
const CACHE_NAME = `lidmed-hub-${VERSION}`;

// Arquivos para cache offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/offline.html',
  '/css/tokens.css',
  '/css/reset.css',
  '/css/global.css',
  '/css/pages/dashboard.css',
  '/js/dashboard.js',
  '/js/ui/site-nav.js',
  '/js/ui/theme.js',
  '/js/ui/image-editor.js',
  '/js/utils/uploadImage.js',
  '/manifest.webmanifest',
  '/assets/icons/favicon.svg',
  '/assets/icons/app-icon.svg'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativar Service Worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('lidmed-hub-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estratégia de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca cachear Firebase/Firestore
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // HTML: Network-first com fallback para cache
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // CSS/JS: Stale-while-revalidate
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Imagens e outros assets: Cache-first
  if (request.destination === 'image') {
    if (url.origin !== self.location.origin) return;

    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        });
      })
    );
    return;
  }
});
