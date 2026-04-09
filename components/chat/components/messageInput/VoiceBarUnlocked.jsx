import { Pause, Play, Trash2 } from 'lucide-react';
import styles from '@/styles/chat.module.css';

export function VoiceBarUnlocked({
  recordingTime,
  isPaused,
  onPauseRecording,
  onResumeRecording,
  onCancelRecording,
}) {
  const formattedTime = `${Math.floor((recordingTime || 0) / 60)}:${((recordingTime || 0) % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <div className={styles.voiceRecordingBar}>
        <div className={styles.voiceRecordingTime}>{formattedTime}</div>
        <div className={styles.voiceRecordingLine} />
        <button
          type="button"
          onClick={isPaused ? onResumeRecording : onPauseRecording}
          className={styles.voiceActionButton}
          title={isPaused ? 'Возобновить запись' : 'Приостановить запись'}
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
      <div className={styles.voiceCancelHint}>Для отмены отпустите курсор вне поля</div>
    </>
  );
}
