# Pager Frontend

Frontend приложение для платформы Pager с поддержкой real-time мессенджера, видеозвонков и системы контроля состояния (State Management) по аналогии с Telegram Web.

## Версия 2.0 MVP

### Что нового в версии 2.0:

- ✨ **Система регистрации с подтверждением email** - полный цикл регистрации с отправкой 6-значного кода подтверждения
- 🎨 **Улучшенный UI/UX** - интерактивный фон с оптимизированной производительностью, отслеживание курсора глазами Pager
- 🔧 **API проксирование через Next.js** - решение проблем с CORS через серверные API routes
- 🚀 **Оптимизация производительности** - интерактивный фон оптимизирован, предотвращено накопление частиц и лаги
- 💅 **Улучшенные формы** - добавлено поле подтверждения пароля, валидация, модальное окно для ввода кода
- 🎯 **UX улучшения** - видимый ввод кода подтверждения, таймеры, возможность повторной отправки кода

## Технологический стек

- **Next.js 13.5** - React фреймворк с SSR
- **React 18** - UI библиотека
- **WebSocket (STOMP)** - Native WebSocket + SockJS fallback
- **Service Worker** - кеширование медиа и ресурсов
- **PeerJS** - WebRTC для видеозвонков
- **Tailwind CSS** - утилитарная CSS библиотека
- **CSS Modules** - модульные стили
- **Lucide React** - иконки

## Архитектура системы

### Общая структура

Система построена на клиент-серверной архитектуре с использованием REST API и WebSocket для real-time коммуникации. Основные компоненты:

- **REST API** - для стандартных HTTP операций (CRUD, поиск, загрузка файлов)
- **WebSocket (STOMP)** - для real-time обновлений (новые сообщения, редактирования, удаления, статусы)
- **Система последовательностей (seq/pts)** - для контроля целостности данных и Gap Recovery
- **Service Worker** - для кеширования медиа и создания эффекта мгновенной загрузки
- **Курсорная пагинация** - для плавной загрузки истории сообщений

### Слои приложения

```
┌─────────────────────────────────────┐
│      Pages (Next.js Routes)         │
├─────────────────────────────────────┤
│      Components (UI Components)     │
├─────────────────────────────────────┤
│      Hooks (Business Logic)          │
├─────────────────────────────────────┤
│      Context (State Management)     │
├─────────────────────────────────────┤
│      Utils (API, Helpers)           │
├─────────────────────────────────────┤
│      Service Worker (Caching)       │
└─────────────────────────────────────┘
```

## Система контроля состояния (State Management)

### Концепция

Система реализует механизм последовательностей (seq/pts) по аналогии с Telegram для обеспечения:

- Гарантированной доставки сообщений
- Обнаружения пропущенных обновлений
- Восстановления пропущенных данных (Gap Recovery)
- Синхронизации состояния между устройствами

### Глобальная последовательность (seq)

**seq** - глобальный счетчик обновлений для каждого пользователя. Клиент хранит `localSeqRef` и обновляет его при получении WebSocket сообщений с полем `seq`.

### Персональный временной штамп (pts)

**pts** - счетчик обновлений для конкретного чата и пользователя. Клиент хранит `localPtsRef` (Map<chatId, pts>) и обновляет его при получении WebSocket сообщений с полем `pts`.

### Механизм Gap Recovery

При обнаружении разрыва в последовательности (например, `received_pts > local_pts + 1`), клиент автоматически запрашивает пропущенные обновления:

```javascript
// В hooks/useChatRealtime.js
if (receivedPts > currentLocalPts + receivedPtsCount) {
  handleGapRecovery(chatId, currentLocalPts + 1, receivedPts);
}
```

Клиент вызывает `GET /api/chats/{chatId}/updates?fromPts={local_pts + 1}&limit=100` и применяет все пропущенные обновления.

### Синхронизация при подключении

При подключении клиента через WebSocket, сервер отправляет событие `STATE_SYNC` в очередь `/user/queue/state-sync`. Клиент обрабатывает это событие в `context/socket.js` и `pages/chat/[chatId].js`:

```javascript
// Подписка на STATE_SYNC
stompClient.subscribe('/user/queue/state-sync', (message) => {
  const stateData = safeJsonParse(message.body);
  if (stateData?.eventType === 'STATE_SYNC') {
    window.dispatchEvent(new CustomEvent('state-sync', { detail: stateData }));
  }
});
```

Клиент сравнивает полученное состояние с локальным и при необходимости запрашивает Gap Recovery для каждого чата с расхождениями.

## Оптимизация загрузки данных

### Стратегия единого запроса состояния

Для избежания множественных последовательных HTTP-запросов при инициализации чата используется стратегия единого запроса состояния.

**Endpoint для полной загрузки состояния:**

```
GET /api/chats/{chatId}/state/full?messageLimit=100
```

Возвращает все необходимое для первичного рендеринга одним запросом:

- Информация о чате и участниках
- Последние N сообщений (по умолчанию 100)
- Закрепленные сообщения
- Текущие read states
- Последовательности (seq/pts) пользователя для этого чата
- Флаг наличия дополнительных сообщений
- ID самого старого сообщения для курсорной пагинации

**Реализация:**

```javascript
// В pages/chat/[chatId].js
const loadChatStateFull = useCallback(async (chatId) => {
  const state = await chatAPI.getChatStateFull(chatId, 100);
  // Обработка всех данных одним запросом
}, [chatId]);
```

**Преимущества:**

- Вместо 9+ последовательных запросов → 1 запрос
- Быстрая первичная загрузка
- Меньше нагрузка на сервер
- Плавный рендеринг без микрообновлений

### Курсорная пагинация

Для загрузки истории сообщений используется курсорная пагинация вместо page-based, что обеспечивает плавное скольжение без прыжков.

**Endpoint для загрузки более старых сообщений:**

```
GET /api/chats/{chatId}/messages/before?beforeId={messageId}&limit=100
```

Или по дате:

```
GET /api/chats/{chatId}/messages/before?beforeDate={timestamp}&limit=100
```

**Реализация:**

```javascript
// В pages/chat/[chatId].js
const loadOlderMessages = useCallback(async (beforeMessageId) => {
  const messages = await chatAPI.getMessagesBefore(chatId, beforeMessageId, 100);
  // Добавляем в начало списка и обновляем oldestMessageId
  setOldestMessageId(messages[messages.length - 1].id);
}, [chatId]);
```

**Преимущества:**

- Точное позиционирование в истории
- Нет дублирования сообщений при параллельных запросах
- Эффективная работа с большими объемами данных
- Поддержка виртуального скроллинга на клиенте

### Рекомендуемый порядок загрузки

1. **Инициализация чата:** Один запрос к `/state/full` → отрисовка последних сообщений
2. **Параллельно:** Установка WebSocket-соединения для live-обновлений
3. **Лениво:** По мере прокрутки вверх → подгрузка истории через `/messages/before`

## Service Worker для кеширования

### Концепция

Service Worker реализует стратегию кеширования медиа и ресурсов по аналогии с Telegram Web для создания эффекта мгновенной загрузки.

**Файл:** `public/sw.js`

**Стратегии кеширования:**

- **Изображения** - Cache First (сначала кеш, затем сеть)
- **Медиа файлы** - Cache First (аудио, видео)
- **Статические ресурсы** - Network First (страницы, стили)

**Регистрация:**

```javascript
// В pages/_app.js
function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}
```

**Результат:**

- Изображения загружаются из кеша (1ms, как в Telegram)
- Медиа файлы кешируются автоматически
- Минимум HTTP-запросов - все из Service Worker кеша
- Эффект "всегда загружено", как в Telegram Web

## Плавная прокрутка и загрузка сообщений

### Telegram-подход к прокрутке

Система реализует плавную загрузку старых сообщений при прокрутке вверх, как в Telegram Web:

**Механизм сохранения позиции:**

1. **Anchor Point** - определение первого видимого сообщения перед загрузкой
2. **Сохранение позиции** - запись позиции сообщения относительно viewport через `getBoundingClientRect`
3. **Восстановление позиции** - корректировка скролла после добавления новых сообщений
4. **Непрерывная корректировка** - на 60fps для учета загрузки изображений

**Реализация:**

```javascript
// В pages/chat/[chatId].js
// Сохранение anchor point
const anchorMessage = findFirstVisibleMessage();
const anchorViewportTop = anchorMessage.getBoundingClientRect().top - containerRect.top;

// После загрузки - восстановление
const performRestore = () => {
  const currentViewportTop = anchorMessage.getBoundingClientRect().top - containerRect.top;
  const viewportDiff = currentViewportTop - anchorViewportTop;
  container.scrollTop = container.scrollTop - viewportDiff;
};
```

### Intersection Observer для предзагрузки

Система использует Intersection Observer для предзагрузки сообщений заранее, создавая впечатление "всегда загружено":

```javascript
// Sentinel элемент для отслеживания приближения к верху
const observer = new IntersectionObserver((entries) => {
  if (entry.isIntersecting && hasMore && !loadingMore) {
    loadOlderMessages(oldestMessageId);
  }
}, {
  root: container,
  rootMargin: '800px 0px 0px 0px', // Предзагрузка за 800px
  threshold: 0,
});
```

## Оптимизация производительности

### Оптимизация рендеринга сообщений

Для минимизации лишних перерисовок реализован оптимизированный компонент `MessageRow`:

**Компонент:** `component/MessageRow/index.js`

**Оптимизации:**

- **React.memo** с кастомной функцией сравнения - предотвращает перерисовку, если пропсы не изменились
- **useMemo** для вычисляемых значений (readMeta, isPinned, showDate, isSearchMatch)
- **useCallback** для стабильных функций рендеринга

**Реализация:**

```javascript
const MessageRow = React.memo(({ msg, ... }) => {
  const readMeta = useMemo(() => {
    return getReadMetaForMessage(msg);
  }, [msg.status, msg.isOptimistic]);
  
  // ... рендеринг
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения - только важные поля
  return prevProps.msg.id === nextProps.msg.id &&
         prevProps.msg.status === nextProps.msg.status &&
         // ... другие критические поля
});
```

**Результат:**

- Минимум перерисовок при обновлении одного сообщения
- Плавный скролл даже при большом количестве сообщений
- Снижение нагрузки на CPU

### Оптимизация WebSocket-обработки

Тяжелые операции обработки входящих сообщений вынесены в idle-время браузера:

**Реализация:** `hooks/useChatRealtime.js`

**Оптимизации:**

- **requestIdleCallback** - обработка файловых метаданных и localStorage в idle-время
- **Fallback** - обычное выполнение, если `requestIdleCallback` не поддерживается
- **Timeout** - ограничение времени выполнения (1000ms)

**Реализация:**

```javascript
if (typeof window !== 'undefined' && window.requestIdleCallback) {
  window.requestIdleCallback(() => {
    // Тяжелые операции: работа с localStorage, обработка файлов
    if (dto.fileSize && dto.fileName && dto.mimeType) {
      localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
    }
    upsertMessage(dto, { unreadDelta: isVisible ? 0 : undefined });
  }, { timeout: 1000 });
}
```

**Результат:**

- Не блокирует основной поток при обработке сообщений
- Плавный UI даже при большом потоке сообщений
- Оптимизация использования CPU

### Оптимизация загрузки файлов

Прогресс загрузки файлов обновляется через `requestAnimationFrame` для плавных анимаций:

**Реализация:** `utils/api.js`

**Оптимизации:**

- **XMLHttpRequest** вместо fetch для отслеживания прогресса
- **requestAnimationFrame** для обновления UI прогресса
- **onProgress callback** для передачи прогресса в компоненты

**Реализация:**

```javascript
const uploadFileWithProgress = async (url, file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        requestAnimationFrame(() => {
          onProgress(e.loaded / e.total);
        });
      }
    });
    // ... отправка файла
  });
};
```

**Результат:**

- Плавные анимации прогресса загрузки
- Синхронизация с частотой обновления экрана (60fps)
- Отзывчивый UI при загрузке больших файлов

### Web Worker для голосовых сообщений

Обработка аудио вынесена в отдельный поток для предотвращения блокировки UI:

**Файлы:**

- `public/workers/audio-worker.js` - Web Worker скрипт
- `hooks/useAudioWorker.js` - React hook для использования

**Функциональность:**

- **encodeAudio** - кодирование аудио для отправки
- **decodeAudio** - декодирование аудио для воспроизведения
- **analyzeAudio** - анализ уровня громкости и длительности
- **compressAudio** - сжатие аудио для оптимизации размера

**Использование:**

```javascript
import { useAudioWorker } from '@/hooks/useAudioWorker';

const { encodeAudio, analyzeAudio, isAvailable } = useAudioWorker();

// Анализ аудио в фоне
const analysis = await analyzeAudio(audioBuffer);
console.log('Level:', analysis.level, 'Duration:', analysis.duration);
```

**Результат:**

- Не блокирует основной поток при обработке аудио
- Готово к расширению реальной логикой кодирования/декодирования
- Масштабируемая архитектура для будущих оптимизаций

### Исправления утечек памяти

Все потенциальные утечки памяти устранены:

**Проблемы и решения:**

1. **Локальные переменные в useEffect** → заменены на `useRef`
   ```javascript
   // Было: let isRestoring = false;
   // Стало:
   const isRestoringScrollPositionRef = useRef(false);
   ```

2. **Таймеры без cleanup** → добавлены cleanup функции
   ```javascript
   useEffect(() => {
     const timeout = setTimeout(() => {}, 1000);
     return () => clearTimeout(timeout);
   }, []);
   ```

3. **Observers без disconnect** → добавлен disconnect в cleanup
   ```javascript
   useEffect(() => {
     const observer = new ResizeObserver(() => {});
     return () => observer.disconnect();
   }, []);
   ```

4. **Animation frames без cancel** → добавлен cancelAnimationFrame
   ```javascript
   useEffect(() => {
     const frameId = requestAnimationFrame(() => {});
     return () => cancelAnimationFrame(frameId);
   }, []);
   ```

### Оптимизация событий скролла

События скролла оптимизированы через throttling:

**Реализация:** `pages/chat/[chatId].js`

**Оптимизации:**

- **lodash/throttle** - ограничение частоты выполнения (100ms)
- **useRef для состояния** - уменьшение зависимостей `useCallback`
- **scrollStateRef** - хранение часто меняющихся значений

**Реализация:**

```javascript
import throttle from 'lodash/throttle';

const scrollStateRef = useRef({ hasMore, loadingMore, oldestMessageId });
const handleScrollThrottled = useCallback(
  throttle(() => {
    const state = scrollStateRef.current;
    // Логика скролла
  }, 100),
  [] // Минимум зависимостей
);
```

**Результат:**

- Снижение частоты вызовов с ~60fps до ~10fps
- Меньше нагрузки на CPU
- Плавный скролл без задержек

### Предотвращение race conditions

Использование `AbortController` для отмены устаревших запросов:

**Реализация:** `pages/chat/[chatId].js`

**Оптимизации:**

- **AbortController** - отмена предыдущих запросов при новом
- **Проверка актуальности** - обработка только последнего запроса

**Реализация:**

```javascript
const abortControllerRef = useRef(null);

const loadOlderMessages = useCallback(async (beforeMessageId) => {
  // Отменяем предыдущий запрос
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  
  abortControllerRef.current = new AbortController();
  const response = await fetch(url, {
    signal: abortControllerRef.current.signal
  });
}, []);
```

**Результат:**

- Нет дублирования запросов
- Консистентное состояние данных
- Оптимизация сетевых запросов

## WebSocket архитектура

### Подключение

**Native STOMP**

- Endpoint: `wss://pager.website/ws-native`
- Аутентификация: STOMP CONNECT headers (`Authorization: Bearer <token>`)
- Реализация: `context/socket.js`

**SockJS (fallback)**

- Endpoint: `https://pager.website/ws`
- Аутентификация: Query parameter `?token=<token>` или headers

### Топики и очереди

**Публичные топики (broadcast)**

- `/topic/chat/{chatId}` - новые сообщения в чате (с seq/pts)
- `/topic/chat/{chatId}/read` - read receipts
- `/topic/chat/{chatId}/pinned` - события закрепления/открепления
- `/topic/chat/{chatId}/deleted` - события удаления для всех

**Персональные очереди (user-specific)**

- `/user/queue/message-sent` - подтверждения отправки сообщений
- `/user/queue/message-deleted` - события удаления для себя
- `/user/queue/state-sync` - синхронизация состояния при подключении
- `/user/queue/notifications` - уведомления
- `/user/queue/presence` - обновления онлайн-статуса
- `/user/queue/errors` - ошибки

### Формат сообщений

Все сообщения через WebSocket включают поля последовательностей:

```json
{
  "seq": 12345,
  "pts": 456,
  "ptsCount": 1,
  "eventType": "MESSAGE_NEW",
  ...
}
```

**События:**

- `MESSAGE_NEW` - новое сообщение
- `MESSAGE_EDITED` - отредактированное сообщение
- `MESSAGE_DELETED_FOR_ME` - сообщение удалено для пользователя
- `MESSAGE_DELETED_FOR_ALL` - сообщение удалено для всех
- `MESSAGE_PINNED` - сообщение закреплено
- `MESSAGE_UNPINNED` - сообщение откреплено
- `STATE_SYNC` - синхронизация состояния

### Обработка сообщений

**Отправка сообщения**

- Destination: `/app/chat.sendMessage`
- Payload: `ChatMessageRequest` (chatId, type, content, fileUrl, и т.д.)
- Ответ: `MessageDto` с seq/pts в `/user/queue/message-sent` и broadcast в `/topic/chat/{chatId}`

**Редактирование сообщения**

- Destination: `/app/chat.editMessage`
- Payload: `EditMessageRequest` (messageId, chatId, content)
- Ответ: `MessageEditedEvent` с seq/pts в `/topic/chat/{chatId}`

## Структура проекта

```
buddy-front/
├── pages/                    # Next.js страницы
│   ├── _app.js              # Главный App компонент (Service Worker регистрация)
│   ├── _document.js         # HTML документ
│   ├── index.js             # Главная страница (комнаты)
│   ├── login.js             # Страница входа
│   ├── register.js          # Страница регистрации
│   ├── chats.js             # Список чатов
│   ├── chat/
│   │   └── [chatId].js      # Страница чата (основная логика)
│   └── [roomId].js          # Видеокомната
│
├── component/                # React компоненты
│   ├── ChatSidebar/         # Боковая панель с чатами
│   ├── FileMessage/         # Компонент файлового сообщения
│   ├── ImageMessage/        # Компонент изображения (lazy loading)
│   ├── VoiceMessagePlayer/  # Плеер голосовых сообщений
│   ├── PinnedMessagesHeader/# Заголовок с закрепленными сообщениями
│   ├── MessageContextMenu/  # Контекстное меню сообщения
│   ├── SelectionHeader/     # Заголовок при выборе сообщений
│   ├── GlobalNotifications/ # Глобальные уведомления
│   ├── MessageRow/          # Оптимизированный компонент сообщения (React.memo)
│   └── ...
│
├── context/                  # React Context providers
│   ├── messaging.js         # Управление чатами и сообщениями
│   ├── socket.js            # WebSocket соединение (STOMP)
│   ├── chats.js             # Управление чатами
│   └── voicePlayer.js       # Управление голосовыми сообщениями
│
├── hooks/                    # Custom React hooks
│   ├── useMessageSender.js  # Отправка сообщений (оптимистичные обновления)
│   ├── useChatRealtime.js   # Real-time логика чата (seq/pts, Gap Recovery, requestIdleCallback)
│   ├── useMessageSelection.js # Выбор сообщений
│   ├── usePinnedMessages.js # Закрепленные сообщения
│   ├── useNotifications.js # Управление уведомлениями
│   ├── useVoiceRecorder.js  # Запись голосовых сообщений
│   ├── useAudioWorker.js    # Web Worker для обработки аудио
│   └── ...
│
├── utils/                    # Утилиты
│   ├── api.js               # API клиент (REST + WebSocket helpers)
│   ├── config.js            # Конфигурация
│   ├── safe.js              # Безопасные утилиты (JSON parse, unsubscribe)
│   ├── chatHelpers.js       # Хелперы для чатов
│   ├── dateHelpers.js       # Форматирование дат
│   ├── messageQueue.js      # Очередь сообщений
│   ├── pagerSound.js        # Звук уведомлений
│   └── ...
│
├── styles/                   # CSS модули
│   ├── globals.css          # Глобальные стили
│   ├── chat.module.css      # Стили чата (анимации, скролл)
│   ├── chats.module.css     # Стили списка чатов
│   └── ...
│
├── public/                   # Статические файлы
│   ├── sw.js                # Service Worker
│   ├── workers/
│   │   └── audio-worker.js  # Web Worker для обработки аудио
│   └── favicon.ico          # Иконка
│
├── next.config.js           # Конфигурация Next.js
├── tailwind.config.js       # Конфигурация Tailwind
├── package.json             # Зависимости
└── README.md                # Документация
```

## Функциональность

### Чаты

- Создание личных и групповых чатов
- Получение списка чатов пользователя
- Получение информации о чате
- Получение полного состояния чата одним запросом (`/state/full`)
- Отметка чата как прочитанного
- Поиск чатов и участников

### Сообщения

- Отправка текстовых сообщений
- Отправка файлов (изображения, документы, голосовые)
- Редактирование сообщений
- Удаление сообщений (для себя / для всех)
- Массовое удаление сообщений
- Ответ на сообщение (reply)
- Пересылка сообщений между чатами
- Поиск сообщений в чате (серверный поиск по всем сообщениям)
- Выбор сообщений (чекбоксы, массовые операции)
- Курсорная пагинация для загрузки истории

### Закрепленные сообщения

- Закрепление сообщений в чате
- Открепление сообщений
- Получение списка закрепленных сообщений
- Навигация к закрепленному сообщению (мгновенный скролл)

### Уведомления

- Уведомления о новых сообщениях
- Уведомления о событиях в чатах
- Системные уведомления
- Звук пейджера при новых сообщениях
- Badge в браузере (favicon + title)
- Отметка уведомлений как прочитанных

### Онлайн-статус

- Отслеживание онлайн/оффлайн статуса пользователей
- Время последнего посещения
- Real-time обновления через WebSocket

### Видеозвонки

- Создание видеокомнат
- WebRTC соединения через PeerJS
- Управление аудио/видео
- Встроенный чат в видеокомнате

## API клиент

### Основные методы

**Аутентификация:**

```javascript
import { authAPI } from '@/utils/api';

await authAPI.login(username, password);
await authAPI.register(userData);
authAPI.logout();
const profile = await authAPI.getProfile();
```

**Чаты:**

```javascript
import { chatAPI } from '@/utils/api';

// Получение списка чатов
const chats = await chatAPI.getChats();

// Получение информации о чате
const chat = await chatAPI.getChat(chatId);

// Полное состояние чата (новый подход)
const state = await chatAPI.getChatStateFull(chatId, 100);
// Возвращает: { chat, messages, pinnedMessages, pts, seq, lastReadAt, hasMoreMessages, oldestMessageId }

// Курсорная пагинация
const messages = await chatAPI.getMessagesBefore(chatId, beforeMessageId, 100);
const messages = await chatAPI.getMessagesBeforeDate(chatId, beforeDate, 100);

// Старый подход (для обратной совместимости)
const response = await chatAPI.getMessages(chatId, { page: 0, size: 50 });

// Отправка сообщения
await chatAPI.sendMessage(chatId, content, type, fileUrl, replyToMessageId);

// Gap Recovery
const state = await chatAPI.getChatState(chatId);
const updates = await chatAPI.getChatUpdates(chatId, fromPts, limit);
const userState = await chatAPI.getUserState();
const userUpdates = await chatAPI.getUserUpdates(fromSeq, limit);
```

**Файлы:**

```javascript
// Загрузка файла
const response = await chatAPI.uploadFile(chatId, file);
// Возвращает: { fileUrl, fileSize, mimeType }

// Загрузка изображения
const response = await chatAPI.uploadImageFile(chatId, file);
// Возвращает: { fileUrl, fileSize, mimeType }

// Загрузка голосового сообщения
const response = await chatAPI.uploadVoiceFile(chatId, audioBlob, duration);
// Возвращает: { fileUrl, duration }

// Получение URL файла
const url = chatAPI.getFileUrl(fileUrl, download, filename);
const imageUrl = chatAPI.getImageFileUrl(fileUrl, download);
```

**Поиск:**

```javascript
// Поиск сообщений в чате (серверный поиск по всем сообщениям)
const results = await chatAPI.searchMessages(chatId, query, page, size);
```

### Авторизация

Токен JWT автоматически добавляется в заголовки всех запросов через `apiRequest` в `utils/api.js`. При 401 ошибке пользователь автоматически перенаправляется на `/login`.

## Особенности реализации

### Real-time синхронизация

- **Нормализованный store** - единый источник истины для всех данных через React Context
- **Idempотентные upserts** - безопасная обработка дубликатов через `upsertMessage`
- **Оптимистичные обновления** - мгновенный UI при отправке сообщений через `useMessageSender`
- **Gap Recovery** - автоматическое восстановление пропущенных сообщений

### Read receipts

- Отслеживание прочтения через `/topic/chat/{chatId}/read`
- Зелёные галочки для прочитанных сообщений
- Обновление в реальном времени
- Хранение состояния в `readAtByChatIdByUserId`

### Онлайн-статус

- Presence events через `/user/queue/presence`
- Обновление статуса в реальном времени
- Отображение "онлайн" или "был X минут назад"
- Функция `getOnlineStatus` в `utils/dateHelpers.js`

### Уведомления

- Звук пейджера при новых сообщениях (`utils/pagerSound.js`)
- Badge в браузере (favicon + title)
- Глобальные уведомления в стиле пейджера (`component/PagerNotification`)
- Управление через `hooks/useNotifications.js`

### Плавная прокрутка

- **Anchor Point механизм** - сохранение позиции первого видимого сообщения
- **Непрерывная корректировка** - на 60fps для учета загрузки изображений
- **ResizeObserver** - отслеживание изменений размеров изображений
- **Intersection Observer** - предзагрузка сообщений заранее
- **CSS анимации** - плавное появление новых сообщений

### Lazy Loading

- **Изображения** - загрузка только при приближении к viewport (Intersection Observer с `rootMargin: 200px`)
- **Минимальная высота** - резервирование места для изображений (`min-height: 200px`)
- **Service Worker кеш** - мгновенная загрузка из кеша

### Оптимизация производительности

- **React.memo и useMemo** - минимизация перерисовок сообщений через оптимизированный компонент `MessageRow`
- **requestIdleCallback** - обработка тяжелых операций WebSocket в idle-время браузера
- **requestAnimationFrame** - плавные анимации прогресса загрузки файлов
- **Web Worker** - обработка аудио в отдельном потоке (готово к расширению)
- **Throttling** - оптимизация событий скролла (100ms)
- **AbortController** - предотвращение race conditions при параллельных запросах
- **Memory leak fixes** - правильная очистка таймеров, observers и animation frames

## Запуск

### Development

```bash
npm install
npm run dev
```

Frontend запустится на `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker-compose up -d
```

## Конфигурация

### Переменные окружения

Создайте файл `.env.local` в корне проекта:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080/api

# WebSocket Configuration
# Native WebSocket (рекомендуется)
NEXT_PUBLIC_WS_NATIVE_URL=wss://pager.website/ws-native

# SockJS fallback (опционально)
NEXT_PUBLIC_WS_SOCKJS_URL=https://pager.website/ws

# Environment
NODE_ENV=development
```

**Важно:**

- `NEXT_PUBLIC_API_URL` - URL бэкенда с путем `/api`
- `NEXT_PUBLIC_WS_NATIVE_URL` - Native WebSocket endpoint (рекомендуется)
- `NEXT_PUBLIC_WS_SOCKJS_URL` - SockJS fallback (если native не работает)
- Если переменные не указаны, используются значения по умолчанию из `utils/config.js`

### Настройка для разных окружений

**Разработка (локально):**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_NATIVE_URL=ws://localhost:8080/ws-native
```

**Продакшн:**

```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_NATIVE_URL=wss://pager.website/ws-native
```

## Развертывание

### Автоматическое развертывание (GitHub Actions)

Проект использует GitHub Actions для автоматического деплоя на сервер:

1. При push в ветку `main` автоматически запускается workflow
2. Код клонируется на сервер
3. Docker контейнер пересобирается и перезапускается
4. Логи выводятся в GitHub Actions

Workflow файл: `.github/workflows/deploy.yml`

### Ручное развертывание с Docker

1. **Клонируйте репозиторий на сервер:**

```bash
git clone git@github.com:EgorKru/buddy-front.git
cd buddy-front
```

2. **Создайте файл `.env.production`:**

```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_NATIVE_URL=wss://pager.website/ws-native
NODE_ENV=production
```

3. **Соберите и запустите контейнер:**

```bash
docker-compose build --no-cache frontend
docker-compose up -d --force-recreate frontend
```

4. **Проверьте логи:**

```bash
docker-compose logs frontend --tail 50
```

## Основные страницы

- `/` - Главная страница (создание/вход в видеокомнаты)
- `/login` - Вход в систему
- `/register` - Регистрация нового пользователя
- `/chats` - Список всех чатов
- `/chat/[chatId]` - Открытый чат с сообщениями
- `/[roomId]` - Видеокомната с встроенным чатом

## Рефакторинг и архитектура компонентов

### Модульная структура

Проект был полностью отрефакторен для улучшения поддерживаемости и читаемости кода:

**Принципы рефакторинга:**
- Разделение логики на отдельные модули (хуки, утилиты, компоненты)
- Удаление всех комментариев (код самодокументируемый)
- Вынос повторяющейся логики в переиспользуемые функции
- Оптимизация размера компонентов (целевой размер < 200 строк)

**Примеры рефакторинга:**

**ChatSidebar** (709 → 195 строк, -72%):
- `hooks/useSidebarResize.js` - управление размером и позицией
- `hooks/useLastMessagesLoader.js` - загрузка последних сообщений
- `component/ChatSidebar/ChatListItem.js` - элемент списка чатов
- `component/ChatSidebar/CreateChatModal.js` - модальное окно создания
- `utils/chatHelpers.js` - расширенные утилиты для чатов

**MessageRow** (276 → 195 строк, -29%):
- `component/MessageRow/utils.js` - утилиты для вычислений
- `component/MessageRow/ForwardedMessage.js` - пересланные сообщения
- `component/MessageRow/ReplyMessage.js` - ответы на сообщения
- `component/MessageRow/memoComparison.js` - функция сравнения для React.memo

**FileMessage** (141 → 95 строк, -33%):
- `component/FileMessage/utils.js` - форматирование файлов и проверки

**ImageMessage** (168 → 164 строк):
- Удалены все комментарии
- Оптимизирована логика lazy loading

**MessageContextMenu** (114 → 78 строк, -32%):
- `component/MessageContextMenu/utils.js` - позиционирование и конфигурация меню

**Pager3D** (122 → 30 строк, -75%):
- `component/Pager3D/usePager3DInteraction.js` - хук для взаимодействия
- `component/Pager3D/PagerBody.js` - компонент тела пейджера

**Остальные компоненты:**
- Удалены все комментарии из всех компонентов
- Код приведен к единому стилю
- Улучшена читаемость и поддерживаемость

## Разработка

### Линтинг

```bash
npm run lint
```

### Структура кода

- **Без комментариев** - код самодокументируемый
- **Без console.log** - только необходимые логи
- **Модульная архитектура** - логика разделена на переиспользуемые модули
- **Чистый код** - следует best practices

## Лицензия

Apache 2.0
