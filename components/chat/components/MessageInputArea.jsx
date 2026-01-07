import { Edit, Reply, X, Paperclip, Mic, Send, Lock, Unlock, ChevronDown, File, Loader2, Pause, Play, Trash2 } from 'lucide-react';
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
  // Автоматическое изменение высоты textarea
  // Используем editingContent если редактируем, иначе newMessage
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
        <div className={styles.filePreview}>
          {selectedFile.type.startsWith('image/') ? (
            <div className={styles.imagePreview}>
              <img 
                src={selectedFileUrlRef.current} 
                alt={selectedFile.name}
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
              <File size={20} />
              <div className={styles.filePreviewDetails}>
                <div className={styles.filePreviewName}>
                  {selectedFile.name}
                </div>
                <div className={styles.filePreviewSize}>
                  {formatFileSize(selectedFile.size)}
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
                  onChange={onFileSelect}
                  accept="*/*"
                />
                <button
                  ref={buttonRef}
                  type="button"
                  onMouseDown={onMouseDown}
                  onTouchStart={onTouchStart}
                  className={styles.voiceButton}
                  title="Зажмите для записи, потяните вверх для блокировки"
                  disabled={sending}
                >
                  <Mic size={20} />
                </button>
              </>
            )}
            
            {isRecording && !isLocked && (
              <div className={styles.voiceButtonWrapper}>
                <div 
                  className={`${styles.lockIndicator} ${reachedLockThreshold ? styles.lockIndicatorActive : ''} ${reachedLockThreshold ? styles.lockIndicatorCollapse : ''}`}
                  style={{ 
                    opacity: isHolding && dragDistance > 20 ? Math.min(1, 0.4 + (dragDistance / lockThreshold) * 0.6) : 0.4,
                    transform: isHolding && dragDistance > 20 
                      ? `translateX(-50%) translateY(-${Math.min(dragDistance, lockThreshold)}px) ${reachedLockThreshold ? 'scale(0.85)' : 'scale(1)'}` 
                      : 'translateX(-50%) translateY(-20px)'
                  }}
                >
                  {reachedLockThreshold ? (
                    <Lock size={16} style={{ 
                      stroke: '#4a9eff',
                      fill: 'none',
                      strokeWidth: 2.5
                    }} />
                  ) : (
                    <Unlock size={16} style={{ 
                      color: '#666'
                    }} />
                  )}
                  <ChevronDown size={12} style={{
                    opacity: reachedLockThreshold ? 0 : 1,
                    transform: reachedLockThreshold ? 'scale(0)' : 'scale(1)',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
                <div className={styles.voiceWaves}>
                  <div 
                    className={styles.voiceWave}
                    style={{
                      width: `${48 + (audioLevel || 0) * 0.5}px`,
                      height: `${48 + (audioLevel || 0) * 0.5}px`,
                      opacity: 0.3 + (audioLevel || 0) / 300
                    }}
                  />
                  <div 
                    className={styles.voiceWave}
                    style={{
                      width: `${56 + (audioLevel || 0) * 0.6}px`,
                      height: `${56 + (audioLevel || 0) * 0.6}px`,
                      opacity: 0.2 + (audioLevel || 0) / 400
                    }}
                  />
                  <div 
                    className={styles.voiceWave}
                    style={{
                      width: `${64 + (audioLevel || 0) * 0.7}px`,
                      height: `${64 + (audioLevel || 0) * 0.7}px`,
                      opacity: 0.1 + (audioLevel || 0) / 500
                    }}
                  />
                </div>
                {recordingTime > 0 && (
                  <div className={styles.recordingTime}>
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            )}
            
            {isRecording && isLocked && !isPaused && (
              <>
                <div className={styles.voiceButtonWrapper}>
                  <div 
                    className={`${styles.lockIndicator} ${styles.lockIndicatorLocked}`}
                    style={{ 
                      opacity: 1,
                      transform: 'translateX(-50%) translateY(-80px)'
                    }}
                  >
                    <Lock size={16} style={{ 
                      stroke: '#4a9eff',
                      fill: 'none',
                      strokeWidth: 2.5
                    }} />
                  </div>
                  <div className={styles.voiceWaves}>
                    <div 
                      className={styles.voiceWave}
                      style={{
                        width: `${48 + (audioLevel || 0) * 0.5}px`,
                        height: `${48 + (audioLevel || 0) * 0.5}px`,
                        opacity: 0.3 + (audioLevel || 0) / 300
                      }}
                    />
                    <div 
                      className={styles.voiceWave}
                      style={{
                        width: `${56 + (audioLevel || 0) * 0.6}px`,
                        height: `${56 + (audioLevel || 0) * 0.6}px`,
                        opacity: 0.2 + (audioLevel || 0) / 400
                      }}
                    />
                    <div 
                      className={styles.voiceWave}
                      style={{
                        width: `${64 + (audioLevel || 0) * 0.7}px`,
                        height: `${64 + (audioLevel || 0) * 0.7}px`,
                        opacity: 0.1 + (audioLevel || 0) / 500
                      }}
                    />
                  </div>
                  <button
                    ref={buttonRef}
                    type="button"
                    className={`${styles.voiceButton} ${styles.voiceButtonRecording} ${styles.voiceButtonLocked}`}
                    title="Запись заблокирована"
                    disabled={sending}
                  >
                    <Mic size={20} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPauseRecording();
                  }}
                  className={styles.pauseButton}
                  title="Приостановить запись"
                  disabled={sending}
                >
                  <Pause size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStopRecording();
                  }}
                  className={styles.sendButton}
                  title="Отправить запись"
                  disabled={sending}
                >
                  <Send size={20} />
                </button>
              </>
            )}
            
            {isRecording && isLocked && isPaused && (
              <>
                <audio
                  ref={audioPreviewRef}
                  onEnded={() => onPlayPreview(false)}
                  onPause={() => onPlayPreview(false)}
                  onPlay={() => onPlayPreview(true)}
                />
                <div className={styles.voicePreviewBar}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCancelRecording();
                    }}
                    className={styles.voiceDeleteButton}
                    title="Удалить запись"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (audioPreviewRef.current) {
                        if (isPlayingPreview) {
                          audioPreviewRef.current.pause();
                          onPlayPreview(false);
                        } else {
                          audioPreviewRef.current.play();
                          onPlayPreview(true);
                        }
                      }
                    }}
                    className={styles.voicePlayButton}
                    title={isPlayingPreview ? "Пауза" : "Прослушать запись"}
                  >
                    {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <div className={styles.voiceWaveform}>
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className={styles.waveformBar}
                        style={{
                          height: `${20 + Math.sin(i * 0.3) * 15}px`,
                          animationDelay: `${i * 0.05}s`
                        }}
                      />
                    ))}
                  </div>
                  <span className={styles.voiceDuration}>
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (audioPreviewRef.current) {
                        audioPreviewRef.current.pause();
                        onPlayPreview(false);
                      }
                      onResumeRecording();
                    }}
                    className={styles.voiceResumeButton}
                    title="Продолжить запись"
                  >
                    <Mic size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (audioPreviewRef.current) {
                        audioPreviewRef.current.pause();
                        onPlayPreview(false);
                      }
                      onStopRecording();
                    }}
                    className={styles.voiceSendButton}
                    title="Отправить запись"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
        
        {(newMessage.trim() || editingMessageId || selectedFile) && !isRecording && (
          <button
            type="submit"
            disabled={(!newMessage.trim() && !editingMessageId && !selectedFile) || (!editingContent.trim() && editingMessageId) || sending || isRecording || uploadingFile}
            className={styles.sendButton}
            title={editingMessageId ? "Сохранить изменения" : "Отправить сообщение"}
          >
            {(sending || uploadingFile) ? (
              <Loader2 size={20} className={styles.spinner} />
            ) : (
              <Send size={20} />
            )}
          </button>
        )}
      </div>
    </form>
  );
}

