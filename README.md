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

Убедитесь, что backend запущен на `http://localhost:8080`, или настройте переменную окружения:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

## Структура проекта

- `pages/` - Страницы Next.js
- `component/` - React компоненты
- `hooks/` - Custom React hooks
- `context/` - React Context providers
- `utils/` - Утилиты и API клиент
- `styles/` - CSS модули

## Основные страницы

- `/` - Главная страница (создание/вход в комнаты)
- `/login` - Вход
- `/register` - Регистрация
- `/chats` - Список чатов
- `/[roomId]` - Видеокомната с чатом
