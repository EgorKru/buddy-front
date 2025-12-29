/**
 * Система управления очередью сообщений
 * Реализует логику отправки сообщений с повторными попытками,
 * офлайн-режимом и синхронизацией, как в популярных мессенджерах
 */

const MESSAGE_STATUS = {
  PENDING: 'pending',        // Сообщение создано, но еще не отправлено
  SENDING: 'sending',        // Сообщение отправляется
  SENT: 'sent',              // Сообщение успешно отправлено
  DELIVERED: 'delivered',    // Сообщение доставлено (если поддерживается бэкендом)
  FAILED: 'failed',          // Ошибка отправки
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Задержки между попытками в мс

/**
 * Сохраняет сообщение в локальное хранилище для офлайн-режима
 */
export const saveMessageToQueue = (message) => {
  try {
    const queue = getMessageQueue();
    const messageWithStatus = {
      ...message,
      status: MESSAGE_STATUS.PENDING,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      tempId: message.tempId || `temp-${Date.now()}-${Math.random()}`,
    };
    queue.push(messageWithStatus);
    localStorage.setItem('messageQueue', JSON.stringify(queue));
    return messageWithStatus;
  } catch (error) {
    console.error('Ошибка сохранения сообщения в очередь:', error);
    return null;
  }
};

/**
 * Получает очередь сообщений из локального хранилища
 */
export const getMessageQueue = () => {
  try {
    const queue = localStorage.getItem('messageQueue');
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Ошибка чтения очереди сообщений:', error);
    return [];
  }
};

/**
 * Обновляет статус сообщения в очереди
 */
export const updateMessageStatus = (tempId, status, serverMessage = null) => {
  try {
    const queue = getMessageQueue();
    const index = queue.findIndex(msg => msg.tempId === tempId);
    
    if (index !== -1) {
      if (status === MESSAGE_STATUS.SENT && serverMessage) {
        // Заменяем временное сообщение на реальное
        queue[index] = {
          ...serverMessage,
          status: MESSAGE_STATUS.SENT,
          tempId: queue[index].tempId, // Сохраняем tempId для связи
        };
      } else {
        queue[index].status = status;
        if (status === MESSAGE_STATUS.FAILED) {
          queue[index].retryCount = (queue[index].retryCount || 0) + 1;
        }
      }
      localStorage.setItem('messageQueue', JSON.stringify(queue));
      return queue[index];
    }
    return null;
  } catch (error) {
    console.error('Ошибка обновления статуса сообщения:', error);
    return null;
  }
};

/**
 * Удаляет сообщение из очереди (после успешной отправки)
 */
export const removeMessageFromQueue = (tempId) => {
  try {
    const queue = getMessageQueue();
    const filtered = queue.filter(msg => msg.tempId !== tempId);
    localStorage.setItem('messageQueue', JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Ошибка удаления сообщения из очереди:', error);
    return false;
  }
};

/**
 * Получает сообщения, которые нужно отправить повторно
 */
export const getFailedMessages = () => {
  const queue = getMessageQueue();
  return queue.filter(msg => 
    msg.status === MESSAGE_STATUS.FAILED && 
    (msg.retryCount || 0) < MAX_RETRY_ATTEMPTS
  );
};

/**
 * Очищает старые сообщения из очереди (старше 7 дней)
 */
export const cleanupOldMessages = () => {
  try {
    const queue = getMessageQueue();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const filtered = queue.filter(msg => {
      const messageDate = new Date(msg.createdAt).getTime();
      return messageDate > sevenDaysAgo;
    });
    localStorage.setItem('messageQueue', JSON.stringify(filtered));
    return filtered.length < queue.length;
  } catch (error) {
    console.error('Ошибка очистки очереди:', error);
    return false;
  }
};

/**
 * Синхронизирует очередь с сервером (отправляет неотправленные сообщения)
 */
export const syncMessageQueue = async (sendMessageFn) => {
  const queue = getMessageQueue();
  const pendingMessages = queue.filter(msg => 
    msg.status === MESSAGE_STATUS.PENDING || 
    (msg.status === MESSAGE_STATUS.FAILED && (msg.retryCount || 0) < MAX_RETRY_ATTEMPTS)
  );

  const results = [];
  
  for (const message of pendingMessages) {
    try {
      // Вычисляем задержку для повторной попытки
      const retryDelay = RETRY_DELAYS[message.retryCount || 0] || 5000;
      
      // Ждем перед повторной попыткой
      if (message.retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      updateMessageStatus(message.tempId, MESSAGE_STATUS.SENDING);
      const serverMessage = await sendMessageFn(message);
      
      if (serverMessage) {
        updateMessageStatus(message.tempId, MESSAGE_STATUS.SENT, serverMessage);
        removeMessageFromQueue(message.tempId);
        results.push({ success: true, message: serverMessage });
      }
    } catch (error) {
      console.error('Ошибка синхронизации сообщения:', error);
      updateMessageStatus(message.tempId, MESSAGE_STATUS.FAILED);
      results.push({ success: false, message, error });
    }
  }

  return results;
};

export { MESSAGE_STATUS, MAX_RETRY_ATTEMPTS, RETRY_DELAYS };

