import { renderHook, act } from '@testing-library/react';
import { useEmojiMedia } from '../useEmojiMedia';

jest.mock('@/src/shared/api/media', () => ({
  mediaAPI: {
    getEmojiPacks: jest.fn(() => new Promise(() => {})),
    toggleReaction: jest.fn(),
  },
}));

describe('useEmojiMedia', () => {
  const baseArgs = {
    chatId: '1',
    user: { id: 42 },
    sendMessageHook: jest.fn(async () => ({
      serverMessage: { id: 10, content: 'ok' },
    })),
    addOptimistic: jest.fn(),
    updateMessage: jest.fn(),
    contextMenu: null,
    setContextMenu: jest.fn(),
  };

  it('keeps picker open after selecting standard emoji', () => {
    const { result } = renderHook(() => useEmojiMedia(baseArgs));

    act(() => {
      result.current.setEmojiPickerOpen(true);
      result.current.handleSelectEmoji('😀', jest.fn());
    });

    expect(result.current.emojiPickerOpen).toBe(true);
  });

  it('sends animated custom emoji as GIF', async () => {
    const sendMessageHook = jest.fn(async () => ({ serverMessage: { id: 1 } }));
    const { result } = renderHook(() => useEmojiMedia({ ...baseArgs, sendMessageHook }));

    await act(async () => {
      await result.current.handleSelectCustomEmoji({
        id: 5,
        fileUrl: '/system/telegram-animated/emoji-people/125.gif',
      });
    });

    expect(sendMessageHook).toHaveBeenCalled();
    expect(sendMessageHook.mock.calls[0][1]).toBe('GIF');
    expect(sendMessageHook.mock.calls[0][11]).toEqual({ customEmojiId: 5 });
  });

  it('keeps picker open after selecting sticker', async () => {
    const { result } = renderHook(() => useEmojiMedia(baseArgs));

    act(() => {
      result.current.setEmojiPickerOpen(true);
    });

    await act(async () => {
      await result.current.handleSelectSticker({ id: 77 });
    });

    expect(result.current.emojiPickerOpen).toBe(true);
  });
});
