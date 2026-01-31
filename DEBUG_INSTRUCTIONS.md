# Инструкции по отладке проблемы с временем и статусами

## 🔍 Что проверить

### 1. Откройте DevTools (F12)

### 2. Перейдите на вкладку Console

### 3. Отправьте сообщение в чат

### 4. Посмотрите в консоли на сообщения:

#### Для времени сообщения:
```
[formatChatTime] Empty dateString received
```
или
```
[formatChatTime] Invalid date parsed: {
  original: "...",
  type: "...",
  parsed: ...,
  isNaN: true
}
```

**ЕСЛИ ВИДИТЕ ЭТИ СООБЩЕНИЯ:**
- Скопируйте значение `original` - это формат даты от бэкенда
- Скопируйте значение `type` - тип данных

#### Для статусов прочтения:
```
[getReadMetaForMessage] Missing data: {...}
```
или
```
[getReadMetaForMessage] Invalid msg.createdAt: ...
```
или
```
[getReadMetaForMessage] {
  msgId: ...,
  msgTime: ...,
  readCount: ...,
  isRead: ...,
  totalOthers: ...,
  chatReadMap: ...
}
```

### 5. Проверьте WebSocket сообщения

**Вкладка Network → WS (WebSocket) → Frames**

Найдите сообщение типа `MESSAGE_NEW` и посмотрите:

```json
{
  "type": "MESSAGE_NEW",
  "message": {
    "id": 123,
    "content": "Привет",
    "createdAt": "???",  ← КАКОЙ ФОРМАТ ЗДЕСЬ?
    ...
  }
}
```

### 6. Проверьте Read Receipt события

В том же WebSocket найдите сообщение на топик `/topic/chat/{chatId}/read`:

```json
{
  "chatId": 1,
  "readerId": 2,
  "readAt": "???" ← КАКОЙ ФОРМАТ ЗДЕСЬ?
}
```

---

## 📋 Что отправить мне

### Вариант 1: Если видите ошибки в консоли

Скопируйте текст ошибок из консоли, например:

```
[formatChatTime] Invalid date parsed: {
  original: "2026-01-31T12:00:00",
  type: "string",
  parsed: Invalid Date,
  isNaN: true
}
```

### Вариант 2: Если ошибок нет

1. Откройте DevTools → Network → WS
2. Найдите фрейм с сообщением
3. Скопируйте JSON и отправьте мне

---

## 🎯 Быстрая проверка

Откройте консоль браузера и выполните:

```javascript
// Проверка 1: Посмотреть первое сообщение в текущем чате
const messages = document.querySelectorAll('[data-message-id]');
console.log('Total messages:', messages.length);

// Проверка 2: Посмотреть localStorage с read receipts
console.log('Read receipts:', localStorage.getItem('readReceipts'));

// Проверка 3: Посмотреть текущего пользователя
console.log('Current user:', localStorage.getItem('user'));
```

---

## 🔧 Возможные проблемы и решения

### Проблема 1: `createdAt` приходит как число (timestamp)
**Решение:** Уже добавлена поддержка в `parseServerDate`

### Проблема 2: `createdAt` приходит как строка без timezone
**Решение:** Добавляется 'Z' для UTC в `parseServerDate`

### Проблема 3: `createdAt` приходит как `null` или `undefined`
**Причина:** Бэкенд не отправляет поле
**Решение:** Нужно исправить на бэкенде

### Проблема 4: Статусы не отображаются
**Возможные причины:**
- `readAtByChatIdByUserId` пустой (не приходят read receipts)
- WebSocket подписка `/topic/chat/{chatId}/read` не работает
- Формат `readAt` некорректный

---

## 📞 Вопросы к бэкенду

Если нужно, задайте бэкенд-разработчику эти вопросы:

1. **Какой формат возвращает `createdAt` в объекте Message?**
   - ISO 8601 с timezone: `"2026-01-31T12:00:00.000Z"`
   - ISO 8601 без timezone: `"2026-01-31T12:00:00"`
   - Unix timestamp (число): `1706700000000`
   - Unix timestamp (строка): `"1706700000000"`

2. **Какой формат возвращает `readAt` в read receipt?**
   (тот же список форматов)

3. **Отправляется ли WebSocket событие на `/topic/chat/{chatId}/read` когда кто-то прочитал сообщение?**
   - Да / Нет
   - Если да, какая структура события?

4. **Работает ли эндпоинт `/app/chat.markRead`?**
   - Да / Нет
   - Требуется ли `lastReadMessageId` в теле запроса?

---

## ✅ После получения информации

Отправьте мне:
1. Формат даты `createdAt` (скриншот или текст из консоли/Network)
2. Формат даты `readAt` (если есть)
3. Любые ошибки из консоли браузера

И я сразу исправлю код под правильный формат! 🚀
