import { Paperclip, Mic, Lock, Unlock, ChevronUp } from 'lucide-react';
import styles from '@/styles/chat.module.css';

function LockIndicator({ dragDistance, reachedLockThreshold, lockThreshold }) {
  const opacity = dragDistance > 0 ? Math.min(1, Math.max(0.5, dragDistance / 30)) : 0.5;
  const transform = `translateX(-50%) translateY(${-60 - Math.min(dragDistance * 0.5, 40)}px) scale(${reachedLockThreshold ? 1.1 : 0.9 + (dragDistance / lockThreshold) * 0.2})`;
  const transition = reachedLockThreshold
    ? 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : 'opacity 0.15s ease, transform 0.1s ease';

  return (
    <>
      <div
        className={`${styles.lockIndicator} ${reachedLockThreshold ? styles.lockIndicatorActive : ''} ${reachedLockThreshold ? styles.lockIndicatorLocked : ''}`}
        style={{ opacity, transform, transition }}
      >
        {reachedLockThreshold ? <Lock size={20} /> : <Unlock size={18} />}
        <ChevronUp
          size={16}
          style={{
            opacity: reachedLockThreshold ? 0.6 : 1,
            transform: reachedLockThreshold ? 'translateY(-2px)' : 'translateY(0)',
          }}
        />
      </div>
      <div
        className={styles.lockProgressBar}
        style={{
          height: `${Math.min((dragDistance / lockThreshold) * 80, 80)}px`,
          opacity,
          background: reachedLockThreshold
            ? 'linear-gradient(to top, #4a9eff 0%, #667eea 50%, #818cf8 100%)'
            : 'linear-gradient(to top, rgba(74, 158, 255, 0.4) 0%, rgba(129, 140, 248, 0.4) 100%)',
          width: reachedLockThreshold ? '4px' : '3px',
          boxShadow: reachedLockThreshold ? '0 0 8px rgba(74, 158, 255, 0.5)' : 'none',
        }}
      />
    </>
  );
}

function getVoiceButtonClassName(
  isRecording,
  isLocked,
  isHolding,
  dragDistance,
  reachedLockThreshold
) {
  if (isRecording && isLocked) return styles.locked;
  if (isRecording && !isLocked) return styles.recording;
  if (isHolding && dragDistance > 0 && !reachedLockThreshold) return styles.holding;
  return '';
}

export function AttachAndVoiceButtons({
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
  onAttachClick,
  onFileSelect,
  onMouseDown,
  onTouchStart,
}) {
  const showLockIndicator = !isLocked && (isHolding || isRecording);
  const voiceTitle =
    isRecording && isLocked
      ? 'Запись заблокирована'
      : 'Удерживайте для записи голосового сообщения';
  const voiceDisabled = sending || uploadingFile || (isRecording && isLocked);

  return (
    <>
      <button
        type="button"
        onClick={onAttachClick}
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
        onChange={(e) => onFileSelect?.(e)}
        accept="*/*"
        data-testid="chat-attach-input"
      />
      <div className={styles.voiceButtonWrapper} style={{ position: 'relative' }}>
        {showLockIndicator && (
          <LockIndicator
            dragDistance={dragDistance}
            reachedLockThreshold={reachedLockThreshold}
            lockThreshold={lockThreshold}
          />
        )}
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className={`${styles.voiceButton} ${getVoiceButtonClassName(isRecording, isLocked, isHolding, dragDistance, reachedLockThreshold)}`}
          title={voiceTitle}
          disabled={voiceDisabled}
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
  );
}
