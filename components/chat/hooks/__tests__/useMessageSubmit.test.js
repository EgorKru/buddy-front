import { renderHook, act } from '@testing-library/react';
import { useMessageSubmit } from '../useMessageSubmit';

describe('useMessageSubmit', () => {
  const defaultProps = {
    editingMessageId: null,
    handleSaveEdit: jest.fn().mockResolvedValue(undefined),
    newMessage: 'hello',
    selectedFile: null,
    user: { id: 1 },
    sending: false,
    uploadingFile: false,
    replyingToMessageId: null,
    setNewMessage: jest.fn(),
    messageActions: {
      setReplyingToMessageId: jest.fn(),
      setReplyingToMessage: jest.fn(),
    },
    prepareScrollForSending: jest.fn(),
    sendFileMessage: jest.fn().mockResolvedValue(undefined),
    sendTextMessage: jest.fn().mockResolvedValue(undefined),
    clearSelectedFile: jest.fn(),
    setSelectedFile: jest.fn(),
    setUploadingFile: jest.fn(),
    selectedFileUrlRef: { current: null },
    dismissLocalTyping: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call handleSaveEdit when editingMessageId is set', async () => {
    const handleSaveEdit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMessageSubmit({ ...defaultProps, editingMessageId: '123', handleSaveEdit })
    );

    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() };

    await act(async () => {
      await result.current(e);
    });

    expect(e.preventDefault).toHaveBeenCalled();
    expect(handleSaveEdit).toHaveBeenCalled();
    expect(defaultProps.sendTextMessage).not.toHaveBeenCalled();
  });

  it('should do nothing when no content and no file and no user', async () => {
    const { result } = renderHook(() =>
      useMessageSubmit({
        ...defaultProps,
        newMessage: '',
        selectedFile: null,
        user: null,
      })
    );

    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() };

    await act(async () => {
      await result.current(e);
    });

    expect(defaultProps.setNewMessage).not.toHaveBeenCalled();
    expect(defaultProps.sendTextMessage).not.toHaveBeenCalled();
  });

  it('should call sendTextMessage and clear reply when text is sent', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue(undefined);
    const setNewMessage = jest.fn();
    const messageActions = {
      setReplyingToMessageId: jest.fn(),
      setReplyingToMessage: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMessageSubmit({
        ...defaultProps,
        newMessage: '  hi  ',
        sendTextMessage,
        setNewMessage,
        messageActions,
      })
    );

    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() };

    await act(async () => {
      await result.current(e);
    });

    expect(defaultProps.dismissLocalTyping).toHaveBeenCalled();
    expect(setNewMessage).toHaveBeenCalledWith('');
    expect(defaultProps.prepareScrollForSending).toHaveBeenCalled();
    expect(sendTextMessage).toHaveBeenCalledWith('  hi', null, undefined);
    const dismissOrder = defaultProps.dismissLocalTyping.mock.invocationCallOrder[0];
    const sendOrder = sendTextMessage.mock.invocationCallOrder[0];
    expect(dismissOrder).toBeLessThan(sendOrder);
    expect(messageActions.setReplyingToMessageId).toHaveBeenCalledWith(null);
    expect(messageActions.setReplyingToMessage).toHaveBeenCalledWith(null);
  });
});
