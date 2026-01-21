/**
 * Audio handler hook
 */

import { useEffect, useRef } from 'react';

export const useAudioHandlers = (
  audioRef,
  src,
  setIsPlaying,
  setCurrentTime,
  setDuration,
  setProgress,
  initialDuration
) => {
  const animationFrameRef = useRef(null);
  const isPlayingRef = useRef(false);
  const durationRef = useRef(initialDuration && initialDuration > 0 ? initialDuration : 0);

  useEffect(() => {
    if (!audioRef) return; // Skip if null (external audio)
    const audio = audioRef.current;
    if (!audio) return;

    // Обновляем ref при изменении initialDuration
    if (initialDuration && initialDuration > 0) {
      durationRef.current = initialDuration;
    }

    const updateProgress = () => {
      if (audio && isPlayingRef.current) {
        const currentTime = audio.currentTime;
        const dur = audio.duration;
        
        setCurrentTime(currentTime);
        
        // Используем duration из audio если он валидный, иначе используем initialDuration из ref
        let effectiveDuration = dur && isFinite(dur) && dur > 0 ? dur : durationRef.current;
        
        if (dur && isFinite(dur) && dur > 0) {
          durationRef.current = dur;
          setDuration(dur);
        } else if (durationRef.current > 0) {
          setDuration(durationRef.current);
        }
        
        if (effectiveDuration > 0) {
          setProgress(currentTime / effectiveDuration);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      if (dur && isFinite(dur) && dur > 0) {
        durationRef.current = dur;
        setDuration(dur);
      } else if (initialDuration && initialDuration > 0) {
        durationRef.current = initialDuration;
        setDuration(initialDuration);
      }
    };

    const onTimeUpdate = () => {
      // Fallback для случаев, когда requestAnimationFrame не работает
      const currentTime = audio.currentTime;
      const dur = audio.duration;
      setCurrentTime(currentTime);
      
      // Используем duration из audio если он валидный, иначе используем initialDuration из ref
      let effectiveDuration = dur && isFinite(dur) && dur > 0 ? dur : durationRef.current;
      
      if (dur && isFinite(dur) && dur > 0) {
        durationRef.current = dur;
        setDuration(dur);
      } else if (durationRef.current > 0) {
        setDuration(durationRef.current);
      }
      
      if (effectiveDuration > 0) {
        setProgress(currentTime / effectiveDuration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setProgress(0);
      setCurrentTime(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const onPause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      // Запускаем плавное обновление через requestAnimationFrame
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    if (audio.readyState >= 1) {
      const dur = audio.duration;
      if (dur && isFinite(dur) && dur > 0) {
        durationRef.current = dur;
        setDuration(dur);
      } else if (initialDuration && initialDuration > 0) {
        durationRef.current = initialDuration;
        setDuration(initialDuration);
      }
    } else if (initialDuration && initialDuration > 0) {
      // Устанавливаем initialDuration сразу, если audio еще не загружен
      durationRef.current = initialDuration;
      setDuration(initialDuration);
    }

    // Проверяем начальное состояние
    if (!audio.paused) {
      isPlayingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [src, audioRef, setIsPlaying, setCurrentTime, setDuration, setProgress, initialDuration]);
};
