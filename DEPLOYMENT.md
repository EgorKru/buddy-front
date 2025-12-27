# Инструкция по развертыванию фронтенда

## Подготовка

### 1. Настройка переменных окружения

Создайте файл `.env.production` в корне проекта:

```bash
NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api
NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080
NODE_ENV=production
```

**Важно:** Эти переменные должны быть доступны во время сборки Next.js приложения (`npm run build`), так как они встраиваются в клиентский код.

### 2. Настройка CORS на бэкенде

Убедитесь, что на бэкенде в переменной окружения `CORS_ALLOWED_ORIGINS` добавлен URL вашего фронтенда.

Если фронтенд будет работать на порту 3000 того же сервера:
```bash
CORS_ALLOWED_ORIGINS=http://158.160.148.204:3000
```

Или если вы используете домен:
```bash
CORS_ALLOWED_ORIGINS=http://your-frontend-domain.com,http://158.160.148.204:3000
```

## Развертывание с Docker

### Вариант 1: Docker Compose (рекомендуется)

1. **На сервере выполните:**
```bash
# Клонируйте репозиторий
git clone <your-repo-url>
cd buddy-front

# Создайте .env.production (или отредактируйте docker-compose.yml)
# Запустите контейнеры
docker-compose up -d --build

# Проверьте логи
docker-compose logs -f frontend
```

2. **Приложение будет доступно по адресу:** `http://158.160.148.204:3000`

### Вариант 2: Docker без Compose

```bash
# Сборка образа
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080 \
  -t buddy-frontend .

# Запуск контейнера
docker run -d \
  -p 3000:3000 \
  --name buddy-frontend \
  --restart unless-stopped \
  buddy-frontend
```

## Развертывание без Docker

1. **Установите Node.js 18+ на сервере:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Клонируйте репозиторий и установите зависимости:**
```bash
git clone <your-repo-url>
cd buddy-front
npm ci
```

3. **Создайте .env.production:**
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

**С PM2 (рекомендуется для production):**
```bash
npm install -g pm2
pm2 start npm --name "buddy-frontend" -- start
pm2 save
pm2 startup
```

**Или напрямую:**
```bash
npm start
```

## Настройка Nginx (опционально)

Если вы хотите использовать Nginx как reverse proxy для фронтенда на стандартном порту 80:

```nginx
server {
    listen 80;
    server_name 158.160.148.204;  # или your-domain.com

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

После настройки перезапустите Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Обновление приложения

### С Docker:
```bash
git pull
docker-compose up -d --build
```

### Без Docker:
```bash
git pull
npm ci
npm run build
pm2 restart buddy-frontend  # или npm start если не используете PM2
```

## Проверка работоспособности

1. Откройте в браузере: `http://158.160.148.204:3000`
2. Проверьте консоль браузера (F12) на наличие ошибок
3. Попробуйте выполнить вход/регистрацию
4. Проверьте, что Socket.io подключение работает (в консоли должно быть "Socket connected")

## Устранение неполадок

### Приложение не запускается

- Проверьте логи: `docker-compose logs frontend` или `pm2 logs buddy-frontend`
- Убедитесь, что порт 3000 свободен: `netstat -tulpn | grep 3000`
- Проверьте, что переменные окружения установлены правильно

### Ошибки подключения к API

- Проверьте, что бэкенд запущен и доступен по адресу `http://158.160.148.204:8080`
- Проверьте настройки CORS на бэкенде
- Проверьте firewall на сервере

### Socket.io не подключается

- Убедитесь, что `NEXT_PUBLIC_SOCKET_URL` указан правильно
- Проверьте, что на бэкенде настроен Socket.io сервер
- Проверьте настройки CORS для WebSocket соединений

