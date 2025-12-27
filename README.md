# Buddy Frontend

Frontend для Buddy - платформы для видеозвонков и мессенджера.

## Технологии

- Next.js 13.5
- React 18
- Socket.io Client
- PeerJS (WebRTC)
- Tailwind CSS

## Требования

- Node.js 18+
- npm или yarn

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev
```

Frontend запустится на `http://localhost:3000` (или следующем доступном порту)

## Конфигурация

### Переменные окружения

Создайте файл `.env.local` в корне проекта (можно скопировать из `.env.example`):

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080/api

# Socket.io Configuration (опционально, по умолчанию берется из API_URL)
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080

# Environment
NODE_ENV=development
```

**Важно:**
- `NEXT_PUBLIC_API_URL` - URL вашего бэкенда с путем `/api` в конце
- `NEXT_PUBLIC_SOCKET_URL` - URL для WebSocket соединений (обычно тот же хост, что и API, но без `/api`)
- Если `NEXT_PUBLIC_SOCKET_URL` не указан, он автоматически берется из `NEXT_PUBLIC_API_URL`

### Настройка для разных окружений

**Разработка (локально):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```

**Продакшн:**
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

## Структура проекта

- `pages/` - Страницы Next.js
- `component/` - React компоненты
- `hooks/` - Custom React hooks
- `context/` - React Context providers
- `utils/` - Утилиты и API клиент
  - `api.js` - API клиент с методами для работы с бэкендом
  - `config.js` - Конфигурация приложения
- `styles/` - CSS модули

## Работа с API

### Использование API клиента

Проект использует централизованный API клиент в `utils/api.js`:

```javascript
import { authAPI, chatAPI, roomAPI } from '@/utils/api';

// Аутентификация
const data = await authAPI.login(username, password);
await authAPI.register(userData);

// Работа с чатами
const chats = await chatAPI.getChats();
const messages = await chatAPI.getMessages(chatId);
await chatAPI.sendMessage(chatId, 'Текст сообщения');

// Работа с комнатами
const room = await roomAPI.createRoom();
await roomAPI.joinRoom(roomId);
```

### Авторизация

Токен автоматически добавляется в заголовки всех запросов. При 401 ошибке пользователь автоматически перенаправляется на страницу входа.

### Socket.io

WebSocket соединение настраивается автоматически через `SocketProvider` в `_app.js`. Socket.io подключается к бэкенду используя `NEXT_PUBLIC_SOCKET_URL`.

## Основные страницы

- `/` - Главная страница (создание/вход в комнаты)
- `/login` - Вход
- `/register` - Регистрация
- `/chats` - Список чатов
- `/[roomId]` - Видеокомната с чатом
