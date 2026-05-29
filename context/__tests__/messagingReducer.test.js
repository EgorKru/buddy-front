import {
  messagingReducer,
  messagingActionTypes as AT,
  messagingInitialState,
  getChatTime,
} from '../messagingReducer';

const baseChat = (id, overrides = {}) => ({
  id,
  type: 'DIRECT',
  unreadCount: 0,
  participants: [
    { id: 1, username: 'me' },
    { id: 2, username: 'peer', online: false },
  ],
  ...overrides,
});

const emptyState = {
  ...messagingInitialState,
  readAtByChatIdByUserId: {},
};

describe('messagingReducer realtime state', () => {
  it('UPSERT_MESSAGE updates lastMessage and moves chat to top of chatOrder', () => {
    const state = {
      ...emptyState,
      chatsById: {
        1: baseChat(1, {
          lastMessage: { id: 1, createdAt: '2026-01-01T10:00:00.000Z', content: 'old' },
        }),
        2: baseChat(2),
      },
      chatOrder: ['1', '2'],
    };

    const message = {
      id: 99,
      chatId: 2,
      senderId: 2,
      content: 'новое',
      createdAt: '2026-05-28T15:00:00.000Z',
      type: 'TEXT',
    };

    const next = messagingReducer(state, {
      type: AT.UPSERT_MESSAGE,
      payload: { message, unreadDelta: 1 },
    });

    expect(next.chatsById['2'].lastMessage.content).toBe('новое');
    expect(next.chatOrder[0]).toBe('2');
    expect(next.messageIdsByChatId['2']).toContain('99');
  });

  it('APPLY_READ_RECEIPT stores readAt per user per chat', () => {
    const next = messagingReducer(emptyState, {
      type: AT.APPLY_READ_RECEIPT,
      payload: { chatId: 4, readerId: 2, readAt: '2026-05-28T12:00:00.000Z' },
    });

    expect(next.readAtByChatIdByUserId['4']['2']).toBe('2026-05-28T12:00:00.000Z');
  });

  it('APPLY_READ_RECEIPT accepts Jackson LocalDateTime array from WebSocket', () => {
    const next = messagingReducer(emptyState, {
      type: AT.APPLY_READ_RECEIPT,
      payload: { chatId: 4, readerId: 2, readAt: [2026, 5, 28, 12, 0, 0, 0] },
    });

    expect(next.readAtByChatIdByUserId['4']['2']).toMatch(/^2026-05-28T/);
  });

  it('UPDATE_PRESENCE sets participant online flag', () => {
    const state = {
      ...emptyState,
      chatsById: { 4: baseChat(4) },
      chatOrder: ['4'],
    };

    const next = messagingReducer(state, {
      type: AT.UPDATE_PRESENCE,
      payload: { userId: 2, online: true },
    });

    const peer = next.chatsById['4'].participants.find((p) => p.id === 2);
    expect(peer.online).toBe(true);
  });

  it('UPDATE_PRESENCE sets participant busy flag', () => {
    const state = {
      ...emptyState,
      chatsById: {
        4: baseChat(4, {
          participants: [
            { id: 1, username: 'me', online: false },
            { id: 2, username: 'peer', online: true, busy: false },
          ],
        }),
      },
      chatOrder: ['4'],
    };

    const next = messagingReducer(state, {
      type: AT.UPDATE_PRESENCE,
      payload: { userId: 2, online: true, busy: true },
    });

    const peer = next.chatsById['4'].participants.find((p) => p.id === 2);
    expect(peer.online).toBe(true);
    expect(peer.busy).toBe(true);
  });

  it('getChatTime prefers newer of updatedAt and lastMessage.createdAt', () => {
    const t1 = getChatTime({
      updatedAt: '2026-05-28T16:00:00.000Z',
      lastMessage: { createdAt: '2026-05-28T14:00:00.000Z' },
    });
    const t2 = getChatTime({
      updatedAt: '2026-05-28T12:00:00.000Z',
      lastMessage: { createdAt: '2026-05-28T18:00:00.000Z' },
    });
    expect(t1).toBeGreaterThan(new Date('2026-05-28T14:00:00.000Z').getTime());
    expect(t2).toBeGreaterThan(new Date('2026-05-28T12:00:00.000Z').getTime());
  });
});
