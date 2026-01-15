
// Версионирование кеша для автоматической очистки при деплое
const CACHE_VERSION = 'v3';
const CACHE_NAME = `buddy-chat-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `buddy-images-${CACHE_VERSION}`;
const MEDIA_CACHE_NAME = `buddy-media-${CACHE_VERSION}`;

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
          // Удаляем все старые версии кеша
          if (!cacheName.startsWith('buddy-chat-') && 
              !cacheName.startsWith('buddy-images-') && 
              !cacheName.startsWith('buddy-media-')) {
            return caches.delete(cacheName);
          }
          // Удаляем кеши старых версий
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
  
  // НЕ кешируем статические файлы Next.js - они уже имеют хеши и кешируются браузером
  if (url.pathname.startsWith('/_next/static/')) {
    return; // Пропускаем - пусть браузер обрабатывает сам
  }
  
  // НЕ кешируем build manifest и SSG manifest
  if (url.pathname.includes('/_buildManifest.js') || url.pathname.includes('/_ssgManifest.js')) {
    return;
  }
  
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

