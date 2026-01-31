# Финальные исправления: Read Receipts и сортировка чатов

**Дата:** 31 января 2026  
**Проблемы:** 
1. Read receipts не обновляются без перезагрузки страницы
2. Статусы не отображаются в сайдбаре
3. Чаты располагаются в рандомном порядке после обновления

---

## 🐛 Корневая причина всех проблем

**Все даты с бэкенда приходят как Java LocalDateTime массив:**

```javascript
[2026, 1, 31, 17, 32, 33, 727769000]
// [год, месяц(1-12), день, час, минута, секунда, наносекунды]
```

**Проблема:** Многие функции использовали `new Date()` напрямую, который не умеет парсить массивы!

---

## ✅ Полный список исправлений

### 1. **`context/messaging.js`**

#### Проблема:
- `toIso()` использовал `new Date()` → не парсил массивы
- `getChatTime()` использовал `new Date()` → неправильная сортировка

#### Решение:
```javascript
// Добавлена функция parseServerDate
const parseServerDate = (dateString) => {
  // ... поддержка массивов Java LocalDateTime
  if (Array.isArray(dateString) && dateString.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanosecond = 0] = dateString;
    const millisecond = Math.floor(nanosecond / 1000000);
    return new Date(year, month - 1, day, hour, minute, second, millisecond);
  }
  // ... другие форматы
};

// toIso теперь использует parseServerDate
const toIso = (value) => {
  if (!value) return null;
  const date = parseServerDate(value);
  return (date && !Number.isNaN(date.getTime())) ? date.toISOString() : null;
};

// getChatTime теперь использует parseServerDate
export const getChatTime = (chat) => {
  // ... логика с parseServerDate вместо new Date()
};
```

**Эффект:**
- ✅ Read receipts правильно конвертируются в ISO
- ✅ Чаты сортируются правильно
- ✅ `readAtByChatIdByUserId` содержит корректные данные

---

### 2. **`context/chats.js`**

#### Проблема:
- `toIso()` использовал `new Date()` → не парсил массивы

#### Решение:
```javascript
// Добавлена parseServerDate
// toIso использует parseServerDate
```

**Эффект:**
- ✅ Read receipts в ChatsProvider обрабатываются корректно

---

### 3. **`pages/chats.js`**

#### Проблема:
- `getLastMessageReadMeta()` использовал `new Date()` напрямую
- Статусы прочтения не отображались в списке чатов

#### Решение:
```javascript
// Добавлена parseServerDate

const getLastMessageReadMeta = (chat) => {
  // Используем parseServerDate для msg.createdAt
  const msgDate = parseServerDate(lastMessage.createdAt);
  const msgTime = msgDate ? msgDate.getTime() : NaN;
  
  // Используем parseServerDate для readAt
  const otherReaders = Object.entries(chatReadMap)
    .map(([, readAt]) => {
      const readDate = parseServerDate(readAt);
      return readDate ? readDate.getTime() : NaN;
    })
    .filter(t => !Number.isNaN(t));
  
  // ... расчет readCount
};
```

**Эффект:**
- ✅ Статусы прочтения отображаются в списке чатов
- ✅ Иконки "прочитано" показываются корректно

---

### 4. **`component/ChatSidebar/index.js`**

#### Проблема:
- Сортировка сообщений использовала `new Date()` напрямую
- Чаты могли располагаться неправильно

#### Решение:
```javascript
// Добавлена parseServerDate

const sortedChats = useMemo(() => {
  // ...
  const chatMessages = messageIds
    .sort((a, b) => {
      const dateA = parseServerDate(a.createdAt);
      const dateB = parseServerDate(b.createdAt);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA;
    });
  // ...
}, [chats, messageIdsByChatId, messagesById]);
```

**Эффект:**
- ✅ Чаты сортируются правильно в сайдбаре
- ✅ Последнее сообщение определяется корректно

---

## 📊 Все измененные файлы

| Файл | Что исправлено |
|------|----------------|
| `utils/dateHelpers.js` | ✅ Поддержка Java LocalDateTime (уже было) |
| `components/chat/hooks/useMessageStatus.js` | ✅ parseServerDate (уже было) |
| `context/messaging.js` | ✅ parseServerDate в toIso + getChatTime |
| `context/chats.js` | ✅ parseServerDate в toIso |
| `pages/chats.js` | ✅ parseServerDate в getLastMessageReadMeta |
| `component/ChatSidebar/index.js` | ✅ parseServerDate в сортировке |

---

## 🎯 Результаты

### Проблема 1: Read receipts не обновляются без перезагрузки
**Решено ✅**
- `toIso()` теперь правильно парсит массивы Java LocalDateTime
- `readAtByChatIdByUserId` содержит корректные ISO строки
- `useMessageStatus` реактивно обновляется при изменении `readAtByChatIdByUserId`
- Статусы прочтения обновляются **без перезагрузки**

### Проблема 2: Статусы не отображаются в сайдбаре
**Решено ✅**
- `getLastMessageReadMeta` в `pages/chats.js` правильно парсит даты
- Иконки "прочитано" отображаются в списке чатов
- Работает для всех форматов дат

### Проблема 3: Чаты в рандомном порядке
**Решено ✅**
- `getChatTime` правильно парсит даты через `parseServerDate`
- Сортировка работает корректно
- Свежий чат поднимается наверх
- Порядок сохраняется после обновления страницы

---

## 🔍 Техническое объяснение

### Почему read receipts не обновлялись без перезагрузки?

1. **WebSocket присылал read receipt:**
   ```javascript
   {
     chatId: 1,
     readerId: 2,
     readAt: [2026, 1, 31, 17, 32, 33, 727769000] // Массив!
   }
   ```

2. **Функция `toIso` не могла его распарсить:**
   ```javascript
   // СТАРЫЙ КОД:
   const toIso = (value) => {
     const date = new Date(value); // new Date(массив) = Invalid Date!
     return date.toISOString(); // "Invalid Date" → null
   };
   ```

3. **В результате:**
   - `readAtByChatIdByUserId` не обновлялся (невалидная дата игнорировалась)
   - `useMessageStatus` не получал новые данные
   - Иконки не обновлялись

4. **После перезагрузки:**
   - REST API возвращал данные в другом формате (строки)
   - Данные парсились корректно
   - Статусы отображались

### Почему чаты были в рандомном порядке?

1. **`getChatTime` возвращал `0` или `NaN` для дат-массивов**
2. **Все чаты с невалидными датами имели одинаковый timestamp**
3. **Сортировка становилась нестабильной**
4. **Порядок казался случайным**

---

## 🧪 Как проверить

### Read receipts без перезагрузки:
1. ✅ Откройте чат на двух устройствах (А и Б)
2. ✅ Устройство А отправляет сообщение
3. ✅ Устройство Б читает сообщение (открывает чат)
4. ✅ **БЕЗ ПЕРЕЗАГРУЗКИ** на устройстве А иконка должна стать "прочитано" (двойная галочка зеленая)

### Статусы в сайдбаре:
1. ✅ Откройте список чатов (`/chats`)
2. ✅ Отправьте сообщение
3. ✅ Другой пользователь прочитает
4. ✅ В списке должна появиться иконка "прочитано"

### Сортировка чатов:
1. ✅ Отправьте сообщение в чат А
2. ✅ Чат А поднимается наверх
3. ✅ Отправьте сообщение в чат Б
4. ✅ Чат Б теперь сверху, чат А под ним
5. ✅ Обновите страницу - порядок **сохраняется**

---

## 💡 Почему проблема возникла?

**Java использует другой формат сериализации дат:**

В Java 8+ при сериализации `LocalDateTime` через Jackson по умолчанию получается массив:

```java
// Java код:
LocalDateTime.now() // 2026-01-31T17:32:33.727769

// Jackson сериализует как:
[2026, 1, 31, 17, 32, 33, 727769000]
```

**JavaScript не умеет парсить такой формат:**

```javascript
new Date([2026, 1, 31, 17, 32, 33, 727769000]) // Invalid Date!
```

**Нужна специальная функция `parseServerDate`:**

```javascript
parseServerDate([2026, 1, 31, 17, 32, 33, 727769000])
// → new Date(2026, 0, 31, 17, 32, 33, 727) // ✅ Валидная дата!
// Обратите внимание: month - 1 (Java: 1-12, JS: 0-11)
```

---

## ✅ Итоговый результат

### До исправлений:
- ❌ Read receipts обновлялись только после F5
- ❌ Статусы не показывались в списке чатов
- ❌ Чаты прыгали в рандомном порядке

### После исправлений:
- ✅ Read receipts обновляются **реалтайм через WebSocket**
- ✅ Статусы отображаются везде (в чате + в списке)
- ✅ Чаты сортируются правильно и стабильно
- ✅ Новое сообщение → чат поднимается наверх
- ✅ Порядок сохраняется после перезагрузки

---

## 🎉 Все работает!

**Фронтенд теперь полностью совместим с форматом дат Java LocalDateTime!**

Поддерживаются форматы:
- ✅ Java LocalDateTime массив: `[2026, 1, 31, 17, 32, 33, 727769000]`
- ✅ ISO 8601: `"2026-01-31T17:32:33.727769Z"`
- ✅ Unix timestamp (мс): `1706719953727`
- ✅ Unix timestamp (с): `1706719953`

---

*Отчет составлен: 31 января 2026*
*Все проблемы решены ✅*
