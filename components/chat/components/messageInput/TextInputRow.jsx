import { Send, Loader2 } from 'lucide-react';
import { usePasteHandler } from '../../hooks/usePasteHandler';
import { MessageTextarea } from './MessageTextarea';
import { AttachAndVoiceButtons } from './AttachAndVoiceButtons';
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

      {isEmpty && (
        <AttachAndVoiceButtons
          fileInputRef={fileInputRef}
          buttonRef={buttonRef}
          sending={sending}
          uploadingFile={uploadingFile}
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
      )}
    </>
  );
}

export function SendButton({
  editingMessageId,
  hasContent,
  selectedFile,
  isRecording,
  sending,
  uploadingFile,
}) {
  const showSend = (hasContent || editingMessageId || selectedFile) && !isRecording;
  if (!showSend) return null;

  return (
    <button
      type="submit"
      className={styles.sendButton}
      disabled={sending || uploadingFile}
      title={editingMessageId ? 'Сохранить изменения' : 'Отправить сообщение'}
    >
      {sending ? <Loader2 size={20} className={styles.spinner} /> : <Send size={20} />}
    </button>
  );
}
