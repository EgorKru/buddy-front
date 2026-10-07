import { act, renderHook } from '@testing-library/react';
import { chatAPI } from '@/utils/api';
import { useMessageSending } from '../useMessageSending';

jest.mock('@/utils/api', () => ({
  chatAPI: {
    uploadFile: jest.fn(),
    uploadImageFile: jest.fn(),
  },
}));

describe('useMessageSending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('sends an uploaded image with reply metadata instead of failing after upload', async () => {
    const reply = { id: 41, content: 'Original message' };
    const file = new File(['pixel'], 'pixel.png', { type: 'image/png' });
    const serverMessage = { id: 73, type: 'IMAGE', fileUrl: '/files/pixel.png' };
    const sendMessageHook = jest.fn().mockResolvedValue({ serverMessage });
    const addOptimistic = jest.fn();
    chatAPI.uploadImageFile.mockResolvedValue({
      fileUrl: '/files/pixel.png',
      fileSize: file.size,
      mimeType: file.type,
    });

    const { result } = renderHook(() =>
      useMessageSending({
        chatId: 7,
        user: { id: 3 },
        sendMessageHook,
        addOptimistic,
        checkIsAtBottom: jest.fn(() => true),
        saveScrollPosition: jest.fn(),
        scrollHeightBeforeMessageRef: { current: 0 },
        wasAtBottomBeforeMessageRef: { current: false },
        shouldAutoScrollRef: { current: false },
        newMessageIdsRef: { current: new Set() },
        messagesContainerRef: { current: null },
      })
    );

    await act(async () => {
      await result.current.sendFileMessage(file, 'Caption', reply.id, null, reply);
    });

    expect(chatAPI.uploadImageFile).toHaveBeenCalledWith(7, file, null);
    expect(sendMessageHook).toHaveBeenCalledWith(
      'Caption',
      'IMAGE',
      '/files/pixel.png',
      null,
      null,
      null,
      reply.id,
      file.name,
      file.size,
      file.type,
      reply
    );
    expect(addOptimistic).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ id: 73, isOptimistic: false })
    );
  });
});
