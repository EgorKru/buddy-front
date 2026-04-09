/**
 * Настройки уведомлений (звук). FSD: features/notifications/lib.
 * Ключ отсутствует → звук включён. Ключ есть и равен 'true' → звук отключён.
 */
const STORAGE_KEY = 'disable_notification_sound';

export function isSoundEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true; // при ошибке доступа считаем, что звук включён
  }
}

export function setSoundEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  } catch {
    // игнорируем ошибки записи
  }
}
