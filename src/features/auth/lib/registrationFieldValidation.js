/**
 * Клиентская валидация регистрации (согласовано с RegisterRequest).
 */
import { getLoginUsernameError, getLoginPasswordError } from './loginFieldValidation';

export {
  getLoginUsernameError as getRegisterUsernameError,
  getLoginPasswordError as getRegisterPasswordError,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getRegisterEmailError(email, { requireNonEmpty = false } = {}) {
  const t = String(email).trim();
  if (!t) {
    return requireNonEmpty ? 'Введите email' : '';
  }
  if (!EMAIL_PATTERN.test(t)) {
    return 'Укажите корректный email';
  }
  return '';
}

export function getRegisterPasswordConfirmationError(
  password,
  confirmation,
  { requireNonEmpty = false } = {}
) {
  if (!confirmation) {
    return requireNonEmpty ? 'Подтвердите пароль' : '';
  }
  if (password !== confirmation) {
    return 'Пароли не совпадают';
  }
  return '';
}

export function getVerificationCodeError(code, { requireNonEmpty = false } = {}) {
  const c = String(code || '');
  if (!c) {
    return requireNonEmpty ? 'Введите код из письма' : '';
  }
  if (c.length < 6) {
    return 'Код — 6 цифр';
  }
  return '';
}
