import { useEffect, useState } from 'react';
import { Edit, Reply, X, Paperclip, Mic, Send, Lock, Unlock, ChevronDown, ChevronUp, File as FileIcon, Loader2, Pause, Play, Trash2, Volume2 } from 'lucide-react';
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!audioPreviewRef?.current || !isRecording || !isLocked) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const audio = audioPreviewRef.current;
    if (!audio) return;
    
    const updateTime = () => {
      if (audio && audio.duration && Number.isFinite(audio.duration)) {
        setCurrentTime(audio.currentTime || 0);
        setDuration(audio.duration || 0);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio && audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleDurationChange = () => {
      if (audio && audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    // Обновляем время сразу если доступно
    if (audio.duration && Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
    if (audio.currentTime && Number.isFinite(audio.currentTime)) {
      setCurrentTime(audio.currentTime);
    }

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);

    return () => {
      if (audio) {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('durationchange', handleDurationChange);
      }
    };
  }, [audioPreviewRef, isRecording, isLocked]);

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
        {isRecording && !isLocked && !isHolding ? (
          <>
            <div className={styles.voiceRecordingBar}>
              <div className={styles.voiceRecordingTime}>
                {Math.floor((recordingTime || 0) / 60)}:{((recordingTime || 0) % 60).toString().padStart(2, '0')}
              </div>
              <div className={styles.voiceRecordingLine} />
              <button
                type="button"
                onClick={isPaused ? onResumeRecording : onPauseRecording}
                className={styles.voiceActionButton}
                title={isPaused ? "Возобновить запись" : "Приостановить запись"}
              >
                {isPaused ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <button
                type="button"
                onClick={onCancelRecording}
                className={styles.voiceActionButton}
                title="Удалить запись"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className={styles.voiceCancelHint}>
              Для отмены отпустите курсор вне поля
            </div>
          </>
        ) : isRecording && isLocked ? (
          <div className={styles.voicePreviewBar}>
            <div className={styles.voiceLockIcon}>
              <Lock size={16} />
            </div>
            <button
              type="button"
              onClick={onCancelRecording}
              className={styles.voiceDeleteButton}
              title="Удалить запись"
            >
              <Trash2 size={20} />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (audioPreviewRef?.current) {
                  try {
                    if (isPlayingPreview) {
                      audioPreviewRef.current.pause();
                      onPlayPreview(false);
                    } else {
                      await audioPreviewRef.current.play();
                      onPlayPreview(true);
                    }
                  } catch (error) {
                    console.error('Error playing audio:', error);
                    onPlayPreview(false);
                  }
                }
              }}
              className={styles.voicePlayButton}
              title={isPlayingPreview ? "Пауза" : "Прослушать"}
            >
              {isPlayingPreview ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div className={styles.voiceWaveform}>
              {Array.from({ length: 50 }).map((_, i) => {
                const progress = duration > 0 ? currentTime / duration : 0;
                const isPlayed = i < progress * 50;
                const baseHeight = 6;
                const variation = Math.sin(i * 0.25) * 5;
                const height = baseHeight + variation;
                return (
                  <div
                    key={i}
                    className={`${styles.waveformBar} ${isPlayed ? styles.played : ''}`}
                    style={{ 
                      height: `${Math.max(4, height)}px`,
                      opacity: isPlayed ? 1 : 0.4
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.voiceDuration}>
              {duration > 0
                ? `${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')} / ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`
                : `${Math.floor((recordingTime || 0) / 60)}:${((recordingTime || 0) % 60).toString().padStart(2, '0')}`
              }
            </div>
            <button
              type="button"
              onClick={onStopRecording}
              className={styles.voiceSendButton}
              title="Отправить запись"
            >
              <Send size={20} />
            </button>
          </div>
        ) : (
          <>
            {isRecording && !isLocked ? (
              <div className={styles.voiceRecordingInput}>
                <div className={styles.voiceRecordingTime}>
                  {Math.floor((recordingTime || 0) / 60)}:{((recordingTime || 0) % 60).toString().padStart(2, '0')}
                </div>
              </div>
            ) : (
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
                placeholder={editingMessageId ? "Редактируйте сообщение..." : "Введите сообщение..."}
                disabled={sending}
                className={styles.messageInput}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                rows={1}
              />
            )}
            
            {!newMessage.trim() && !editingMessageId && (
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
                <div className={styles.voiceButtonWrapper} style={{ position: 'relative' }}>
                  {!isLocked && (isHolding || isRecording) && (
                    <>
                      <div 
                        className={`${styles.lockIndicator} ${reachedLockThreshold ? styles.lockIndicatorActive : ''} ${reachedLockThreshold ? styles.lockIndicatorLocked : ''}`}
                        style={{
                          opacity: dragDistance > 0 ? Math.min(1, Math.max(0.5, dragDistance / 30)) : 0.5,
                          transform: `translateX(-50%) translateY(${-60 - Math.min(dragDistance * 0.5, 40)}px) scale(${reachedLockThreshold ? 1.1 : 0.9 + (dragDistance / lockThreshold) * 0.2})`,
                          transition: reachedLockThreshold ? 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'opacity 0.15s ease, transform 0.1s ease'
                        }}
                      >
                        {reachedLockThreshold ? <Lock size={20} /> : <Unlock size={18} />}
                        <ChevronUp size={16} style={{ 
                          opacity: reachedLockThreshold ? 0.6 : 1,
                          transform: reachedLockThreshold ? 'translateY(-2px)' : 'translateY(0)'
                        }} />
                      </div>
                      <div 
                        className={styles.lockProgressBar}
                        style={{
                          height: `${Math.min((dragDistance / lockThreshold) * 80, 80)}px`,
                          opacity: dragDistance > 0 ? Math.min(1, Math.max(0.5, dragDistance / 30)) : 0.5,
                          background: reachedLockThreshold 
                            ? 'linear-gradient(to top, #4a9eff 0%, #667eea 50%, #818cf8 100%)'
                            : 'linear-gradient(to top, rgba(74, 158, 255, 0.4) 0%, rgba(129, 140, 248, 0.4) 100%)',
                          width: reachedLockThreshold ? '4px' : '3px',
                          boxShadow: reachedLockThreshold ? '0 0 8px rgba(74, 158, 255, 0.5)' : 'none'
                        }}
                      />
                    </>
                  )}
                  <button
                    ref={buttonRef}
                    type="button"
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                    className={`${styles.voiceButton} ${
                      isRecording && isLocked 
                        ? styles.locked 
                        : isRecording && !isLocked 
                        ? styles.recording 
                        : isHolding && dragDistance > 0 && !reachedLockThreshold
                        ? styles.holding 
                        : ''
                    }`}
                    title={isRecording && isLocked ? "Запись заблокирована" : "Удерживайте для записи голосового сообщения"}
                    disabled={sending || uploadingFile || (isRecording && isLocked)}
                  >
                    {isRecording && !isLocked ? (
                      <div className={styles.recordingIndicator}>
                        <div className={styles.recordingDot} />
                      </div>
                    ) : (
                      <Mic size={20} />
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        
        {(newMessage.trim() || editingMessageId) && !isRecording && (
          <button
            type="submit"
            className={styles.sendButton}
            disabled={sending || uploadingFile}
            title={editingMessageId ? "Сохранить изменения" : "Отправить сообщение"}
          >
            {sending ? <Loader2 size={20} className={styles.spinner} /> : <Send size={20} />}
          </button>
        )}
        
      </div>
      
      {isRecording && isLocked && audioPreviewRef && (
        <audio
          ref={audioPreviewRef}
          onTimeUpdate={() => {
            if (audioPreviewRef.current) {
              const audio = audioPreviewRef.current;
              // Проверяем, что воспроизведение закончилось
              if (audio.duration && Number.isFinite(audio.duration) && 
                  audio.currentTime && Number.isFinite(audio.currentTime) &&
                  audio.duration > 0 && audio.currentTime >= audio.duration - 0.1) {
                onPlayPreview(false);
              }
            }
          }}
          onEnded={() => {
            onPlayPreview(false);
          }}
          onPause={() => {
            // Если пауза не была вызвана пользователем, сбрасываем состояние
            if (audioPreviewRef.current && audioPreviewRef.current.ended) {
              onPlayPreview(false);
            }
          }}
          onError={(e) => {
            console.error('Audio playback error:', e);
            onPlayPreview(false);
          }}
          style={{ display: 'none' }}
        />
      )}
    </form>
  );
}