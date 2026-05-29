import { useAutoResizeTextarea } from '../../hooks/useAutoResizeTextarea';
import styles from '@/styles/chat.module.css';

export function MessageTextarea({
  value,
  messageInputRef,
  editingMessageId,
  disabled,
  onMessageChange,
  onEditingContentChange,
  onKeyDown,
  onPaste,
}) {
  useAutoResizeTextarea(messageInputRef, value);

  const placeholder = editingMessageId ? 'Редактируйте сообщение...' : 'Введите сообщение...';

  const handleChange = (e) => {
    if (editingMessageId) {
      onEditingContentChange(e.target.value);
    } else {
      onMessageChange(e.target.value);
    }
  };

  return (
    <textarea
      ref={messageInputRef}
      id="chat-message-input"
      data-testid="chat-message-input"
      name="message"
      value={value}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      disabled={disabled}
      className={styles.messageInput}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      rows={1}
    />
  );
}
