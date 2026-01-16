import { useEffect } from 'react';
import { Edit, Reply, X, Paperclip, Mic, Send, Lock, Unlock, ChevronDown, File as FileIcon, Loader2, Pause, Play, Trash2 } from 'lucide-react';
import { formatFileSize } from '../utils/messageHelpers';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import styles from '@/styles/chat.module.css';

export default function MessageInputArea({
  newMessage,
  editingMessageId,
  editingContent,
  replyingToMessage,
  selectedFile,
  selectedFileUrlRef,
  isRecording,
  isLocked,
  isHolding,
  dragDistance,
  reachedLockThreshold,
  lockThreshold,
  isPaused,
  isPlayingPreview,
  sending,
  uploadingFile,
  messageInputRef,
  fileInputRef,
  buttonRef,
  audioPreviewRef,
  onMessageChange,
  onEditingContentChange,
  onSendMessage,
  onSaveEdit,
  onCancelEdit,
  onCancelReply,
  onFileSelect,
  onRemoveFile,
  onMouseDown,
  onTouchStart,
  onKeyDown,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onCancelRecording,
  onPlayPreview,
  recordingTime,
  audioLevel
}) {
  const textareaValue = editingMessageId ? editingContent : newMessage;
  useAutoResizeTextarea(messageInputRef, textareaValue);

  return (
    <form onSubmit={editingMessageId ? onSaveEdit : onSendMessage} className={styles.messageForm}>
      {editingMessageId && (
        <div className={styles.editIndicator}>
          <Edit size={14} strokeWidth={1.5} />
          <span>Редактирование</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className={styles.cancelEditButton}
            title="Отменить редактирование"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
      
      {replyingToMessage && (
        <div className={styles.replyIndicator}>
          <Reply size={16} strokeWidth={1.5} />
          <div className={styles.replyIndicatorContent}>
            <div className={styles.replyIndicatorAuthor}>
              В ответ {replyingToMessage.senderDisplayName || replyingToMessage.senderUsername}
            </div>
            <div className={styles.replyIndicatorText}>
              {replyingToMessage.type === 'VOICE' ? '🎤 Голосовое сообщение' : 
               replyingToMessage.type === 'IMAGE' ? '📷 Фото' :
               replyingToMessage.type === 'FILE' ? '📎 Файл' :
               replyingToMessage.content || ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className={styles.cancelReplyButton}
            title="Отменить ответ"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
      
      {selectedFile && (
        <div 
          key={`file-preview-${selectedFile.name}-${selectedFile.size}`}
          className={styles.filePreview}
        >
            {selectedFile.type && selectedFile.type.startsWith('image/') ? (
            <div className={styles.imagePreview}>
              <img 
                src={selectedFileUrlRef?.current || ''} 
                alt={selectedFile.name || 'Preview'}
                className={styles.previewImage}
              />
              <button
                type="button"
                onClick={onRemoveFile}
                className={styles.removeFileButton}
                title="Удалить файл"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className={styles.filePreviewInfo}>
              <FileIcon size={20} />
              <div className={styles.filePreviewDetails}>
                <div className={styles.filePreviewName}>
                  {selectedFile.name || 'Файл'}
                </div>
                <div className={styles.filePreviewSize}>
                  {formatFileSize(selectedFile.size || 0)}
                </div>
              </div>
              <button
                type="button"
                onClick={onRemoveFile}
                className={styles.removeFileButton}
                title="Удалить файл"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className={styles.messageFormRow}>
        <textarea
          ref={messageInputRef}
          id="chat-message-input"
          name="message"
          value={editingMessageId ? editingContent : newMessage}
          onChange={(e) => {
            if (editingMessageId) {
              onEditingContentChange(e.target.value);
            } else {
              onMessageChange(e.target.value);
            }
          }}
          onKeyDown={onKeyDown}
          onPaste={async (e) => {
            if (editingMessageId || isRecording || sending) return;
            
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob && onFileSelect) {
                  const file = new File([blob], `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                  const syntheticEvent = {
                    target: {
                      files: [file],
                      value: ''
                    }
                  };
                  onFileSelect(syntheticEvent);
                }
                break;
              }
            }
          }}
          placeholder={isRecording ? "Идет запись..." : editingMessageId ? "Редактируйте сообщение..." : "Введите сообщение..."}
          disabled={sending || isRecording}
          className={styles.messageInput}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={1}
        />
        
        {!newMessage.trim() && !editingMessageId && (
          <>
            {!isRecording && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.attachButton}
                  title="Прикрепить файл или изображение"
                  disabled={sending || uploadingFile}
                >
                  <Paperclip size={20} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (onFileSelect) {
                      onFileSelect(e);
                    }
                  }}
                  accept="*/*"
                />
              </>
            )}
            
            {isRecording && (
              <>
                <button
                  type="button"
                  onClick={isPaused ? onResumeRecording : onPauseRecording}
                  className={styles.recordButton}
                  title={isPaused ? "Возобновить запись" : "Приостановить запись"}
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
                <button
                  type="button"
                  onClick={onStopRecording}
                  className={styles.stopRecordButton}
                  title="Остановить запись"
                >
                  <Lock size={20} />
                </button>
                <div className={styles.recordingTime}>
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </div>
                {audioLevel !== undefined && (
                  <div className={styles.audioLevel}>
                    <div 
                      className={styles.audioLevelBar}
                      style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {(newMessage.trim() || editingMessageId) && (
          <button
            type="submit"
            className={styles.sendButton}
            disabled={sending || uploadingFile}
            title={editingMessageId ? "Сохранить изменения" : "Отправить сообщение"}
          >
            {sending ? <Loader2 size={20} className={styles.spinner} /> : <Send size={20} />}
          </button>
        )}
        
        {isRecording && (
          <button
            type="button"
            onClick={onCancelRecording}
            className={styles.cancelRecordButton}
            title="Отменить запись"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
      
      {isPlayingPreview && audioPreviewRef && (
        <audio
          ref={audioPreviewRef}
          autoPlay
          onEnded={onPlayPreview}
          style={{ display: 'none' }}
        />
      )}
    </form>
  );
}