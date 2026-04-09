import AudioWaveform from '@/component/AudioWaveform';
import styles from '@/styles/chat.module.css';

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
}

export function VoiceBarLockedRecordingTime({ recordingTime }) {
  return <div className={styles.voiceRecordingTime}>{formatTime(recordingTime || 0)}</div>;
}

export function VoiceBarLockedWaveform({
  previewBlobUrl,
  waveformDuration,
  audioPreviewRef,
  useExternalAudio,
  onPlayPreview,
  onEnded,
  timeLabel,
}) {
  return (
    <>
      <div className={styles.voiceWaveformPreview}>
        <AudioWaveform
          src={previewBlobUrl}
          style="viridara"
          theme="dark"
          height={50}
          width={240}
          barSpacing={2}
          showControls={false}
          showTimestamp={false}
          showSpeedControl={false}
          showBackground={false}
          primaryColor="#1DB954"
          progressColor="#0d9488"
          initialDuration={waveformDuration}
          externalAudioRef={useExternalAudio ? audioPreviewRef : null}
          onPlay={() => onPlayPreview(true)}
          onPause={() => onPlayPreview(false)}
          onEnded={onEnded}
        />
      </div>
      <div className={styles.voiceRecordingTime}>{timeLabel}</div>
    </>
  );
}

export function getWaveformDuration(duration, recordingTime) {
  return duration > 0 ? duration : recordingTime > 0 ? recordingTime : undefined;
}

export function formatVoiceTime(seconds) {
  return formatTime(seconds);
}
