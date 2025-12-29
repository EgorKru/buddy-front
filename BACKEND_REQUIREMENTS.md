# Требования к бэкенду для улучшенной системы отправки сообщений

## Текущая реализация фронтенда

Фронтенд реализует продвинутую систему отправки сообщений с:
- ✅ Очередью сообщений (локальное хранилище)
- ✅ Оптимистичными обновлениями UI
- ✅ Автоматическими повторными попытками
- ✅ Статусами сообщений (pending, sending, sent, failed)
- ✅ Синхронизацией при восстановлении соединения
- ✅ Fallback на REST API при недоступности WebSocket

## Что уже работает (не требует изменений)

1. **WebSocket endpoint `/app/chat.sendMessage`**
   - Принимает: `{ chatId, content, type }`
   - Отправляет сообщение в топик `/topic/chat/{chatId}`
   - ✅ Работает корректно

2. **REST API `POST /api/chats/{chatId}/messages`**
   - Принимает: `{ content, type }`
   - Возвращает: `MessageDto`
   - ✅ Работает корректно

3. **WebSocket топик `/topic/chat/{chatId}`**
   - Отправляет `MessageDto` всем подписчикам
   - ✅ Работает корректно

## Рекомендуемые улучшения (опционально)

### 1. Подтверждение отправки через WebSocket (РЕКОМЕНДУЕТСЯ)

**Текущая ситуация:**
- Фронтенд отправляет сообщение через `/app/chat.sendMessage`
- Ждет получения через `/topic/chat/{chatId}`
- Если сообщение не приходит, остается в статусе "отправляется"

**Рекомендация:**
Отправлять подтверждение отправки в персональную очередь отправителя:
- После успешной обработки сообщения отправлять в `/user/{userId}/queue/message-sent`
- Формат: `{ messageId, chatId, status: "sent", timestamp }`

**Преимущества:**
- Мгновенное подтверждение отправки
- Возможность обработать ошибки отправки
- Более надежная синхронизация

**Пример реализации на бэкенде:**
```java
@MessageMapping("/chat.sendMessage")
public void sendMessage(@Payload ChatMessageRequest request, Principal principal) {
    try {
        MessageDto message = chatService.sendMessage(request, principal.getName());
        
        // Отправка в общий топик чата
        messagingTemplate.convertAndSend("/topic/chat/" + request.getChatId(), message);
        
        // Подтверждение отправителю
        messagingTemplate.convertAndSendToUser(
            principal.getName(),
            "/queue/message-sent",
            new MessageSentConfirmation(message.getId(), request.getChatId(), "sent")
        );
    } catch (Exception e) {
        // Уведомление об ошибке отправителю
        messagingTemplate.convertAndSendToUser(
            principal.getName(),
            "/queue/message-sent",
            new MessageSentConfirmation(null, request.getChatId(), "failed", e.getMessage())
        );
    }
}
```

### 2. Статусы доставки (опционально, для будущего)

Если в будущем планируется показывать статусы "доставлено" и "прочитано":

**Новые WebSocket события:**
- `/user/{userId}/queue/message-delivered` - сообщение доставлено получателю
- `/user/{userId}/queue/message-read` - сообщение прочитано получателем

**Формат:**
```json
{
  "messageId": 123,
  "chatId": 1,
  "status": "delivered" | "read",
  "timestamp": "2025-01-01T12:00:00"
}
```

### 3. Batch отправка сообщений (опционально, для синхронизации)

Если фронтенд отправляет несколько сообщений подряд, можно добавить endpoint:
- `POST /api/chats/{chatId}/messages/batch` - отправка нескольких сообщений за раз

**Формат запроса:**
```json
{
  "messages": [
    { "content": "Сообщение 1", "type": "TEXT" },
    { "content": "Сообщение 2", "type": "TEXT" }
  ]
}
```

**Формат ответа:**
```json
{
  "messages": [MessageDto, MessageDto],
  "failed": []
}
```

## Текущие требования (критично)

### ✅ Все уже реализовано!

Текущая реализация бэкенда полностью поддерживает новую систему отправки сообщений на фронтенде:

1. ✅ WebSocket `/app/chat.sendMessage` работает
2. ✅ Топик `/topic/chat/{chatId}` отправляет сообщения
3. ✅ REST API `POST /api/chats/{chatId}/messages` работает
4. ✅ Обработка ошибок на фронтенде реализована

## Итог

**Никаких изменений на бэкенде не требуется!** 

Фронтенд полностью адаптирован под текущий API. Все улучшения (очередь, повторные попытки, статусы) работают на стороне клиента.

Рекомендуемые улучшения (п.1) можно добавить в будущем для еще более надежной работы, но они не обязательны для текущей функциональности.

