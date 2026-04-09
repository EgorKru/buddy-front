import { useCallback, useMemo } from 'react';
import { Lock, Trash2, Pause, Mic, Headphones, Send } from 'lucide-react';
import {
  VoiceBarLockedRecordingTime,
  VoiceBarLockedWaveform,
  getWaveformDuration,
  formatVoiceTime,
} from './VoiceBarLockedContent';
import styles from '@/styles/chat.module.css';

const PREVIEW_PLAY_TIMEOUT_MS = 3000;

async function playPreviewAudio(audioRef, onPlayPreview) {
  const audio = audioRef?.current;
  if (!audio?.src?.startsWith('blob:')) return;

  audio.currentTime = 0;
  if (audio.readyState < 2) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), PREVIEW_PLAY_TIMEOUT_MS);
      const onCanPlay = () => {
        clearTimeout(timeout);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        resolve();
      };
      const onError = (e) => {
        clearTimeout(timeout);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        reject(e);
      };
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);
      audio.load();
    });
  }
  audio.currentTime = 0;
  await audio.play();
  onPlayPreview(true);
}

export function VoiceBarLocked({
  recordingTime,
  isPaused,
  isPlayingPreview,
  duration,
  currentTime,
  previewBlobUrl,
  audioPreviewRef,
  onPauseRecording,
  onResumeRecording,
  onCancelRecording,
  onStopRecording,
  onPlayPreview,
  setCurrentTime,
}) {
  const handleTogglePauseOrPlay = useCallback(() => {
    if (isPaused) {
      if (isPlayingPreview && audioPreviewRef?.current) {
        audioPreviewRef.current.pause();
        onPlayPreview(false);
      }
      onResumeRecording();
    } else {
      onPauseRecording();
    }
  }, [
    isPaused,
    isPlayingPreview,
    audioPreviewRef,
    onPlayPreview,
    onResumeRecording,
    onPauseRecording,
  ]);

  const handlePlayPreviewClick = useCallback(async () => {
    if (!audioPreviewRef?.current) return;
    try {
      if (isPlayingPreview) {
        audioPreviewRef.current.pause();
        onPlayPreview(false);
      } else {
        await playPreviewAudio(audioPreviewRef, onPlayPreview);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      onPlayPreview(false);
    }
  }, [audioPreviewRef, isPlayingPreview, onPlayPreview]);

  const handleWaveformEnded = useCallback(() => {
    if (audioPreviewRef?.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    onPlayPreview(false);
  }, [audioPreviewRef, setCurrentTime, onPlayPreview]);

  const waveformDuration = getWaveformDuration(duration, recordingTime);

  const timeLabelRecording = useMemo(
    () =>
      duration > 0
        ? `${formatVoiceTime(recordingTime || 0)} / ${formatVoiceTime(duration)}`
        : formatVoiceTime(recordingTime || 0),
    [duration, recordingTime]
  );
  const timeLabelPlaying = useMemo(
    () =>
      duration > 0
        ? `${formatVoiceTime(currentTime)} / ${formatVoiceTime(duration)}`
        : formatVoiceTime(recordingTime || 0),
    [duration, currentTime, recordingTime]
  );

  return (
    <>
      <div className={styles.voiceLockIcon}>
        <Lock size={16} />
      </div>
      <button
        type="button"
        onClick={onCancelRecording}
        className={styles.voiceDeleteButton}
        title="Удалить запись"
      >
        <Trash2 size={18} />
      </button>
      <button
        type="button"
        onClick={handleTogglePauseOrPlay}
        className={styles.voiceActionButton}
        title={isPaused ? 'Возобновить запись' : 'Приостановить запись'}
      >
        {isPaused ? <Mic size={18} /> : <Pause size={18} />}
      </button>

      {isPaused && (
        <button
          type="button"
          onClick={handlePlayPreviewClick}
          className={styles.voicePlayButton}
          title={isPlayingPreview ? 'Пауза прослушивания' : 'Прослушать запись'}
        >
          {isPlayingPreview ? <Pause size={18} /> : <Headphones size={18} />}
        </button>
      )}

      {!isPaused && !isPlayingPreview && (
        <VoiceBarLockedRecordingTime recordingTime={recordingTime} />
      )}

      {isPaused && !isPlayingPreview && (
        <VoiceBarLockedWaveform
          previewBlobUrl={previewBlobUrl}
          waveformDuration={waveformDuration}
          audioPreviewRef={null}
          useExternalAudio={false}
          onPlayPreview={onPlayPreview}
          onEnded={handleWaveformEnded}
          timeLabel={timeLabelRecording}
        />
      )}

      {isPlayingPreview && (
        <VoiceBarLockedWaveform
          previewBlobUrl={previewBlobUrl}
          waveformDuration={waveformDuration}
          audioPreviewRef={audioPreviewRef}
          useExternalAudio
          onPlayPreview={onPlayPreview}
          onEnded={handleWaveformEnded}
          timeLabel={timeLabelPlaying}
        />
      )}

      <button
        type="button"
        onClick={onStopRecording}
        className={styles.voiceSendButton}
        title="Отправить запись"
      >
        <Send size={18} />
      </button>
    </>
  );
}
