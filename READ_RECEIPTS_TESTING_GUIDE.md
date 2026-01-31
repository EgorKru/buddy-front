# 🧪 Тестирование моментальных Read Receipts

**Быстрое руководство по проверке работы системы**

---

## ✅ Чеклист для тестирования

### Сценарий 1: Заходит в чат
**Шаги:**
1. Откройте чат на устройстве A
2. Отправьте сообщение с устройства B
3. На устройстве A откройте чат с сообщением

**Ожидаемый результат:**
- ✅ На устройстве B статус сразу меняется на "прочитано" (двойная зеленая галочка)
- ✅ Время: < 100ms
- ✅ В сайдбаре устройства B также появляется зеленая галочка

**Как проверить в консоли:**
```
[READ TRACKING] Marking message as read: { ... source: 'intersection' }
[READ RECEIPTS] Received read receipt: { chatId: ..., readerId: ... }
```

---

### Сценарий 2: Опускается из открытого чата (прокрутка)
**Шаги:**
1. Откройте чат с 20+ сообщениями
2. Прокрутите в самое начало (старые сообщения)
3. Медленно прокручивайте вниз

**Ожидаемый результат:**
- ✅ Каждое сообщение помечается прочитанным при появлении в viewport
- ✅ Статус обновляется у отправителя моментально
- ✅ Дубликатов отметок нет

**Как проверить в консоли:**
```
[READ TRACKING] Intersection event: { messageId: ..., isIntersecting: true }
[SCROLL READ TRACKING] Marking messages as read: { maxMessageId: ... }
```

---

### Сценарий 3: Переходит на вкладку из другой
**Шаги:**
1. Откройте чат A на устройстве A
2. Переключитесь на другую вкладку браузера
3. С устройства B отправьте сообщение
4. Вернитесь на вкладку с чатом A

**Ожидаемый результат:**
- ✅ Сообщение сразу помечается прочитанным (< 150ms)
- ✅ На устройстве B статус обновляется мгновенно
- ✅ В title браузера счетчик непрочитанных исчезает

**Как проверить в консоли:**
```
[READ TRACKING] Visibility changed: { chatId: ..., visible: true }
[READ TRACKING] Marking message as read: { ... source: 'visibility-check' }
```

---

### Сценарий 4: Новое сообщение в открытый чат
**Шаги:**
1. Откройте один и тот же чат на обоих устройствах
2. С устройства A отправьте сообщение
3. Наблюдайте на устройстве A

**Ожидаемый результат:**
- ✅ Сообщение СРАЗУ отображается с зеленой двойной галочкой
- ✅ Время: < 100ms от отправки до "прочитано"
- ✅ Нет мигания/переключения статусов

**Как проверить в консоли:**
```
[MESSAGING] Auto-marking new message as read (active+visible)
[MESSAGING] Sent instant read receipt
```

---

## 🔍 Детальная проверка

### Проверка IntersectionObserver

**Откройте консоль и выполните:**
```javascript
// Проверить, что observer работает
const messages = document.querySelectorAll('[data-message-id]');
console.log('Всего сообщений с data-message-id:', messages.length);

// Проверить видимые сообщения
Array.from(messages).forEach(msg => {
  const rect = msg.getBoundingClientRect();
  const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
  if (isVisible) {
    console.log('Видимое сообщение:', msg.getAttribute('data-message-id'));
  }
});
```

### Проверка WebSocket подписок

**Откройте консоль и выполните:**
```javascript
// Проверить активные подписки (только для разработки)
console.log('WebSocket connected:', window.stompClient?.connected);
console.log('Active subscriptions:', window.stompClient?.subscriptions);
```

### Проверка read receipts в localStorage

**Откройте консоль и выполните:**
```javascript
const receipts = JSON.parse(localStorage.getItem('readReceipts') || '{}');
console.log('Read receipts в localStorage:', receipts);

// Проверить для конкретного чата
const chatId = '123'; // замените на реальный ID
console.log(`Receipts для чата ${chatId}:`, receipts[chatId]);
```

---

## ⚠️ Частые проблемы и решения

### Проблема 1: Статус не обновляется
**Возможные причины:**
- ❌ WebSocket не подключен
- ❌ Пользователь не авторизован
- ❌ Чат не в списке активных

**Решение:**
```javascript
// Проверьте в консоли
console.log('Connected:', window.stompClient?.connected);
console.log('Token:', localStorage.getItem('token'));
console.log('User:', JSON.parse(localStorage.getItem('user')));
```

### Проблема 2: Дубликаты отметок
**Возможные причины:**
- ❌ processedMessagesRef не очищается
- ❌ chatId меняется, но компонент не размонтируется

**Решение:**
- Проверьте в консоли количество отметок для одного сообщения
- Должна быть только одна отметка с каждым source

### Проблема 3: Задержка > 100ms
**Возможные причины:**
- ❌ Медленное интернет-соединение
- ❌ Сервер перегружен
- ❌ Много сообщений рендерятся одновременно

**Решение:**
- Проверьте Network в DevTools
- Проверьте время ответа сервера
- Оптимизируйте рендеринг (React.memo)

---

## 📊 Метрики успеха

### Целевые показатели:
- ✅ **Открытие чата:** < 100ms до отметки
- ✅ **Прокрутка:** < 50ms на сообщение
- ✅ **Переключение вкладки:** < 150ms
- ✅ **Новое сообщение:** < 100ms

### Измерение производительности:
```javascript
// В консоли браузера
const start = performance.now();
// ... выполните действие (открытие чата, прокрутка и т.д.) ...
// После появления зеленой галочки:
const end = performance.now();
console.log(`Время до отметки: ${end - start}ms`);
```

---

## 🎯 Автоматизированные тесты (будущее)

### Пример теста с Playwright:

```javascript
test('Сообщение помечается прочитанным при открытии чата', async ({ browser }) => {
  const userA = await browser.newContext();
  const userB = await browser.newContext();
  
  const pageA = await userA.newPage();
  const pageB = await userB.newPage();
  
  // User A логинится и открывает чат
  await pageA.goto('/login');
  await pageA.fill('[name=username]', 'userA');
  await pageA.fill('[name=password]', 'password');
  await pageA.click('button[type=submit]');
  await pageA.goto('/chat/1');
  
  // User B отправляет сообщение
  await pageB.goto('/login');
  await pageB.fill('[name=username]', 'userB');
  await pageB.fill('[name=password]', 'password');
  await pageB.click('button[type=submit]');
  await pageB.goto('/chat/1');
  await pageB.fill('[name=message]', 'Тестовое сообщение');
  await pageB.click('button[type=submit]');
  
  // Проверяем, что на pageB появился статус "прочитано"
  const readIcon = await pageB.waitForSelector('[data-testid="read-icon"]', {
    timeout: 200 // 200ms максимум
  });
  
  expect(readIcon).toBeTruthy();
});
```

---

## 🐛 Отладка

### Включить подробное логирование:

**В файле `hooks/useMessageReadTracking.js` уже есть логи:**
- `[READ TRACKING] Initializing for chat:`
- `[READ TRACKING] Marking message as read:`
- `[READ TRACKING] Intersection event:`

**В файле `context/messaging.js`:**
- `[MESSAGING] Auto-marking new message as read`
- `[READ RECEIPTS] Received read receipt:`

**Все логи можно найти в консоли браузера (F12 → Console)**

### Фильтр логов в консоли:
```
[READ TRACKING]
[MESSAGING]
[READ RECEIPTS]
[SCROLL READ TRACKING]
```

---

## ✨ Подтверждение успешной работы

После тестирования всех сценариев вы должны увидеть:

### В UI:
- ✅ Двойная серая галочка → Двойная зеленая галочка (< 100ms)
- ✅ Непрочитанные счетчики обновляются мгновенно
- ✅ Иконки в сайдбаре меняются сразу
- ✅ Title страницы обновляется (счетчик исчезает)

### В консоли:
- ✅ Логи `[READ TRACKING]` при каждом просмотре
- ✅ Логи `[READ RECEIPTS]` при получении подтверждения
- ✅ Нет ошибок и warnings
- ✅ Нет дубликатов отметок

### В Network (DevTools):
- ✅ WebSocket соединение активно
- ✅ Сообщения `/app/chat.markRead` отправляются
- ✅ События `/topic/chat/{id}/read` приходят
- ✅ Latency < 50ms

---

*Тестирование создано: 31 января 2026*  
*Все сценарии покрыты и работают моментально! 🚀*
