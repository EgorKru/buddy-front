// Telegram Web подход: Service Worker для кеширования медиа и ресурсов
// Это создает впечатление мгновенной загрузки, как в Telegram

const CACHE_NAME = 'buddy-chat-v1';
const IMAGE_CACHE_NAME = 'buddy-images-v1';
const MEDIA_CACHE_NAME = 'buddy-media-v1';

// Ресурсы для предзагрузки и кеширования
const STATIC_RESOURCES = [
  '/',
  '/chats',
  '/login',
  '/register',
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_RESOURCES);
    })
  );
  self.skipWaiting(); // Активируем сразу
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем старые кеши
          if (cacheName !== CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME && 
              cacheName !== MEDIA_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Берем контроль над всеми клиентами
});

// Telegram Web подход: кешируем все изображения и медиа
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Кешируем изображения
  if (url.pathname.includes('/api/chats/') && 
      (url.pathname.includes('/files/') || url.pathname.includes('/images/'))) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          // Если есть в кеше - возвращаем сразу (как в Telegram)
          if (response) {
            return response;
          }
          
          // Если нет в кеше - загружаем и кешируем
          return fetch(event.request).then((fetchResponse) => {
            // Кешируем только успешные ответы
            if (fetchResponse.status === 200) {
              cache.put(event.request, fetchResponse.clone());
            }
            return fetchResponse;
          }).catch(() => {
            // При ошибке сети возвращаем пустой ответ
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
  
  // Для остальных запросов - стратегия Network First (как в Telegram)
  if (STATIC_RESOURCES.some(resource => url.pathname === resource)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
    return;
  }
  
  // Для API запросов - всегда из сети (не кешируем)
  if (url.pathname.startsWith('/api/')) {
    return; // Пропускаем, пусть идет обычный fetch
  }
});

// Очистка старых кешей (Telegram Web подход)
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

