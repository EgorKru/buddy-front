# Pager Frontend

Frontend для Pager - платформы для видеозвонков и мессенджера.

## 🎉 Версия 1.0.0 - MVP (Минимально жизнеспособный продукт)

**Первая стабильная версия MVP** включает:

- **Реалтайм мессенджер** с WebSocket (STOMP)
- **Онлайн-статус пользователей** в реальном времени
- **Read receipts** (галочки прочтения сообщений)
- **Уведомления** с звуком пейджера и badge в браузере
- **Видеозвонки** через WebRTC (PeerJS)
- **Групповые и прямые чаты**
- **Авторизация и регистрация**

## Технологии

- **Next.js 13.5** - React фреймворк
- **React 18** - UI библиотека
- **@stomp/stompjs** - STOMP протокол для WebSocket
- **Native WebSocket** - прямое WebSocket соединение (без SockJS)
- **PeerJS** - WebRTC для видеозвонков
- **Tailwind CSS** - стилизация
- **Lucide React** - иконки

## Требования

- Node.js 18+
- npm или yarn

## Установка

```bash
npm install
```

## Запуск

### Разработка

```bash
npm run dev
```

Frontend запустится на `http://localhost:3000`

### Production

```bash
npm run build
npm start
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

## Архитектура

### WebSocket соединение

Приложение использует **STOMP протокол** поверх **native WebSocket**:

- **Primary:** Native WebSocket → `wss://pager.website/ws-native`
- **Fallback:** SockJS (если native не работает) → `https://pager.website/ws`

Подключение управляется через `StompProvider` в `context/socket.js`.

### State Management

Централизованное управление состоянием через React Context:

- **`MessagingProvider`** (`context/messaging.js`) - управляет чатами, сообщениями, read receipts
- **`StompProvider`** (`context/socket.js`) - управляет WebSocket соединением

### Real-time обновления

Все обновления приходят через WebSocket подписки:

- `/user/queue/messages` - новые сообщения
- `/user/queue/notifications` - уведомления
- `/user/queue/presence` - онлайн-статус пользователей
- `/topic/chat/{chatId}` - сообщения в конкретном чате
- `/topic/chat/{chatId}/read` - read receipts

## Структура проекта

```
buddy-front/
├── pages/              # Next.js страницы
│   ├── _app.js        # Главный App компонент
│   ├── index.js       # Главная страница (комнаты)
│   ├── login.js       # Страница входа
│   ├── register.js    # Страница регистрации
│   ├── chats.js       # Список чатов
│   └── chat/[chatId].js # Страница чата
│
├── component/          # React компоненты
│   ├── ChatSidebar/   # Боковая панель с чатами
│   ├── GlobalNotifications/ # Глобальные уведомления
│   ├── PagerNotification/   # Уведомления в стиле пейджера
│   └── ...
│
├── context/            # React Context providers
│   ├── messaging.js   # Управление чатами и сообщениями
│   └── socket.js      # WebSocket соединение
│
├── hooks/              # Custom React hooks
│   ├── useMessageSender.js  # Отправка сообщений
│   ├── useChatRealtime.js   # Real-time логика чата
│   ├── useNotifications.js # Управление уведомлениями
│   └── ...
│
├── utils/              # Утилиты
│   ├── api.js         # API клиент
│   ├── config.js      # Конфигурация
│   ├── safe.js        # Безопасные утилиты
│   ├── pagerSound.js  # Звук уведомлений
│   └── ...
│
└── styles/             # CSS модули
```

## Основные страницы

- `/` - Главная страница (создание/вход в видеокомнаты)
- `/login` - Вход в систему
- `/register` - Регистрация нового пользователя
- `/chats` - Список всех чатов
- `/chat/[chatId]` - Открытый чат с сообщениями
- `/[roomId]` - Видеокомната с встроенным чатом

## Работа с API

### API клиент

Проект использует централизованный API клиент в `utils/api.js`:

```javascript
import { authAPI, chatAPI, roomAPI, userAPI } from '@/utils/api';

// Аутентификация
const data = await authAPI.login(username, password);
await authAPI.register(userData);

// Чаты
const chats = await chatAPI.getChats();
const chat = await chatAPI.getChat(chatId);
const messages = await chatAPI.getMessages(chatId, { page: 0, size: 50 });
await chatAPI.sendMessage(chatId, content, type);
await chatAPI.markChatAsRead(chatId);

// Комнаты
const room = await roomAPI.createRoom();
await roomAPI.joinRoom(roomId);

// Пользователи
const users = await userAPI.searchUsers(query);
```

### Авторизация

Токен JWT автоматически добавляется в заголовки всех запросов. При 401 ошибке пользователь автоматически перенаправляется на `/login`.

### WebSocket подписки

WebSocket соединение настраивается автоматически через `StompProvider` в `_app.js`. 

Подписки управляются в:
- `context/messaging.js` - подписки на сообщения, уведомления, presence
- `hooks/useChatRealtime.js` - подписки для конкретного чата

## Особенности реализации

### Real-time синхронизация

- **Нормализованный store** - единый источник истины для всех данных
- **Idempотентные upserts** - безопасная обработка дубликатов
- **Оптимистичные обновления** - мгновенный UI при отправке сообщений

### Read receipts

- Отслеживание прочтения через `/topic/chat/{chatId}/read`
- Зелёные галочки для прочитанных сообщений
- Обновление в реальном времени

### Онлайн-статус

- Presence events через `/user/queue/presence`
- Обновление статуса в реальном времени
- Отображение "онлайн" или "был X минут назад"

### Уведомления

- Звук пейджера при новых сообщениях
- Badge в браузере (favicon + title)
- Глобальные уведомления в стиле пейджера

## Разработка

### Линтинг

```bash
npm run lint
```

### Структура кода

- **Без комментариев** - код самодокументируемый
- **Без console.log** - только необходимые логи
- **Чистый код** - следует best practices

## Лицензия

Private project
