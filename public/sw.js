

const CACHE_VERSION = 'v3';
const CACHE_NAME = `buddy-chat-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `buddy-images-${CACHE_VERSION}`;
const MEDIA_CACHE_NAME = `buddy-media-${CACHE_VERSION}`;

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
              cacheName !== CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME && 
              cacheName !== MEDIA_CACHE_NAME) {
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

  if (url.pathname.startsWith('/_next/static/')) {
    return; 
  }

  if (url.pathname.includes('/_buildManifest.js') || url.pathname.includes('/_ssgManifest.js')) {
    return;
  }

  if (url.pathname.includes('/api/chats/') && 
      (url.pathname.includes('/files/') || url.pathname.includes('/images/'))) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then((fetchResponse) => {
            if (fetchResponse.status === 200) {
              cache.put(event.request, fetchResponse.clone());
            }
            return fetchResponse;
          }).catch(() => {
            return new Response('', { status: 408 });
          });
        });
      })
    );
    return;
  }

  if (url.pathname.includes('/api/chats/') && 
      (url.pathname.includes('/voice/') || url.pathname.includes('/audio/'))) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then((fetchResponse) => {
            if (fetchResponse.status === 200) {
              cache.put(event.request, fetchResponse.clone());
            }
            return fetchResponse;
          }).catch(() => {
            return new Response('', { status: 408 });
          });
        });
      })
    );
    return;
  }

  if (STATIC_RESOURCES.some(resource => url.pathname === resource)) {
    
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
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

