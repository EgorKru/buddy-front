/**
 * Реэкспорт из FSD features/send-message/lib. Источник истины: src/features/send-message/lib/messageQueue.js.
 * Обратная совместимость: импорты @/utils/messageQueue продолжают работать.
 * Новый код: импортировать из @/features/send-message/lib/messageQueue. После полной миграции файл можно удалить.
 */
export {
  getMessageQueue,
  saveMessageToQueue,
  updateMessageStatus,
  removeMessageFromQueue,
  getFailedMessages,
  cleanupOldMessages,
  syncMessageQueue,
  MESSAGE_STATUS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS,
} from '../src/features/send-message/lib/messageQueue';
