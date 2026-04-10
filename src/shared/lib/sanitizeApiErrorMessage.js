/**
 * Убирает сырой текст вида «Internal server error» и заменяет на понятное сообщение.
 * @param {string} message
 * @param {number} [statusCode]
 * @returns {string}
 */
const SERVER_ERROR_RU = 'Сервер временно недоступен. Попробуйте позже.';

export function sanitizeApiErrorMessage(message, statusCode) {
  const m = String(message ?? '').trim();
  const lower = m.toLowerCase();

  if (lower.includes('internal server error')) {
    return SERVER_ERROR_RU;
  }

  if (/^request failed with status 5\d\d$/i.test(m)) {
    return SERVER_ERROR_RU;
  }

  const is5xx = typeof statusCode === 'number' && statusCode >= 500 && statusCode < 600;
  if (is5xx) {
    const genericStatus = `Request failed with status ${statusCode}`;
    if (!m || m === genericStatus || /^request failed with status 5\d\d$/i.test(m)) {
      return SERVER_ERROR_RU;
    }
  }

  return m;
}
