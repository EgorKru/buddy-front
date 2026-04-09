/**
 * Тесты очереди сообщений. В jsdom используется реальный localStorage.
 */
import {
  getMessageQueue,
  saveMessageToQueue,
  updateMessageStatus,
  removeMessageFromQueue,
  getFailedMessages,
  MESSAGE_STATUS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS,
} from '../messageQueue';

describe('messageQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports MESSAGE_STATUS with expected keys', () => {
    expect(MESSAGE_STATUS).toMatchObject({
      PENDING: 'pending',
      SENDING: 'sending',
      SENT: 'sent',
      FAILED: 'failed',
    });
  });

  it('exports MAX_RETRY_ATTEMPTS and RETRY_DELAYS', () => {
    expect(MAX_RETRY_ATTEMPTS).toBe(3);
    expect(RETRY_DELAYS).toEqual([1000, 3000, 5000]);
  });

  it('getMessageQueue returns empty array when storage is empty', () => {
    expect(getMessageQueue()).toEqual([]);
  });

  it('saveMessageToQueue adds message with status PENDING and tempId', () => {
    const message = { chatId: '1', content: 'hi', type: 'TEXT' };
    const saved = saveMessageToQueue(message);
    expect(saved).not.toBeNull();
    expect(saved.status).toBe(MESSAGE_STATUS.PENDING);
    expect(saved.retryCount).toBe(0);
    expect(saved.tempId).toBeDefined();
    expect(saved.content).toBe('hi');
    expect(getMessageQueue()).toHaveLength(1);
  });

  it('updateMessageStatus updates status and persists', () => {
    const saved = saveMessageToQueue({ chatId: '1', content: 'hi' });
    const updated = updateMessageStatus(saved.tempId, MESSAGE_STATUS.SENDING);
    expect(updated).not.toBeNull();
    expect(updated.status).toBe(MESSAGE_STATUS.SENDING);
    expect(getMessageQueue()[0].status).toBe(MESSAGE_STATUS.SENDING);
  });

  it('removeMessageFromQueue removes by tempId', () => {
    const saved = saveMessageToQueue({ chatId: '1', content: 'hi' });
    expect(getMessageQueue()).toHaveLength(1);
    expect(removeMessageFromQueue(saved.tempId)).toBe(true);
    expect(getMessageQueue()).toHaveLength(0);
  });

  it('getFailedMessages returns only failed messages under retry limit', () => {
    const m1 = saveMessageToQueue({ chatId: '1', content: 'a' });
    const m2 = saveMessageToQueue({ chatId: '1', content: 'b' });
    updateMessageStatus(m1.tempId, MESSAGE_STATUS.FAILED);
    updateMessageStatus(m2.tempId, MESSAGE_STATUS.FAILED);
    const failed = getFailedMessages();
    expect(failed).toHaveLength(2);
  });
});
