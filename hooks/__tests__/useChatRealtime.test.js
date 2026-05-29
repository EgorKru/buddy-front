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

  it('does not trigger gap recovery on first message when local pts is 0', async () => {
    const { chatAPI } = require('@/utils/api');
    chatAPI.getChatUpdates = jest.fn();

    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({
        body: JSON.stringify({
          id: 200,
          chatId: 5,
          senderId: 2,
          type: 'TEXT',
          content: 'first',
          createdAt: '2026-05-28T12:00:00.000Z',
          pts: 10,
          ptsCount: 1,
        }),
      });
    });

    expect(chatAPI.getChatUpdates).not.toHaveBeenCalled();
    expect(upsertMessage).toHaveBeenCalled();
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

  it('marks chat as read after incoming peer message when tab is visible', async () => {
    jest.useFakeTimers();

    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({ body: JSON.stringify({ ...serverDto, senderId: 2 }) });
    });

    expect(markChatAsRead).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(markChatAsRead).toHaveBeenCalledWith('5');

    jest.useRealTimers();
  });

  it('upserts peer reply with replyTo hydrated from local cache', async () => {
    const parent = {
      id: 41,
      chatId: 5,
      senderId: 2,
      senderUsername: 'peer',
      senderDisplayName: 'Peer',
      content: 'Parent text',
      type: 'TEXT',
      createdAt: '2026-01-01T10:00:00.000Z',
    };

    useChats.mockReturnValue({
      upsertMessage,
      replaceOptimistic,
      updateMessage,
      removeMessage,
      setActiveChatId,
      markChatAsRead,
      setReadReceiptsForChat,
      chats: [],
      messageIdsByChatId: { 5: ['41'] },
      messagesById: { 41: parent },
    });

    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({
        body: JSON.stringify({
          id: 42,
          chatId: 5,
          senderId: 2,
          content: 'Reply text',
          type: 'TEXT',
          replyToMessageId: 41,
        }),
      });
    });

    expect(upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        replyTo: expect.objectContaining({
          id: 41,
          content: 'Parent text',
        }),
      }),
      expect.any(Object)
    );
  });

  it('calls onPeerMessage before upsert for peer message', async () => {
    const onPeerMessage = jest.fn();
    const callOrder = [];

    onPeerMessage.mockImplementation(() => {
      callOrder.push('typing-clear');
    });
    upsertMessage.mockImplementation(() => {
      callOrder.push('upsert');
    });

    renderHook(() => useChatRealtime('5', { onPeerMessage }));

    await act(async () => {
      topicHandler({ body: JSON.stringify({ ...serverDto, senderId: 2 }) });
    });

    expect(onPeerMessage).toHaveBeenCalledWith(2);
    expect(callOrder).toEqual(['typing-clear', 'upsert']);
  });

  it('does not call onPeerMessage for own message', async () => {
    const onPeerMessage = jest.fn();

    renderHook(() => useChatRealtime('5', { onPeerMessage }));

    await act(async () => {
      topicHandler({ body: JSON.stringify(serverDto) });
    });

    expect(onPeerMessage).not.toHaveBeenCalled();
  });

  it('does not mark chat as read for own incoming message', async () => {
    jest.useFakeTimers();

    renderHook(() => useChatRealtime('5'));

    await act(async () => {
      topicHandler({ body: JSON.stringify(serverDto) });
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(markChatAsRead).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
