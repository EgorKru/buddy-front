/**
 * Регрессия: повторный STOMP/notification не должен блокировать upsert, если сообщения ещё нет в store.
 */
import {
  messagingReducer,
  messagingActionTypes as AT,
  messagingInitialState,
} from '../messagingReducer';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

describe('messaging upsert dedup (reducer level)', () => {
  const baseState = {
    ...messagingInitialState,
    readAtByChatIdByUserId: {},
    chatsById: {
      5: { id: 5, unreadCount: 0, participants: [{ id: 1 }, { id: 2 }] },
    },
    chatOrder: ['5'],
    activeChatId: '5',
  };

  it('UPSERT_MESSAGE adds message to messagesById and messageIdsByChatId', () => {
    const msg = {
      id: 42,
      chatId: 5,
      senderId: 2,
      content: 'hello',
      createdAt: '2026-05-28T12:00:00.000Z',
      type: 'TEXT',
      status: MESSAGE_STATUS.SENT,
      isOptimistic: false,
    };

    const next = messagingReducer(baseState, {
      type: AT.UPSERT_MESSAGE,
      payload: { message: msg, unreadDelta: 0 },
    });

    expect(next.messagesById['42']?.content).toBe('hello');
    expect(next.messageIdsByChatId['5']).toContain('42');
    expect(next.chatsById['5'].lastMessage?.id).toBe(42);
  });

  it('second UPSERT with same id merges content (simulates force refresh)', () => {
    const msg = {
      id: 42,
      chatId: 5,
      senderId: 2,
      content: 'hello',
      createdAt: '2026-05-28T12:00:00.000Z',
      type: 'TEXT',
    };
    const once = messagingReducer(baseState, {
      type: AT.UPSERT_MESSAGE,
      payload: { message: msg, unreadDelta: 0 },
    });
    const twice = messagingReducer(once, {
      type: AT.UPSERT_MESSAGE,
      payload: {
        message: { ...msg, content: 'hello updated' },
        unreadDelta: 0,
      },
    });

    expect(twice.messagesById['42']?.content).toBe('hello updated');
  });
});
