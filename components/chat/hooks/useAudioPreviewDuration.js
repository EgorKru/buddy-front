import { useEffect, useState } from 'react';

/**
 * Синхронизирует currentTime и duration с audio-элементом при записи/прослушивании.
 * Возвращает { currentTime, duration } для отображения в UI.
 */
export function useAudioPreviewDuration(audioPreviewRef, isRecording, isLocked, recordingTime) {
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

    const updateDuration = () => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedMetadata = updateDuration;
    const handleDurationChange = updateDuration;
    const handleCanPlay = updateDuration;
    const handleLoadedData = updateDuration;

    updateDuration();

    const interval = setInterval(updateDuration, 500);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      clearInterval(interval);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [audioPreviewRef, isRecording, isLocked, recordingTime]);

  return { currentTime, setCurrentTime, duration, setDuration };
}
