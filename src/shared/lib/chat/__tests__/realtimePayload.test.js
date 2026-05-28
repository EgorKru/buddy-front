import {
  extractChatMessageFromStompPayload,
  extractNotificationMessage,
  planOwnIncomingStompMessage,
} from '../realtimePayload';

const serverMessage = {
  id: 100,
  chatId: 5,
  senderId: 1,
  type: 'TEXT',
  content: 'hello',
  createdAt: '2026-05-28T12:00:00.000Z',
};

describe('extractChatMessageFromStompPayload', () => {
  it('returns flat MessageDto from topic payload', () => {
    expect(extractChatMessageFromStompPayload(serverMessage)).toEqual(serverMessage);
  });

  it('unwraps MESSAGE_NEW chat update', () => {
    expect(
      extractChatMessageFromStompPayload({
        eventType: 'MESSAGE_NEW',
        pts: 10,
        message: serverMessage,
      })
    ).toEqual(serverMessage);
  });

  it('unwraps nested message when present', () => {
    expect(
      extractChatMessageFromStompPayload({
        eventType: 'MESSAGE_EDITED',
        message: serverMessage,
      })
    ).toEqual(serverMessage);
  });

  it('returns null for invalid payload', () => {
    expect(extractChatMessageFromStompPayload(null)).toBeNull();
    expect(extractChatMessageFromStompPayload({ eventType: 'MESSAGE_NEW' })).toBeNull();
    expect(extractChatMessageFromStompPayload({ pts: 1 })).toBeNull();
  });
});

describe('extractNotificationMessage', () => {
  it('returns flat MessageDto from /user/queue/messages', () => {
    expect(extractNotificationMessage(serverMessage)).toEqual(serverMessage);
  });

  it('returns message from notification wrapper', () => {
    expect(
      extractNotificationMessage({
        id: 1,
        type: 'CHAT_MESSAGE',
        message: serverMessage,
      })
    ).toEqual(serverMessage);
  });

  it('returns null when no message', () => {
    expect(extractNotificationMessage({ id: 1 })).toBeNull();
    expect(extractNotificationMessage(null)).toBeNull();
  });
});

describe('planOwnIncomingStompMessage', () => {
  const chatId = 5;
  const now = Date.parse('2026-05-28T12:00:10.000Z');

  it('replaces recent optimistic message', () => {
    const tempId = 'temp-abc';
    const plan = planOwnIncomingStompMessage({
      dto: serverMessage,
      chatId,
      currentUserId: 1,
      now,
      messageIdsByChatId: { 5: [tempId] },
      messagesById: {
        [tempId]: {
          id: tempId,
          tempId,
          chatId: 5,
          type: 'TEXT',
          isOptimistic: true,
          createdAt: '2026-05-28T12:00:05.000Z',
        },
      },
    });

    expect(plan).toEqual({ action: 'replace', tempId, dto: serverMessage });
  });

  it('upserts when no optimistic exists (WS before optimistic — regression)', () => {
    const plan = planOwnIncomingStompMessage({
      dto: serverMessage,
      chatId,
      currentUserId: 1,
      now,
      messageIdsByChatId: { 5: [] },
      messagesById: {},
    });

    expect(plan).toEqual({ action: 'upsert', dto: serverMessage });
  });

  it('upserts when optimistic is too old', () => {
    const tempId = 'temp-old';
    const plan = planOwnIncomingStompMessage({
      dto: serverMessage,
      chatId,
      currentUserId: 1,
      now,
      messageIdsByChatId: { 5: [tempId] },
      messagesById: {
        [tempId]: {
          id: tempId,
          tempId,
          chatId: 5,
          type: 'TEXT',
          isOptimistic: true,
          createdAt: '2026-05-28T11:00:00.000Z',
        },
      },
      maxOptimisticAgeMs: 30000,
    });

    expect(plan).toEqual({ action: 'upsert', dto: serverMessage });
  });

  it('returns none for other user message', () => {
    const plan = planOwnIncomingStompMessage({
      dto: { ...serverMessage, senderId: 2 },
      chatId,
      currentUserId: 1,
      now,
      messageIdsByChatId: { 5: [] },
      messagesById: {},
    });

    expect(plan).toEqual({ action: 'none' });
  });

  it('returns none for wrong chat', () => {
    const plan = planOwnIncomingStompMessage({
      dto: serverMessage,
      chatId: 99,
      currentUserId: 1,
      now,
      messageIdsByChatId: { 5: [] },
      messagesById: {},
    });

    expect(plan).toEqual({ action: 'none' });
  });
});
