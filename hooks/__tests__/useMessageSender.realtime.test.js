import { renderHook, act, waitFor } from '@testing-library/react';

const publishMock = jest.fn();
const subscribeHandlers = {};

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

jest.mock('@/utils/api', () => ({
  chatAPI: {
    sendMessage: jest.fn(),
  },
  getCurrentUser: jest.fn(() => ({
    id: 1,
    username: 'user1',
    displayName: 'User One',
  })),
}));

jest.mock('@/utils/messageQueue', () => ({
  saveMessageToQueue: jest.fn(() => true),
  updateMessageStatus: jest.fn(),
  removeMessageFromQueue: jest.fn(),
  getMessageQueue: jest.fn(() => []),
  MESSAGE_STATUS: {
    PENDING: 'pending',
    SENDING: 'sending',
    SENT: 'sent',
    FAILED: 'failed',
  },
}));

jest.mock('@/shared/lib/e2ee/directTextE2ee', () => ({
  isE2eeEnabled: jest.fn(() => false),
}));

import { useStomp } from '@/context/socket';
import { chatAPI } from '@/utils/api';
import { useMessageSender } from '../useMessageSender';

describe('useMessageSender realtime delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(subscribeHandlers).forEach((k) => delete subscribeHandlers[k]);

    useStomp.mockReturnValue({
      client: {
        connected: true,
        active: true,
        publish: publishMock,
        subscribe: jest.fn((destination, handler) => {
          subscribeHandlers[destination] = handler;
          return { unsubscribe: jest.fn() };
        }),
      },
      connected: true,
    });

    chatAPI.sendMessage.mockResolvedValue({
      id: 42,
      chatId: 5,
      senderId: 1,
      type: 'TEXT',
      content: 'Hi',
      createdAt: '2026-05-28T12:00:00.000Z',
      encryptionVersion: 0,
    });
  });

  it('calls onBeforeSend then REST sendMessage for TEXT (STOMP broadcast on server)', async () => {
    const callOrder = [];
    const onBeforeSend = jest.fn(() => callOrder.push('onBeforeSend'));
    chatAPI.sendMessage.mockImplementation(async () => {
      callOrder.push('rest');
      return {
        id: 42,
        chatId: 5,
        senderId: 1,
        type: 'TEXT',
        content: 'Привет',
        createdAt: '2026-05-28T12:00:00.000Z',
      };
    });

    const { result } = renderHook(() =>
      useMessageSender('5', null, {
        directPeerUserId: 2,
        onBeforeSend,
      })
    );

    await act(async () => {
      await result.current.sendMessage('Привет', 'TEXT');
    });

    expect(onBeforeSend).toHaveBeenCalledTimes(1);
    expect(chatAPI.sendMessage).toHaveBeenCalled();
    const [cid, text, type] = chatAPI.sendMessage.mock.calls[0];
    expect(String(cid)).toBe('5');
    expect(text).toBe('Привет');
    expect(type).toBe('TEXT');
    expect(publishMock).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['onBeforeSend', 'rest']);
  });

  it('invokes onMessageSent with server message from REST response', async () => {
    const onMessageSent = jest.fn();

    const { result } = renderHook(() =>
      useMessageSender('5', onMessageSent, {
        directPeerUserId: 2,
        onBeforeSend: jest.fn(),
      })
    );

    await act(async () => {
      await result.current.sendMessage('Hi', 'TEXT');
    });

    await waitFor(() => {
      expect(onMessageSent).toHaveBeenCalled();
    });

    const [confirmation, tempId] = onMessageSent.mock.calls[0];
    expect(confirmation.status).toBe('sent');
    expect(confirmation.message.id).toBe(42);
    expect(tempId).toMatch(/^temp-/);
  });

  it('uses WebSocket publish for non-TEXT when connected', async () => {
    const { result } = renderHook(() =>
      useMessageSender('5', null, {
        directPeerUserId: 2,
        onBeforeSend: jest.fn(),
      })
    );

    await act(async () => {
      await result.current.sendMessage('', 'IMAGE', 'http://x/img.png');
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/chat.sendMessage',
      })
    );
    expect(chatAPI.sendMessage).not.toHaveBeenCalled();
  });
});
