import { sanitizeApiErrorMessage } from '../sanitizeApiErrorMessage';

const RU = 'Сервер временно недоступен. Попробуйте позже.';

describe('sanitizeApiErrorMessage', () => {
  it('replaces Internal server error (any case)', () => {
    expect(sanitizeApiErrorMessage('Internal server error')).toBe(RU);
    expect(sanitizeApiErrorMessage('INTERNAL SERVER ERROR')).toBe(RU);
    expect(sanitizeApiErrorMessage('Error: Internal Server Error')).toBe(RU);
  });

  it('replaces generic Request failed with status 5xx', () => {
    expect(sanitizeApiErrorMessage('Request failed with status 500')).toBe(RU);
    expect(sanitizeApiErrorMessage('Request failed with status 502')).toBe(RU);
  });

  it('uses status code for generic 5xx body', () => {
    expect(sanitizeApiErrorMessage('', 500)).toBe(RU);
    expect(sanitizeApiErrorMessage('Request failed with status 500', 500)).toBe(RU);
  });

  it('keeps specific 5xx messages', () => {
    expect(sanitizeApiErrorMessage('Конфликт данных', 500)).toBe('Конфликт данных');
  });

  it('passes through normal API messages', () => {
    expect(sanitizeApiErrorMessage('Неверный логин')).toBe('Неверный логин');
    expect(sanitizeApiErrorMessage('Bad Request')).toBe('Bad Request');
  });
});
