import { Smile } from 'lucide-react';
import EmojiPicker from '@/component/EmojiPicker';
import { AttachAndVoiceButtons } from './AttachAndVoiceButtons';
import styles from '@/styles/chat.module.css';

/**
 * Правая панель действий ввода: эмодзи (всегда) + скрепка/микрофон (когда поле пустое).
 */
export function MessageInputActions({
  showAttachAndVoice,
  sending,
  uploadingFile,
  editingMessageId,
  emojiButtonRef,
  emojiPickerOpen,
  setEmojiPickerOpen,
  onSelectEmoji,
  onSelectCustomEmoji,
  onSelectSticker,
  onSelectGif,
  fileInputRef,
  buttonRef,
  isRecording,
  isLocked,
  isHolding,
  dragDistance,
  reachedLockThreshold,
  lockThreshold,
  onAttachClick,
  onFileSelect,
  onMouseDown,
  onTouchStart,
}) {
  return (
    <div className={styles.messageInputActions} data-testid="chat-input-actions">
      <div className={styles.emojiButtonWrapper}>
        <button
          ref={emojiButtonRef}
          type="button"
          data-testid="chat-emoji-button"
          aria-label="Эмодзи, стикеры и GIF"
          className={styles.emojiButton}
          title="Эмодзи, стикеры и GIF"
          disabled={sending || !!editingMessageId}
          onClick={() => setEmojiPickerOpen?.(!emojiPickerOpen)}
        >
          <Smile size={22} aria-hidden />
        </button>
        <EmojiPicker
          open={emojiPickerOpen}
          anchorRef={emojiButtonRef}
          onClose={() => setEmojiPickerOpen?.(false)}
          onSelectEmoji={onSelectEmoji}
          onSelectCustomEmoji={onSelectCustomEmoji}
          onSelectSticker={onSelectSticker}
          onSelectGif={onSelectGif}
        />
      </div>

      {showAttachAndVoice && (
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
          onAttachClick={onAttachClick}
          onFileSelect={onFileSelect}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        />
      )}
    </div>
  );
}
