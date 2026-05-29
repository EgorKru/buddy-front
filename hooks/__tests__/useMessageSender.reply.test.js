import { renderHook, act } from '@testing-library/react';

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

jest.mock('@/utils/api', () => ({
  getCurrentUser: jest.fn(() => ({
    id: 1,
    username: 'me',
    displayName: 'Me',
  })),
  chatAPI: {
    sendMessage: jest.fn(),
  },
}));

jest.mock('@/utils/messageQueue', () => ({
  saveMessageToQueue: jest.fn(() => true),
  updateMessageStatus: jest.fn(),
  removeMessageFromQueue: jest.fn(),
  syncMessageQueue: jest.fn(),
  getMessageQueue: jest.fn(() => []),
  MESSAGE_STATUS: { SENDING: 'SENDING', SENT: 'SENT', FAILED: 'FAILED' },
}));

import { useStomp } from '@/context/socket';
import { chatAPI } from '@/utils/api';
import { useMessageSender } from '../useMessageSender';

describe('useMessageSender reply preview', () => {
  const parentMessage = {
    id: 42,
    senderId: 2,
    senderUsername: 'peer',
    senderDisplayName: 'Peer',
    content: 'Question?',
    type: 'TEXT',
    createdAt: '2026-01-01T12:00:00.000Z',
  };

  let onBeforeSend;

  beforeEach(() => {
    jest.clearAllMocks();
    onBeforeSend = jest.fn();
    useStomp.mockReturnValue({
      client: { connected: true, active: true, publish: jest.fn() },
      connected: true,
    });
    chatAPI.sendMessage.mockResolvedValue({
      id: 100,
      chatId: 5,
      content: 'Answer',
      type: 'TEXT',
      senderId: 1,
      replyTo: {
        id: 42,
        senderId: 2,
        senderDisplayName: 'Peer',
        content: 'Question?',
        type: 'TEXT',
      },
    });
  });

  it('adds replyTo to optimistic message immediately', async () => {
    const { result } = renderHook(() =>
      useMessageSender('5', null, {
        onBeforeSend,
      })
    );

    await act(async () => {
      await result.current.sendMessage(
        'Answer',
        'TEXT',
        null,
        null,
        null,
        null,
        42,
        null,
        null,
        null,
        parentMessage
      );
    });

    expect(onBeforeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToMessageId: 42,
        replyTo: expect.objectContaining({
          id: 42,
          content: 'Question?',
          senderDisplayName: 'Peer',
        }),
      })
    );
  });
});
