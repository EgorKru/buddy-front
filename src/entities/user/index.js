/**
 * Сущность "пользователь": отображаемое имя, инициалы. FSD: entities
 */

/**
 * Возвращает отображаемое имя пользователя (displayName → username → fallback).
 * @param {object|null} user — объект пользователя
 * @param {string} [fallback='Пользователь'] — значение по умолчанию
 * @returns {string}
 */
export const getDisplayName = (user, fallback = 'Пользователь') => {
  if (!user) return fallback;
  return user.displayName || user.username || fallback;
};

/**
 * Возвращает инициалы: для нескольких слов — первая буква первого и последнего слова, иначе первая буква имени.
 * @param {object|null} user — объект пользователя с displayName или username
 * @returns {string} одна или две буквы в верхнем регистре либо '?'
 */
export const getInitials = (user) => {
  if (!user) return '?';
  const name = user.displayName || user.username || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0] ? name[0].toUpperCase() : '?';
};
