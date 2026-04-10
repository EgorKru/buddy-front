/**
 * Преобразует ошибку API в сообщение для пользователя.
 * FSD: features/create-chat/lib
 * @param {Error} error
 * @returns {string}
 */
import { sanitizeApiErrorMessage } from '@/shared/lib/sanitizeApiErrorMessage';

export function getErrorMessage(error) {
  const message = error?.message || '';
  if (message.includes('401') || message.includes('Unauthorized')) {
    return 'Необходима авторизация';
  }
  if (message.includes('403') || message.includes('Forbidden')) {
    return 'Доступ запрещен';
  }
  if (message.includes('404') || message.includes('Not found')) {
    return 'Не найдено';
  }
  return sanitizeApiErrorMessage(message) || 'Произошла ошибка';
}
