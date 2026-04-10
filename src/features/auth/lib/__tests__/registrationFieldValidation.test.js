import {
  getRegisterUsernameError,
  getRegisterPasswordError,
  getRegisterEmailError,
  getRegisterPasswordConfirmationError,
  getVerificationCodeError,
} from '../registrationFieldValidation';

describe('getRegisterEmailError', () => {
  it('empty optional until required', () => {
    expect(getRegisterEmailError('', { requireNonEmpty: false })).toBe('');
    expect(getRegisterEmailError('', { requireNonEmpty: true })).toBe('Введите email');
  });

  it('rejects invalid format', () => {
    expect(getRegisterEmailError('not-an-email', { requireNonEmpty: true })).toBe(
      'Укажите корректный email'
    );
    expect(getRegisterEmailError('a@b', { requireNonEmpty: true })).toBe(
      'Укажите корректный email'
    );
  });

  it('accepts simple valid email', () => {
    expect(getRegisterEmailError('  user@host.com  ', { requireNonEmpty: true })).toBe('');
  });
});

describe('getRegisterPasswordConfirmationError', () => {
  it('empty when not required', () => {
    expect(getRegisterPasswordConfirmationError('x', '', { requireNonEmpty: false })).toBe('');
  });

  it('requires confirmation', () => {
    expect(getRegisterPasswordConfirmationError('secret12', '', { requireNonEmpty: true })).toBe(
      'Подтвердите пароль'
    );
  });

  it('detects mismatch', () => {
    expect(
      getRegisterPasswordConfirmationError('secret12', 'other', { requireNonEmpty: true })
    ).toBe('Пароли не совпадают');
  });

  it('accepts match', () => {
    expect(
      getRegisterPasswordConfirmationError('secret12', 'secret12', { requireNonEmpty: true })
    ).toBe('');
  });
});

describe('getVerificationCodeError', () => {
  it('empty optional until required', () => {
    expect(getVerificationCodeError('', { requireNonEmpty: false })).toBe('');
    expect(getVerificationCodeError('', { requireNonEmpty: true })).toBe('Введите код из письма');
  });

  it('requires 6 digits when partial', () => {
    expect(getVerificationCodeError('12', { requireNonEmpty: false })).toBe('Код — 6 цифр');
    expect(getVerificationCodeError('12345', { requireNonEmpty: true })).toBe('Код — 6 цифр');
  });

  it('accepts 6 chars', () => {
    expect(getVerificationCodeError('123456', { requireNonEmpty: true })).toBe('');
  });
});

describe('re-exports username/password', () => {
  it('matches login rules', () => {
    expect(getRegisterUsernameError('ab', { requireNonEmpty: false })).toContain('3');
    expect(getRegisterPasswordError('12345', { requireNonEmpty: false })).toContain('6');
  });
});
