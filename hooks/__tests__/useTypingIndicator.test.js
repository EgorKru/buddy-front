import { renderHook, act } from '@testing-library/react';

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

import { useStomp } from '@/context/socket';
import { useTypingIndicator } from '../useTypingIndicator';

describe('useTypingIndicator', () => {
  let publishMock;
  let typingHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    publishMock = jest.fn();
    typingHandler = null;

    global.MediaStream = jest.fn();

    useStomp.mockReturnValue({
      client: {
        connected: true,
        publish: publishMock,
        subscribe: jest.fn((dest, handler) => {
          if (dest === '/topic/chat/10/typing') typingHandler = handler;
          return { unsubscribe: jest.fn() };
        }),
      },
      connected: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears peer typing on typing:false before message', () => {
    const { result } = renderHook(() => useTypingIndicator('10'));

    act(() => {
      typingHandler({
        body: JSON.stringify({ userId: 2, typing: true }),
      });
    });
    expect(result.current.typingUserIds).toEqual(['2']);

    act(() => {
      typingHandler({
        body: JSON.stringify({ userId: 2, typing: false }),
      });
    });
    expect(result.current.typingUserIds).toEqual([]);
  });

  it('clearTypingForUser removes user immediately', () => {
    const { result } = renderHook(() => useTypingIndicator('10'));

    act(() => {
      typingHandler({
        body: JSON.stringify({ userId: 3, typing: true }),
      });
    });
    expect(result.current.typingUserIds).toEqual(['3']);

    act(() => {
      result.current.clearTypingForUser(3);
    });
    expect(result.current.typingUserIds).toEqual([]);
  });

  it('stopTyping sends typing:false even after recent typing:true', () => {
    const { result } = renderHook(() => useTypingIndicator('10'));

    act(() => {
      result.current.startTyping();
    });
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('"typing":true'),
      })
    );

    publishMock.mockClear();

    act(() => {
      result.current.stopTyping();
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('"typing":false'),
      })
    );
  });
});
