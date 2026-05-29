import { Send, Loader2 } from 'lucide-react';
import { usePasteHandler } from '../../hooks/usePasteHandler';
import { MessageTextarea } from './MessageTextarea';
import { MessageInputActions } from './MessageInputActions';
import styles from '@/styles/chat.module.css';

export function TextInputRow({
  newMessage,
  editingMessageId,
  editingContent,
  messageInputRef,
  fileInputRef,
  buttonRef,
  sending,
  uploadingFile,
  isRecording,
  isLocked,
  isHolding,
  dragDistance,
  reachedLockThreshold,
  lockThreshold,
  onMessageChange,
  onEditingContentChange,
  onKeyDown,
  onFileSelect,
  onMouseDown,
  onTouchStart,
  emojiButtonRef,
  emojiPickerOpen,
  setEmojiPickerOpen,
  onSelectEmoji,
  onSelectCustomEmoji,
  onSelectSticker,
  onSelectGif,
}) {
  const handlePaste = usePasteHandler(editingMessageId, isRecording, sending, onFileSelect);
  const textareaValue = editingMessageId ? editingContent : newMessage;
  const isEmpty = !newMessage.trim() && !editingMessageId;

  const handleAttachClick = () => fileInputRef.current?.click();

  return (
    <>
      <MessageTextarea
        value={textareaValue}
        messageInputRef={messageInputRef}
        editingMessageId={editingMessageId}
        disabled={sending}
        onMessageChange={onMessageChange}
        onEditingContentChange={onEditingContentChange}
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
      />

      <MessageInputActions
        showAttachAndVoice={isEmpty}
        sending={sending}
        uploadingFile={uploadingFile}
        editingMessageId={editingMessageId}
        emojiButtonRef={emojiButtonRef}
        emojiPickerOpen={emojiPickerOpen}
        setEmojiPickerOpen={setEmojiPickerOpen}
        onSelectEmoji={onSelectEmoji}
        onSelectCustomEmoji={onSelectCustomEmoji}
        onSelectSticker={onSelectSticker}
        onSelectGif={onSelectGif}
        fileInputRef={fileInputRef}
        buttonRef={buttonRef}
        isRecording={isRecording}
        isLocked={isLocked}
        isHolding={isHolding}
        dragDistance={dragDistance}
        reachedLockThreshold={reachedLockThreshold}
        lockThreshold={lockThreshold}
        onAttachClick={handleAttachClick}
        onFileSelect={onFileSelect}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      />
    </>
  );
}

export function SendButton({
  editingMessageId,
  hasContent,
  hasSelectedFiles,
  selectedFile,
  isRecording,
  sending,
  uploadingFile,
}) {
  const showSend =
    (hasContent || editingMessageId || hasSelectedFiles || selectedFile) && !isRecording;
  if (!showSend) return null;

  return (
    <button
      type="submit"
      data-testid="chat-send-button"
      className={styles.sendButton}
      disabled={sending || uploadingFile}
      title={editingMessageId ? 'Сохранить изменения' : 'Отправить сообщение'}
    >
      {sending ? <Loader2 size={20} className={styles.spinner} /> : <Send size={20} />}
    </button>
  );
}
