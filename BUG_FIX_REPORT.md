# Отчет об исправлении багов

**Дата:** 30 января 2026  
**Проблемы:** Invalid Date + Сообщения не помечаются как прочитанные

---

## 🐛 Проблема 1: "Invalid Date" в сообщениях

### Симптомы:
- Вместо нормальной даты отображается "Invalid Date"
- Время сообщений некорректно

### Причина:
Функции `formatChatDate` и `formatChatTime` в `utils/dateHelpers.js`:
1. Не проверяли валидность даты после парсинга
2. Не использовали правильный парсер `parseServerDate` для дат с бэкенда
3. Бэкенд отправляет даты в формате `"2026-01-30T12:00:00"` БЕЗ timezone
4. JavaScript парсит такие даты как локальное время, что может привести к ошибкам

### Решение:

**Файл:** `utils/dateHelpers.js`

✅ **Изменения:**
1. Переместил функцию `parseServerDate` в начало файла
2. Добавил проверку валидности даты во всех функциях форматирования
3. Использовал `parseServerDate` во всех функциях (`formatChatDate`, `formatChatTime`, `formatChatListTime`)
4. Удалил дублирующую функцию `parseServerDate`

```javascript
// ДО:
export const formatChatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString); // ❌ Нет проверки валидности
  // ...
};

export const formatChatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }); // ❌ Нет проверки валидности
};

// ПОСЛЕ:
const parseServerDate = (dateString) => {
  if (!dateString) return null;
  let str = String(dateString);
  // Если дата без timezone, добавляем Z (UTC)
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('-', 10)) {
    str = str + 'Z';
  }
  return new Date(str);
};

export const formatChatDate = (dateString) => {
  if (!dateString) return '';
  const date = parseServerDate(dateString); // ✅ Правильный парсинг
  if (!date || isNaN(date.getTime())) return ''; // ✅ Проверка валидности
  // ...
};

export const formatChatTime = (dateString) => {
  if (!dateString) return '';
  const date = parseServerDate(dateString); // ✅ Правильный парсинг
  if (!date || isNaN(date.getTime())) return ''; // ✅ Проверка валидности
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
```

---

## 🐛 Проблема 2: Сообщения не помечаются как прочитанные

### Симптомы:
- Сообщения не получают статус "прочитано"
- Read receipts не отображаются корректно
- Счетчик непрочитанных не обнуляется

### Причина:
Согласно документации `FRONTEND_INTEGRATION.md`, для отметки сообщений как прочитанных нужно отправлять **WebSocket сообщение** с `lastReadMessageId`:

```javascript
// Документация требует:
function markAsRead(chatId, lastReadMessageId) {
  client.publish({
    destination: '/app/chat.markRead',
    body: JSON.stringify({
      chatId,
      lastReadMessageId, // ❗ ОБЯЗАТЕЛЬНО
    }),
  });
}
```

**Текущий код отправлял только REST API** без WebSocket!

### Решение:

#### Файл 1: `context/messaging.js`

✅ **Изменения:**
1. Добавлена отправка через WebSocket `/app/chat.markRead`
2. Получение `lastReadMessageId` из state
3. Отправка с правильными параметрами `chatId` и `lastReadMessageId`
4. Сохранен REST API как fallback

```javascript
// ДО:
const markChatAsRead = useCallback(async (chatId) => {
  if (!chatId) return;
  const currentUser = getCurrentUser();
  if (currentUser?.id) {
    const now = new Date().toISOString();
    dispatch({ 
      type: actionTypes.APPLY_READ_RECEIPT, 
      payload: { chatId, readerId: currentUser.id, readAt: now } 
    });
  }
  dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId } });
  try {
    await chatAPI.markChatAsRead(chatId); // ❌ Только REST
  } catch (e) {}
}, []);

// ПОСЛЕ:
const markChatAsRead = useCallback(async (chatId) => {
  if (!chatId) return;
  const currentUser = getCurrentUser();
  const cid = String(chatId);
  
  // Получить ID последнего сообщения в чате
  const messageIds = state.messageIdsByChatId[cid] || [];
  const lastReadMessageId = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null;
  
  // ✅ Отправить через WebSocket (согласно документации)
  if (client && connected && lastReadMessageId) {
    try {
      client.publish({
        destination: '/app/chat.markRead',
        body: JSON.stringify({
          chatId: parseInt(chatId),
          lastReadMessageId: parseInt(lastReadMessageId),
        }),
      });
    } catch (e) {
      console.error('Failed to send markRead via WebSocket:', e);
    }
  }
  
  // Локально обновить read receipt
  if (currentUser?.id) {
    const now = new Date().toISOString();
    dispatch({ 
      type: actionTypes.APPLY_READ_RECEIPT, 
      payload: { chatId, readerId: currentUser.id, readAt: now } 
    });
  }
  
  dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId } });
  
  // ✅ Также отправить через REST API как fallback
  try {
    await chatAPI.markChatAsRead(chatId);
  } catch (e) {}
}, [client, connected, state.messageIdsByChatId]);
```

#### Файл 2: `context/chats.js`

✅ **Изменения:**
1. Добавлена отправка через WebSocket с `lastReadMessageId` из `lastMessage`
2. Сохранен REST API как fallback

```javascript
// ДО:
const markChatAsRead = useCallback(async (chatId) => {
  if (!chatId) return;
  const key = String(chatId);
  const now = Date.now();
  const last = lastReadAtRef.current.get(key) || 0;
  if (now - last < 1000) return;
  lastReadAtRef.current.set(key, now);

  setChats(prev =>
    prev.map(c => (String(c.id) === key ? { ...c, unreadCount: 0 } : c))
  );

  try {
    await chatAPI.markChatAsRead(key); // ❌ Только REST
  } catch (e) {}
}, []);

// ПОСЛЕ:
const markChatAsRead = useCallback(async (chatId) => {
  if (!chatId) return;
  const key = String(chatId);
  const now = Date.now();
  const last = lastReadAtRef.current.get(key) || 0;
  if (now - last < 1000) return;
  lastReadAtRef.current.set(key, now);

  setChats(prev =>
    prev.map(c => {
      if (String(c.id) !== key) return c;
      // Получить lastReadMessageId из lastMessage чата
      const lastReadMessageId = c.lastMessage?.id;
      
      // ✅ Отправить через WebSocket если есть lastReadMessageId
      if (client && connected && lastReadMessageId) {
        try {
          client.publish({
            destination: '/app/chat.markRead',
            body: JSON.stringify({
              chatId: parseInt(key),
              lastReadMessageId: parseInt(lastReadMessageId),
            }),
          });
        } catch (e) {
          console.error('Failed to send markRead via WebSocket:', e);
        }
      }
      
      return { ...c, unreadCount: 0 };
    })
  );

  // ✅ Fallback на REST API
  try {
    await chatAPI.markChatAsRead(key);
  } catch (e) {}
}, [client, connected]);
```

---

## 📊 Измененные файлы

| Файл | Изменения | Тип проблемы |
|------|-----------|--------------|
| `utils/dateHelpers.js` | Исправлен парсинг дат | Invalid Date |
| `context/messaging.js` | Добавлена WebSocket отправка markRead | Read receipts |
| `context/chats.js` | Добавлена WebSocket отправка markRead | Read receipts |

---

## ✅ Результат

### Проблема 1: Invalid Date
- ✅ Все даты теперь парсятся правильно
- ✅ Timezone обрабатывается корректно (добавляется 'Z' если отсутствует)
- ✅ Проверка валидности даты добавлена
- ✅ Fallback на пустую строку при невалидной дате

### Проблема 2: Read receipts
- ✅ WebSocket отправка `/app/chat.markRead` добавлена
- ✅ Параметр `lastReadMessageId` передается правильно
- ✅ Соответствие документации `FRONTEND_INTEGRATION.md`
- ✅ REST API сохранен как fallback для надежности

---

## 🔍 Соответствие документации

### До исправления:
| Требование | Статус |
|------------|--------|
| Правильный парсинг дат с бэкенда | ❌ |
| WebSocket `/app/chat.markRead` | ❌ |
| Параметр `lastReadMessageId` | ❌ |

### После исправления:
| Требование | Статус |
|------------|--------|
| Правильный парсинг дат с бэкенда | ✅ |
| WebSocket `/app/chat.markRead` | ✅ |
| Параметр `lastReadMessageId` | ✅ |

---

## 🧪 Как проверить исправления

### Проверка дат:
1. Открыть любой чат
2. Проверить что даты отображаются корректно
3. Проверить время сообщений
4. Не должно быть "Invalid Date"

### Проверка read receipts:
1. Открыть чат с другого устройства/аккаунта
2. Отправить сообщение
3. Открыть чат на первом устройстве
4. Проверить что сообщение помечается как прочитанное (галочки)
5. Проверить DevTools → Network → WS → Frames
6. Должно быть сообщение с destination `/app/chat.markRead`

---

## 📝 Примечания

### Парсинг дат:
- Функция `parseServerDate` добавляет 'Z' к датам без timezone
- Это гарантирует что даты парсятся как UTC, а не локальное время
- Важно для корректного отображения времени пользователям в разных часовых поясах

### Read receipts:
- Dual approach: WebSocket (основной) + REST API (fallback)
- WebSocket быстрее и соответствует документации
- REST API обеспечивает надежность при проблемах с WebSocket

---

*Отчет составлен: 30 января 2026*
