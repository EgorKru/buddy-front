# Интеграция с бэкендом

Этот документ описывает, как фронтенд взаимодействует с бэкендом.

## Конфигурация

### Переменные окружения

Все настройки API находятся в переменных окружения:

- `NEXT_PUBLIC_API_URL` - базовый URL API (например: `http://localhost:8080/api`)
- `NEXT_PUBLIC_SOCKET_URL` - URL для WebSocket соединений (например: `http://localhost:8080`)

### Файл конфигурации

Основная конфигурация находится в `utils/config.js`. Этот файл централизует все настройки приложения.

## API Клиент

### Базовый метод `apiRequest`

Все API запросы проходят через метод `apiRequest` в `utils/api.js`:

```javascript
import { apiRequest } from '@/utils/api';

const data = await apiRequest('/endpoint', {
  method: 'POST',
  body: { key: 'value' }
});
```

**Особенности:**
- Автоматически добавляет токен авторизации из localStorage
- Обрабатывает 401 ошибки (перенаправляет на логин)
- Улучшенная обработка ошибок
- Поддержка разных типов ответов

### Готовые методы API

#### Аутентификация (`authAPI`)

```javascript
import { authAPI } from '@/utils/api';

// Вход
const data = await authAPI.login(username, password);
// Возвращает: { token, user }

// Регистрация
const data = await authAPI.register({ username, email, password, displayName });
// Возвращает: { token, user }

// Выход
authAPI.logout();

// Получить профиль
const profile = await authAPI.getProfile();
```

#### Чаты (`chatAPI`)

```javascript
import { chatAPI } from '@/utils/api';

// Получить список чатов
const chats = await chatAPI.getChats();

// Получить чат
const chat = await chatAPI.getChat(chatId);

// Получить сообщения
const messages = await chatAPI.getMessages(chatId, { limit: 50, offset: 0 });

// Отправить сообщение
await chatAPI.sendMessage(chatId, 'Текст сообщения');
```

#### Комнаты (`roomAPI`)

```javascript
import { roomAPI } from '@/utils/api';

// Создать комнату
const room = await roomAPI.createRoom();

// Получить информацию о комнате
const room = await roomAPI.getRoom(roomId);

// Присоединиться к комнате
await roomAPI.joinRoom(roomId);

// Покинуть комнату
await roomAPI.leaveRoom(roomId);
```

## Socket.io

### Настройка

Socket.io настраивается автоматически через `SocketProvider` в `context/socket.js`.

**Подключение:**
- Использует `NEXT_PUBLIC_SOCKET_URL` из переменных окружения
- Автоматически передает токен авторизации
- Поддерживает переподключение при разрыве связи

### Использование

```javascript
import { useSocket } from '@/context/socket';

function MyComponent() {
  const socket = useSocket();
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('event-name', (data) => {
      console.log('Received:', data);
    });
    
    socket.emit('event-name', { data: 'value' });
    
    return () => {
      socket.off('event-name');
    };
  }, [socket]);
}
```

## Обработка ошибок

### Автоматическая обработка

- **401 Unauthorized**: Автоматически очищает токен и перенаправляет на `/login`
- **Network errors**: Показывает понятное сообщение об ошибке
- **Server errors**: Парсит сообщение об ошибке из ответа сервера

### Ручная обработка

```javascript
try {
  const data = await authAPI.login(username, password);
} catch (error) {
  // error.message содержит текст ошибки
  console.error('Login failed:', error.message);
  setError(error.message);
}
```

## Утилиты

### Работа с пользователем

```javascript
import { getCurrentUser, setCurrentUser, isAuthenticated, getToken } from '@/utils/api';

// Получить текущего пользователя
const user = getCurrentUser();

// Установить пользователя и токен
setCurrentUser(user, token);

// Проверить авторизацию
if (isAuthenticated()) {
  // Пользователь авторизован
}

// Получить токен
const token = getToken();
```

## Примеры использования

### Полный пример страницы с API

```javascript
import { useState, useEffect } from 'react';
import { chatAPI, getCurrentUser } from '@/utils/api';

export default function ChatsPage() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadChats();
  }, []);
  
  const loadChats = async () => {
    try {
      setLoading(true);
      const data = await chatAPI.getChats();
      setChats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  
  return (
    <div>
      {chats.map(chat => (
        <div key={chat.id}>{chat.name}</div>
      ))}
    </div>
  );
}
```

## Рекомендации

1. **Всегда используйте готовые методы API** вместо прямых fetch запросов
2. **Обрабатывайте ошибки** в try-catch блоках
3. **Используйте loading состояния** для лучшего UX
4. **Проверяйте авторизацию** перед защищенными запросами
5. **Используйте Socket.io** для real-time обновлений вместо polling

## Troubleshooting

### Проблема: CORS ошибки

**Решение:** Убедитесь, что бэкенд настроен для работы с фронтендом:
- Добавьте фронтенд URL в CORS настройки бэкенда
- Проверьте, что заголовки авторизации разрешены

### Проблема: Socket.io не подключается

**Решение:**
- Проверьте `NEXT_PUBLIC_SOCKET_URL` в `.env.local`
- Убедитесь, что бэкенд поддерживает Socket.io
- Проверьте консоль браузера на ошибки подключения

### Проблема: 401 ошибки

**Решение:**
- Проверьте, что токен сохраняется в localStorage
- Убедитесь, что токен передается в заголовках
- Проверьте формат токена на бэкенде

