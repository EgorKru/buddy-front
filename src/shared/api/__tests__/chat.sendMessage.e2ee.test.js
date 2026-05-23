/**
 * Контракт: REST sendMessage передаёт encryptionVersion для E2EE TEXT.
 */
import { chatAPI } from '../chat';
import { apiRequest } from '../client';

jest.mock('../client', () => ({
  apiRequest: jest.fn().mockResolvedValue({ id: 1 }),
}));

describe('chatAPI.sendMessage — E2EE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('добавляет encryptionVersion в body при TEXT и версии >= 1', async () => {
    const envelope = JSON.stringify({ v: 1, iv: 'a', ct: 'b' });
    await chatAPI.sendMessage(2, envelope, 'TEXT', null, null, 1);

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [, options] = apiRequest.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toEqual({
      type: 'TEXT',
      content: envelope,
      encryptionVersion: 1,
    });
  });

  it('не добавляет encryptionVersion для plaintext (null)', async () => {
    await chatAPI.sendMessage(2, 'hello', 'TEXT', null, null, null);

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [, options] = apiRequest.mock.calls[0];
    expect(options.body).toEqual({
      type: 'TEXT',
      content: 'hello',
    });
    expect(options.body.encryptionVersion).toBeUndefined();
  });

  it('не добавляет encryptionVersion при 0', async () => {
    await chatAPI.sendMessage(2, 'x', 'TEXT', null, null, 0);

    const [, options] = apiRequest.mock.calls[0];
    expect(options.body.encryptionVersion).toBeUndefined();
  });
});
