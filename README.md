# Pager Frontend

Frontend для Pager - платформы для видеозвонков и мессенджера.

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

# WebSocket Configuration (опционально, по умолчанию берется из API_URL)
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
# Альтернативно можно использовать NEXT_PUBLIC_SOCKET_URL для обратной совместимости

# Environment
NODE_ENV=development
```

**Важно:**
- `NEXT_PUBLIC_API_URL` - URL вашего бэкенда с путем `/api` в конце
- `NEXT_PUBLIC_WS_URL` - URL для WebSocket соединений (STOMP через SockJS) с путем `/ws` в конце
- Если `NEXT_PUBLIC_WS_URL` не указан, он автоматически берется из `NEXT_PUBLIC_API_URL` (заменяя `/api` на `/ws`)
- Для обратной совместимости также поддерживается `NEXT_PUBLIC_SOCKET_URL` (будет автоматически добавлен `/ws`)

### Настройка для разных окружений

**Разработка (локально):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

**Продакшн (текущий сервер):**
```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_URL=wss://pager.website/ws
```

## Развертывание на сервере

### С использованием Docker

1. **Убедитесь, что Docker и Docker Compose установлены на сервере**

2. **Клонируйте репозиторий на сервер:**
```bash
git clone <your-repo-url>
cd pager-front
```

3. **Создайте файл `.env.production` с настройками:**
```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_URL=wss://pager.website/ws
NODE_ENV=production
```

4. **Соберите и запустите контейнер:**
```bash
docker-compose up -d --build
```

5. **Приложение будет доступно по адресу:** `http://your-server-ip:3000`

### Сборка Docker образа вручную

```bash
# Сборка образа
docker build -t pager-frontend .

# Запуск контейнера
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://pager.website/api \
  -e NEXT_PUBLIC_WS_URL=wss://pager.website/ws \
  -e NODE_ENV=production \
  --name pager-frontend \
  pager-frontend
```

### Развертывание без Docker (напрямую на сервере)

1. **Установите Node.js 18+ на сервере**

2. **Клонируйте репозиторий и установите зависимости:**
```bash
git clone <your-repo-url>
cd pager-front
npm ci
```

3. **Создайте файл `.env.production`:**
```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_URL=wss://pager.website/ws
NODE_ENV=production
```

4. **Соберите приложение:**
```bash
npm run build
```

5. **Запустите production сервер:**
```bash
npm start
```

6. **Для постоянного запуска рекомендуется использовать PM2:**
```bash
npm install -g pm2
pm2 start npm --name "pager-frontend" -- start
pm2 save
pm2 startup
```

### Важные замечания

⚠️ **CORS на бэкенде:** CORS уже настроен на бэкенде для следующих origins:
- `http://localhost:3000`
- `http://localhost:3001`
- `https://pager.website`
- `http://158.160.161.57`
- `http://158.160.161.57:3000`
- `http://127.0.0.1:3000`

🔒 **Безопасность:** Для production рекомендуется использовать HTTPS и настраивать reverse proxy (nginx) для фронтенда.

🌐 **Настройка Nginx (опционально):**
Если вы хотите использовать Nginx как reverse proxy для фронтенда:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
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

WebSocket соединение (STOMP через SockJS) настраивается автоматически через `StompProvider` в `_app.js`. Подключение использует `NEXT_PUBLIC_WS_URL` или автоматически определяется из `NEXT_PUBLIC_API_URL`.

## Основные страницы

- `/` - Главная страница (создание/вход в комнаты)
- `/login` - Вход
- `/register` - Регистрация
- `/chats` - Список чатов
- `/[roomId]` - Видеокомната с чатом
