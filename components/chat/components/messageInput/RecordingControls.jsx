import { VoiceBarUnlocked } from './VoiceBarUnlocked';
import { VoiceBarLocked } from './VoiceBarLocked';
import styles from '@/styles/chat.module.css';

export function RecordingControls({
  isRecording,
  isLocked,
  isHolding,
  recordingTime,
  isPaused,
  isPlayingPreview,
  duration,
  currentTime,
  previewBlobUrl,
  audioPreviewRef,
  setCurrentTime,
  onPauseRecording,
  onResumeRecording,
  onCancelRecording,
  onStopRecording,
  onPlayPreview,
}) {
  if (!isRecording) return null;

  if (!isLocked && !isHolding) {
    return (
      <>
        <VoiceBarUnlocked
          recordingTime={recordingTime}
          isPaused={isPaused}
          onPauseRecording={onPauseRecording}
          onResumeRecording={onResumeRecording}
          onCancelRecording={onCancelRecording}
        />
      </>
    );
  }

  if (isLocked) {
    return (
      <div className={styles.voiceRecordingInput}>
        <VoiceBarLocked
          recordingTime={recordingTime}
          isPaused={isPaused}
          isPlayingPreview={isPlayingPreview}
          duration={duration}
          currentTime={currentTime}
          previewBlobUrl={previewBlobUrl}
          audioPreviewRef={audioPreviewRef}
          setCurrentTime={setCurrentTime}
          onPauseRecording={onPauseRecording}
          onResumeRecording={onResumeRecording}
          onCancelRecording={onCancelRecording}
          onStopRecording={onStopRecording}
          onPlayPreview={onPlayPreview}
        />
      </div>
    );
  }

  return (
    <div className={styles.voiceRecordingInput}>
      <div className={styles.voiceRecordingTime}>
        {Math.floor((recordingTime || 0) / 60)}:
        {((recordingTime || 0) % 60).toString().padStart(2, '0')}
      </div>
    </div>
  );
}
