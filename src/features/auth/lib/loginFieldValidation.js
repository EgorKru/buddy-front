/**
 * Клиентская валидация формы входа (согласовано с RegisterRequest: username 3–20, password min 6).
 */

const PASSWORD_MIN_LENGTH = 6;

export function getLoginUsernameError(username, { requireNonEmpty = false } = {}) {
  const u = String(username).trim();
  if (!u) {
    return requireNonEmpty ? 'Введите имя пользователя' : '';
  }
  if (u.length < 3) {
    return 'Имя пользователя — не менее 3 символов';
  }
  if (u.length > 20) {
    return 'Не более 20 символов';
  }
  return '';
}

export function getLoginPasswordError(password, { requireNonEmpty = false } = {}) {
  if (!password) {
    return requireNonEmpty ? 'Введите пароль' : '';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Пароль — не менее ${PASSWORD_MIN_LENGTH} символов`;
  }
  return '';
}
