# Pager Frontend

Frontend приложение для платформы Pager с поддержкой real-time мессенджера, видеозвонков и системы контроля состояния.

## Версия 2.0 MVP

**Что нового:**
- Система регистрации с подтверждением email (6-значный код)
- Улучшенный UI/UX с интерактивным фоном и отслеживанием курсора
- API проксирование через Next.js для решения CORS
- Оптимизация производительности интерактивного фона
- Улучшенные формы с валидацией и модальным окном

## Технологический стек

- Next.js 13.5, React 18
- WebSocket (STOMP) - Native + SockJS fallback
- Service Worker для кеширования
- PeerJS для WebRTC видеозвонков
- Tailwind CSS, CSS Modules
- Lucide React для иконок

## Архитектура

- REST API для HTTP операций
- WebSocket для real-time обновлений
- Система последовательностей (seq/pts) для контроля целостности
- Service Worker для кеширования медиа
- Курсорная пагинация для истории сообщений

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

Создайте файл `.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_NATIVE_URL=wss://pager.website/ws-native
NEXT_PUBLIC_WS_SOCKJS_URL=https://pager.website/ws
NODE_ENV=development
```

**Разработка:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_NATIVE_URL=ws://localhost:8080/ws-native
```

**Продакшн:**
```bash
NEXT_PUBLIC_API_URL=https://pager.website/api
NEXT_PUBLIC_WS_NATIVE_URL=wss://pager.website/ws-native
```

## Структура проекта

```
buddy-front/
├── pages/              # Next.js страницы
├── component/          # React компоненты
├── context/            # State Management
├── hooks/              # Custom hooks
├── utils/              # Утилиты и API
├── styles/             # CSS модули
└── public/             # Статические файлы (SW, workers)
```

## Основные страницы

- `/` - Главная (видеокомнаты)
- `/login` - Вход
- `/register` - Регистрация с подтверждением email
- `/chats` - Список чатов
- `/chat/[chatId]` - Чат с сообщениями
- `/[roomId]` - Видеокомната

## Функциональность

- Real-time мессенджер с WebSocket
- Отправка текстовых, файловых и голосовых сообщений
- Редактирование и удаление сообщений
- Закрепление сообщений
- Поиск в чатах и сообщениях
- Видеозвонки через WebRTC
- Уведомления и онлайн-статус

## Лицензия

Apache 2.0
