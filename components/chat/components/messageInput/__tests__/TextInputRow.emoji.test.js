import { render, screen } from '@testing-library/react';
import { TextInputRow } from '../TextInputRow';

jest.mock('@/styles/chat.module.css', () => new Proxy({}, { get: (_, key) => String(key) }));

jest.mock('../../../hooks/usePasteHandler', () => ({
  usePasteHandler: () => () => {},
}));

jest.mock('../MessageTextarea', () => ({
  MessageTextarea: () => <textarea data-testid="chat-message-input" />,
}));

jest.mock('../MessageInputActions', () => ({
  MessageInputActions: ({ showAttachAndVoice }) => (
    <div data-testid="chat-input-actions" data-show-attach={String(showAttachAndVoice)}>
      <button type="button" data-testid="chat-emoji-button">
        emoji
      </button>
    </div>
  ),
}));

describe('TextInputRow emoji toolbar', () => {
  const baseProps = {
    newMessage: '',
    editingMessageId: null,
    editingContent: '',
    messageInputRef: { current: null },
    fileInputRef: { current: null },
    buttonRef: { current: null },
    sending: false,
    uploadingFile: false,
    isRecording: false,
    isLocked: false,
    isHolding: false,
    dragDistance: 0,
    reachedLockThreshold: false,
    lockThreshold: 80,
    onMessageChange: jest.fn(),
    onEditingContentChange: jest.fn(),
    onKeyDown: jest.fn(),
    onFileSelect: jest.fn(),
    onMouseDown: jest.fn(),
    onTouchStart: jest.fn(),
    setEmojiPickerOpen: jest.fn(),
  };

  it('always includes emoji button next to input', () => {
    render(<TextInputRow {...baseProps} />);
    expect(screen.getByTestId('chat-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('chat-emoji-button')).toBeInTheDocument();
  });

  it('passes showAttachAndVoice=true when message is empty', () => {
    render(<TextInputRow {...baseProps} newMessage="" />);
    expect(screen.getByTestId('chat-input-actions')).toHaveAttribute('data-show-attach', 'true');
  });

  it('passes showAttachAndVoice=false when user typed text', () => {
    render(<TextInputRow {...baseProps} newMessage="hello" />);
    expect(screen.getByTestId('chat-input-actions')).toHaveAttribute('data-show-attach', 'false');
    expect(screen.getByTestId('chat-emoji-button')).toBeInTheDocument();
  });
});
