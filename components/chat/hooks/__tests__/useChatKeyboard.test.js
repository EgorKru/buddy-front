import { act, renderHook } from '@testing-library/react';
import { savePreferences, DEFAULT_PREFERENCES } from '@/features/preferences';
import { useChatKeyboard } from '../useChatKeyboard';

function setup() {
  const sendMessage = jest.fn();
  const props = {
    editingMessageId: null,
    sending: false,
    isRecording: false,
    editingContent: '',
    newMessage: 'Привет',
    selectedFile: null,
    handleSaveEdit: jest.fn(),
    handleCancelEdit: jest.fn(),
    sendMessage,
  };
  const { result } = renderHook(() => useChatKeyboard(props));
  return { result, sendMessage };
}

describe('useChatKeyboard preferences', () => {
  beforeEach(() => localStorage.clear());

  it('sends with Enter by default', () => {
    const { result, sendMessage } = setup();
    const event = {
      key: 'Enter',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: jest.fn(),
    };

    act(() => result.current.handleKeyDown(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(event);
  });

  it('keeps Enter for a new line and sends with Ctrl+Enter when configured', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, enterToSend: false });
    const { result, sendMessage } = setup();
    const plainEnter = {
      key: 'Enter',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: jest.fn(),
    };
    const ctrlEnter = { ...plainEnter, ctrlKey: true, preventDefault: jest.fn() };

    act(() => result.current.handleKeyDown(plainEnter));
    expect(sendMessage).not.toHaveBeenCalled();
    expect(plainEnter.preventDefault).not.toHaveBeenCalled();

    act(() => result.current.handleKeyDown(ctrlEnter));
    expect(ctrlEnter.preventDefault).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(ctrlEnter);
  });
});
