import { getLoginUsernameError, getLoginPasswordError } from '../loginFieldValidation';

describe('getLoginUsernameError', () => {
  it('returns empty when blank and empty not required', () => {
    expect(getLoginUsernameError('', { requireNonEmpty: false })).toBe('');
    expect(getLoginUsernameError('   ', { requireNonEmpty: false })).toBe('');
  });

  it('requires non-empty when flag set', () => {
    expect(getLoginUsernameError('', { requireNonEmpty: true })).toBe('Введите имя пользователя');
  });

  it('validates min length when non-empty', () => {
    expect(getLoginUsernameError('ab', { requireNonEmpty: false })).toBe(
      'Имя пользователя — не менее 3 символов'
    );
  });

  it('validates max length', () => {
    expect(getLoginUsernameError('a'.repeat(21), { requireNonEmpty: false })).toBe(
      'Не более 20 символов'
    );
  });

  it('accepts trim and valid length', () => {
    expect(getLoginUsernameError('  abc  ', { requireNonEmpty: true })).toBe('');
  });
});

describe('getLoginPasswordError', () => {
  it('returns empty when blank and empty not required', () => {
    expect(getLoginPasswordError('', { requireNonEmpty: false })).toBe('');
  });

  it('requires password when flag set', () => {
    expect(getLoginPasswordError('', { requireNonEmpty: true })).toBe('Введите пароль');
  });

  it('requires min length 6', () => {
    expect(getLoginPasswordError('12345', { requireNonEmpty: false })).toBe(
      'Пароль — не менее 6 символов'
    );
  });

  it('accepts 6+ chars', () => {
    expect(getLoginPasswordError('123456', { requireNonEmpty: true })).toBe('');
  });
});
