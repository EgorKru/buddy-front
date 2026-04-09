/**
 * Очередь сообщений с сохранением в localStorage (retry, offline).
 * FSD: features/send-message/lib. Использует shared/lib/storage для тестируемости.
 */
import { getItem, setItem } from '@/shared/lib/storage';

const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 3000, 5000];
const STORAGE_KEY = 'messageQueue';
const CLEANUP_DAYS = 7;
const CLEANUP_MS = CLEANUP_DAYS * 24 * 60 * 60 * 1000;

/**
 * @returns {Array}
 */
export const getMessageQueue = () => {
  try {
    const queue = getItem(STORAGE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (_error) {
    return [];
  }
};

/**
 * @param {object} message
 * @returns {object | null}
 */
export const saveMessageToQueue = (message) => {
  try {
    const queue = getMessageQueue();
    const messageWithStatus = {
      ...message,
      status: MESSAGE_STATUS.PENDING,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      tempId: message.tempId || `temp-${Date.now()}-${Math.random()}`,
    };
    queue.push(messageWithStatus);
    setItem(STORAGE_KEY, JSON.stringify(queue));
    return messageWithStatus;
  } catch (_error) {
    return null;
  }
};

/**
 * @param {string} tempId
 * @param {string} status
 * @param {object | null} serverMessage
 * @returns {object | null}
 */
export const updateMessageStatus = (tempId, status, serverMessage = null) => {
  try {
    const queue = getMessageQueue();
    const index = queue.findIndex((msg) => msg.tempId === tempId);

    if (index !== -1) {
      if (status === MESSAGE_STATUS.SENT && serverMessage) {
        queue[index] = {
          ...serverMessage,
          status: MESSAGE_STATUS.SENT,
          tempId: queue[index].tempId,
        };
      } else {
        queue[index].status = status;
        if (status === MESSAGE_STATUS.FAILED) {
          queue[index].retryCount = (queue[index].retryCount || 0) + 1;
        }
      }
      setItem(STORAGE_KEY, JSON.stringify(queue));
      return queue[index];
    }
    return null;
  } catch (_error) {
    return null;
  }
};

/**
 * @param {string} tempId
 * @returns {boolean}
 */
export const removeMessageFromQueue = (tempId) => {
  try {
    const queue = getMessageQueue();
    const filtered = queue.filter((msg) => msg.tempId !== tempId);
    setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (_error) {
    return false;
  }
};

/**
 * @returns {Array}
 */
export const getFailedMessages = () => {
  const queue = getMessageQueue();
  return queue.filter(
    (msg) => msg.status === MESSAGE_STATUS.FAILED && (msg.retryCount || 0) < MAX_RETRY_ATTEMPTS
  );
};

/**
 * @returns {boolean}
 */
export const cleanupOldMessages = () => {
  try {
    const queue = getMessageQueue();
    const cutoffTime = Date.now() - CLEANUP_MS;
    const filtered = queue.filter((msg) => {
      const messageDate = new Date(msg.createdAt).getTime();
      return messageDate > cutoffTime;
    });
    setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered.length < queue.length;
  } catch (_error) {
    return false;
  }
};

/**
 * @param {function} sendMessageFn
 * @returns {Promise<Array<{ success: boolean, message?: object, error?: Error }>>}
 */
export const syncMessageQueue = async (sendMessageFn) => {
  const queue = getMessageQueue();
  const pendingMessages = queue.filter(
    (msg) =>
      (msg.status === MESSAGE_STATUS.PENDING ||
        (msg.status === MESSAGE_STATUS.FAILED && (msg.retryCount || 0) < MAX_RETRY_ATTEMPTS)) &&
      msg.status !== MESSAGE_STATUS.SENDING
  );

  const results = [];

  for (const message of pendingMessages) {
    try {
      const retryDelay = RETRY_DELAYS[message.retryCount || 0] || 5000;

      if (message.retryCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      updateMessageStatus(message.tempId, MESSAGE_STATUS.SENDING);
      const serverMessage = await sendMessageFn(message);

      if (serverMessage) {
        updateMessageStatus(message.tempId, MESSAGE_STATUS.SENT, serverMessage);
        removeMessageFromQueue(message.tempId);
        results.push({ success: true, message: serverMessage });
      }
    } catch (error) {
      updateMessageStatus(message.tempId, MESSAGE_STATUS.FAILED);
      results.push({ success: false, message, error });
    }
  }

  return results;
};

export { MESSAGE_STATUS, MAX_RETRY_ATTEMPTS, RETRY_DELAYS };
