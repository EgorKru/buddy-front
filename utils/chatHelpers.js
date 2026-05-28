/**
 * Реэкспорт из FSD entities/chat. Источник истины: src/entities/chat.
 * Обратная совместимость: импорты @/utils/chatHelpers продолжают работать.
 * Новый код: импортировать из @/entities/chat. После полной миграции файл можно удалить.
 */
export {
  getChatName,
  getChatAvatar,
  getMessagePreview,
  getLastMessagePreview,
  getLastMessageReadMeta,
  getOtherParticipantOnline,
} from '../src/entities/chat';
