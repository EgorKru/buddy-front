

const CACHE_VERSION = 'v3';
const CACHE_NAME = `buddy-chat-${CACHE_VERSION}`;

const STATIC_RESOURCES = [
  '/',
  '/chats',
  '/login',
  '/register',
];

self.addEventListener('install', (event) => {

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          
          if (!cacheName.startsWith('buddy-chat-') && 
              !cacheName.startsWith('buddy-images-') && 
              !cacheName.startsWith('buddy-media-')) {
            return caches.delete(cacheName);
          }
          
          if (cacheName.startsWith('buddy-') && 
              cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    return; 
  }

  if (url.pathname.includes('/_buildManifest.js') || url.pathname.includes('/_ssgManifest.js')) {
    return;
  }

  if (STATIC_RESOURCES.some((resource) => url.pathname === resource)) {
    // Let the browser handle navigation; do not intercept (avoids dev/stale-cache issues).
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
    // Authenticated API responses and attachments must never be shared through
    // Cache Storage between accounts on the same device.
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

