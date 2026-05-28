import { renderHook, act } from '@testing-library/react';

let topicHandler = null;

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

jest.mock('@/context/messaging', () => ({
  useChats: jest.fn(),
}));

jest.mock('@/utils/api', () => ({
  chatAPI: {
    getChatState: jest.fn().mockResolvedValue({ pts: 0 }),
    getMessages: jest.fn().mockResolvedValue({ content: [] }),
  },
  getCurrentUser: jest.fn(() => ({ id: 1 })),
}));

import { useStomp } from '@/context/socket';
import { useChats } from '@/context/messaging';
import { useChatRealtime } from '../useChatRealtime';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

describe('useChatRealtime', () => {
  const upsertMessage = jest.fn();
  const replaceOptimistic = jest.fn();
  const updateMessage = jest.fn();
  const removeMessage = jest.fn();
  const setActiveChatId = jest.fn();
  const markChatAsRead = jest.fn();
  const setReadReceiptsForChat = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    topicHandler = null;

    useStomp.mockReturnValue({
      client: {
        connected: true,
        active: true,
        subscribe: jest.fn((destination, handler) => {
          if (destination === '/topic/chat/5') {
            topicHandler = handler;
          }
          return { unsubscribe: jest.fn() };
        }),
      },
      connected: true,
    });

    useChats.mockReturnValue({
      upsertMessage,
      replaceOptimistic,
      updateMessage,
      removeMessage,
      setActiveChatId,
      markChatAsRead,
      setReadReceiptsForChat,
      chats: [],
      messageIdsByChatId: {},
      messagesById: {},
    });
  });

  const serverDto = {
    id: 100,
    chatId: 5,
    senderId: 1,
    type: 'TEXT',
    content: 'hello',
    createdAt: '2026-05-28T12:00:00.000Z',
  };

  it('subscribes to chat topic when connected', async () => {
    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(useStomp().client.subscribe).toHaveBeenCalledWith('/topic/chat/5', expect.any(Function));
    expect(topicHandler).not.toBeNull();
  });

  it('upserts incoming message from peer immediately', async () => {
    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({ body: JSON.stringify({ ...serverDto, senderId: 2 }) });
    });

    expect(upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 100,
        content: 'hello',
        status: MESSAGE_STATUS.SENT,
        isOptimistic: false,
      }),
      expect.any(Object)
    );
    expect(replaceOptimistic).not.toHaveBeenCalled();
  });

  it('upserts own message when no optimistic in state (regression: no reload)', async () => {
    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({ body: JSON.stringify(serverDto) });
    });

    expect(upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 100,
        senderId: 1,
        status: MESSAGE_STATUS.SENT,
      }),
      { unreadDelta: 0 }
    );
    expect(replaceOptimistic).not.toHaveBeenCalled();
  });

  it('replaces optimistic when own message arrives and temp exists', async () => {
    const tempId = 'temp-xyz';
    useChats.mockReturnValue({
      upsertMessage,
      replaceOptimistic,
      updateMessage,
      removeMessage,
      setActiveChatId,
      markChatAsRead,
      setReadReceiptsForChat,
      chats: [],
      messageIdsByChatId: { 5: [tempId] },
      messagesById: {
        [tempId]: {
          id: tempId,
          tempId,
          chatId: 5,
          type: 'TEXT',
          isOptimistic: true,
          createdAt: new Date().toISOString(),
        },
      },
    });

    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({ body: JSON.stringify(serverDto) });
    });

    expect(replaceOptimistic).toHaveBeenCalledWith(
      '5',
      tempId,
      expect.objectContaining({ id: 100 }),
      MESSAGE_STATUS.SENT
    );
    expect(upsertMessage).not.toHaveBeenCalled();
  });

  it('unwraps MESSAGE_NEW payload before processing', async () => {
    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({
        body: JSON.stringify({
          eventType: 'MESSAGE_NEW',
          pts: 3,
          message: { ...serverDto, senderId: 2 },
        }),
      });
    });

    expect(upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 100, senderId: 2 }),
      expect.any(Object)
    );
  });
});
