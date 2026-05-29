import { render, screen, fireEvent } from '@testing-library/react';
import { MessageInputActions } from '../MessageInputActions';

jest.mock('@/component/EmojiPicker', () => {
  return function MockEmojiPicker({ open }) {
    return open ? <div data-testid="emoji-picker-panel">picker</div> : null;
  };
});

jest.mock('@/styles/chat.module.css', () => ({
  messageInputActions: 'messageInputActions',
  emojiButtonWrapper: 'emojiButtonWrapper',
  emojiButton: 'emojiButton',
}));

jest.mock('../AttachAndVoiceButtons', () => ({
  AttachAndVoiceButtons: () => <div data-testid="chat-attach-voice-group">attach-voice</div>,
}));

describe('MessageInputActions', () => {
  const baseProps = {
    showAttachAndVoice: true,
    sending: false,
    uploadingFile: false,
    editingMessageId: null,
    emojiPickerOpen: false,
    setEmojiPickerOpen: jest.fn(),
    onSelectEmoji: jest.fn(),
    fileInputRef: { current: null },
    buttonRef: { current: null },
    isRecording: false,
    isLocked: false,
    isHolding: false,
    dragDistance: 0,
    reachedLockThreshold: false,
    lockThreshold: 80,
    onAttachClick: jest.fn(),
    onFileSelect: jest.fn(),
    onMouseDown: jest.fn(),
    onTouchStart: jest.fn(),
  };

  it('renders visible emoji button in toolbar', () => {
    render(<MessageInputActions {...baseProps} />);

    const toolbar = screen.getByTestId('chat-input-actions');
    const emojiBtn = screen.getByTestId('chat-emoji-button');

    expect(toolbar).toBeInTheDocument();
    expect(emojiBtn).toBeVisible();
    expect(emojiBtn).toHaveAttribute('aria-label', 'Эмодзи, стикеры и GIF');
    expect(emojiBtn).not.toBeDisabled();
  });

  it('shows attach/voice group when showAttachAndVoice is true', () => {
    render(<MessageInputActions {...baseProps} showAttachAndVoice />);
    expect(screen.getByTestId('chat-attach-voice-group')).toBeInTheDocument();
  });

  it('hides attach/voice but keeps emoji when showAttachAndVoice is false', () => {
    render(<MessageInputActions {...baseProps} showAttachAndVoice={false} />);
    expect(screen.getByTestId('chat-emoji-button')).toBeVisible();
    expect(screen.queryByTestId('chat-attach-voice-group')).not.toBeInTheDocument();
  });

  it('opens picker on emoji button click', () => {
    const setEmojiPickerOpen = jest.fn();
    render(<MessageInputActions {...baseProps} setEmojiPickerOpen={setEmojiPickerOpen} />);

    fireEvent.click(screen.getByTestId('chat-emoji-button'));
    expect(setEmojiPickerOpen).toHaveBeenCalledWith(true);
  });
});
