/**
 * Реэкспорт из FSD shared/lib/date. Источник истины: src/shared/lib/date.js.
 * Обратная совместимость: импорты @/utils/dateHelpers продолжают работать.
 * Новый код: импортировать из @/shared/lib/date. После полной миграции файл можно удалить.
 */
export {
  parseServerDate,
  formatChatDate,
  formatChatTime,
  formatChatListTime,
  formatMeetingTime,
  formatLastSeen,
  getOnlineStatus,
} from '../src/shared/lib/date';
