import { renderHook, act } from '@testing-library/react';
import { useMessageSubmit } from '../useMessageSubmit';

function makeFile(name) {
  return new File(['x'], name, { type: 'text/plain' });
}

describe('useMessageSubmit multi-file', () => {
  const base = {
    editingMessageId: null,
    handleSaveEdit: jest.fn(),
    newMessage: 'caption',
    user: { id: 1 },
    sending: false,
    uploadingFile: false,
    replyingToMessageId: null,
    replyingToMessage: null,
    setNewMessage: jest.fn(),
    messageActions: {
      setReplyingToMessageId: jest.fn(),
      setReplyingToMessage: jest.fn(),
    },
    dismissLocalTyping: jest.fn(),
    prepareScrollForSending: jest.fn(),
    sendFileMessage: jest.fn().mockResolvedValue(undefined),
    sendMultipleFileMessages: jest.fn().mockResolvedValue([]),
    sendTextMessage: jest.fn(),
    clearSelectedFiles: jest.fn(),
    setSelectedFiles: jest.fn(),
    setUploadingFile: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('sends multiple files via sendMultipleFileMessages', async () => {
    const files = [makeFile('a.txt'), makeFile('b.png')];
    const { result } = renderHook(() => useMessageSubmit({ ...base, selectedFiles: files }));

    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    await act(async () => {
      await result.current(e);
    });

    expect(base.sendMultipleFileMessages).toHaveBeenCalledWith(files, 'caption', null, null);
    expect(base.sendFileMessage).not.toHaveBeenCalled();
    expect(base.clearSelectedFiles).toHaveBeenCalled();
  });

  it('sends single file via sendFileMessage', async () => {
    const files = [makeFile('only.pdf')];
    const { result } = renderHook(() => useMessageSubmit({ ...base, selectedFiles: files }));

    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    await act(async () => {
      await result.current(e);
    });

    expect(base.sendFileMessage).toHaveBeenCalledWith(files[0], 'caption', null, null, null);
    expect(base.sendMultipleFileMessages).not.toHaveBeenCalled();
  });
});
