import { renderHook, act } from '@testing-library/react';
import { MessagingProvider, useChats } from '../messaging';

const mockPublish = jest.fn();

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

jest.mock('@/utils/api', () => ({
  chatAPI: {
    getChats: jest.fn().mockResolvedValue([]),
    markChatAsRead: jest.fn().mockResolvedValue({}),
  },
  getCurrentUser: jest.fn(() => ({ id: 2 })),
  isAuthenticated: jest.fn(() => true),
  getToken: jest.fn(() => 'token'),
}));

import { useStomp } from '@/context/socket';
import { chatAPI } from '@/utils/api';

const wrapper = ({ children }) => <MessagingProvider>{children}</MessagingProvider>;

describe('MessagingProvider mark read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStomp.mockReturnValue({
      client: { publish: mockPublish, connected: true },
      connected: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('marks active chat as read when opening chat even if unread was cleared locally', async () => {
    const { result } = renderHook(() => useChats(), { wrapper });

    await act(async () => {
      result.current.upsertMessage(
        {
          id: 501,
          chatId: 7,
          senderId: 1,
          type: 'TEXT',
          content: 'while away',
          createdAt: '2026-05-28T12:00:00.000Z',
        },
        { unreadDelta: 1 }
      );
    });

    await act(async () => {
      result.current.setActiveChatId(7);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(chatAPI.markChatAsRead).toHaveBeenCalledWith('7');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/chat.markRead',
      })
    );
  });

  it('marks active chat as read when tab becomes visible again', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    const { result } = renderHook(() => useChats(), { wrapper });

    await act(async () => {
      result.current.setActiveChatId(8);
    });

    expect(chatAPI.markChatAsRead).not.toHaveBeenCalled();

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(chatAPI.markChatAsRead).toHaveBeenCalledWith('8');
  });
});
