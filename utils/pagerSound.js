/**
 * Реэкспорт из FSD features/notifications/lib/audio. Источник истины: src/features/notifications/lib/audio.js.
 * Обратная совместимость: импорты @/utils/pagerSound продолжают работать.
 * Новый код: импортировать из @/features/notifications/lib/audio. После полной миграции файл можно удалить.
 */
export {
  unlockPagerAudio,
  playPagerNotificationSound,
  _resetAudioContext,
} from '../src/features/notifications/lib/audio';
