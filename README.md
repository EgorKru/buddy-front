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

**Продакшн (текущий сервер):**
```bash
NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api
NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080
```

## Развертывание на сервере

### С использованием Docker

1. **Убедитесь, что Docker и Docker Compose установлены на сервере**

2. **Клонируйте репозиторий на сервер:**
```bash
git clone <your-repo-url>
cd buddy-front
```

3. **Создайте файл `.env.production` с настройками:**
```bash
NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api
NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080
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
docker build -t buddy-frontend .

# Запуск контейнера
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api \
  -e NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080 \
  -e NODE_ENV=production \
  --name buddy-frontend \
  buddy-frontend
```

### Развертывание без Docker (напрямую на сервере)

1. **Установите Node.js 18+ на сервере**

2. **Клонируйте репозиторий и установите зависимости:**
```bash
git clone <your-repo-url>
cd buddy-front
npm ci
```

3. **Создайте файл `.env.production`:**
```bash
NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api
NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080
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
pm2 start npm --name "buddy-frontend" -- start
pm2 save
pm2 startup
```

### Важные замечания

⚠️ **CORS на бэкенде:** Убедитесь, что на бэкенде в переменной окружения `CORS_ALLOWED_ORIGINS` добавлен URL вашего фронтенда:
```bash
CORS_ALLOWED_ORIGINS=http://158.160.148.204:3000,http://your-frontend-domain.com
```

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

WebSocket соединение настраивается автоматически через `SocketProvider` в `_app.js`. Socket.io подключается к бэкенду используя `NEXT_PUBLIC_SOCKET_URL`.

## Основные страницы

- `/` - Главная страница (создание/вход в комнаты)
- `/login` - Вход
- `/register` - Регистрация
- `/chats` - Список чатов
- `/[roomId]` - Видеокомната с чатом
