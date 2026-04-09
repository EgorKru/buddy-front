/**
 * Реэкспорт из FSD shared/config. Источник истины: src/shared/config.
 * Обратная совместимость: импорты @/utils/config продолжают работать.
 * Новый код: импортировать из @/shared/config. После полной миграции файл можно удалить.
 */
export {
  config,
  getApiUrl,
  isBrowser,
  getEnvironment,
  isDevelopment,
  isProduction,
} from '../src/shared/config';
