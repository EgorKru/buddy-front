
const CACHE_NAME = 'buddy-chat-v2';
const IMAGE_CACHE_NAME = 'buddy-images-v2';
const MEDIA_CACHE_NAME = 'buddy-media-v2';

// Ресурсы для предзагрузки и кеширования
const STATIC_RESOURCES = [
  '/',
  '/chats',
  '/login',
  '/register',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_RESOURCES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
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
  
  // Кешируем изображения
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
  
  // Кешируем медиа файлы (аудио, видео)
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
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
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

