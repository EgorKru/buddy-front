/**
 * Audio handler hook
 */

import { useEffect } from 'react';

export const useAudioHandlers = (
  audioRef,
  src,
  setIsPlaying,
  setCurrentTime,
  setDuration,
  setProgress
) => {
  useEffect(() => {
    if (!audioRef) return; // Skip if null (external audio)
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const dur = audio.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setProgress(audio.currentTime / dur);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    if (audio.readyState >= 1) {
      const dur = audio.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, [src, audioRef, setIsPlaying, setCurrentTime, setDuration, setProgress]);
};
