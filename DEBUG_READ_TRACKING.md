# 🔍 Отладка моментального прочтения сообщений

## ✅ Что добавлено:

### 1. Подробное логирование
Теперь в консоли будут видны все события:
- `[READ TRACKING] Initializing for chat: ...`
- `[READ TRACKING] Intersection event: ...`
- `[READ TRACKING] Marking message as read: ...`
- `[READ TRACKING] Sent markRead to server: ...`
- `[MessageRow] Starting to observe message: ...`

## 🧪 Как протестировать:

### Шаг 1: Откройте DevTools
1. Нажмите `F12`
2. Перейдите на вкладку `Console`
3. Очистите консоль (Clear console)

### Шаг 2: Откройте чат как получатель
1. Зайдите в чат от имени **получателя**
2. В консоли должно появиться:
   ```
   [READ TRACKING] Initializing for chat: 123
   ```

### Шаг 3: Отправьте сообщение от другого пользователя
1. В другом браузере/вкладке зайдите от имени **отправителя**
2. Отправьте сообщение в этот чат

### Шаг 4: Смотрите консоль получателя
Должны появиться сообщения:
```
[MessageRow] Starting to observe message: { messageId: 456, isOwn: false, ... }
[READ TRACKING] Intersection event: { messageId: "456", isIntersecting: true, ... }
[READ TRACKING] Marking message as read: { chatId: 123, messageId: 456, ... }
[READ TRACKING] Sent markRead to server: { chatId: 123, lastReadMessageId: 456 }
```

### Шаг 5: Проверьте у отправителя
У отправителя должна **мгновенно** появиться галочка "прочитано" ✅

## ❌ Если ничего не появляется в консоли:

### Проблема 1: `observeMessage` не передается
**Симптом:** `[MessageRow] Cannot observe message: { hasObserveMessage: false }`

**Решение:** Проверьте, что `chatId` передается в `MessageList`

### Проблема 2: `isOwn = true` для всех сообщений
**Симптом:** `[MessageRow] Skipping own message: ...` для всех сообщений

**Решение:** Проверьте `msg.senderId` и `user.id`

### Проблема 3: Intersection Observer не срабатывает
**Симптом:** `[READ TRACKING] Initializing for chat: ...` есть, но нет `Intersection event`

**Решение:** Проверьте, что:
- Сообщение действительно видно на экране
- Элемент имеет `data-message-id`
- Контейнер сообщений прокручивается

### Проблема 4: WebSocket не подключен
**Симптом:** `[READ TRACKING] Failed to mark message as read: ...`

**Решение:** Проверьте WebSocket соединение в DevTools -> Network -> WS

## 📋 Контрольный список:

- [ ] В консоли появляется `[READ TRACKING] Initializing for chat`
- [ ] В консоли появляется `[MessageRow] Starting to observe message`
- [ ] В консоли появляется `[READ TRACKING] Intersection event`
- [ ] В консоли появляется `[READ TRACKING] Marking message as read`
- [ ] В консоли появляется `[READ TRACKING] Sent markRead to server`
- [ ] У отправителя появляется галочка "прочитано" ✅

## 🔧 Исправления:

### Исправлено 1: `useChats()` → `useMessaging()` + `useStomp()`
- **Было:** `const { client, connected, ... } = useChats()`
- **Стало:** `const { upsertReadReceipt } = useMessaging()` + `const { client, connected } = useStomp()`

### Исправлено 2: Добавлено логирование
- Теперь видно, что происходит на каждом этапе

### Исправлено 3: Увеличен rootMargin
- **Было:** `rootMargin: '50px'`
- **Стало:** `rootMargin: '100px'`

### Исправлено 4: Добавлен threshold для малой видимости
- **Было:** `threshold: [0, 0.1]`
- **Стало:** `threshold: [0, 0.01, 0.1]` (срабатывает даже при 1% видимости)

---

**Следующий шаг:** Протестируйте и посмотрите, что выводится в консоли! 🚀
