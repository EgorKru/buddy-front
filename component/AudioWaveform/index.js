/**
 * AudioWaveform Component
 * A lightweight and customizable React component for rendering
 * interactive audio waveform visualizations from audio files.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatTime } from './utils/formatTime';
import { useAudioHandlers } from './hooks/useAudioHandler';
import { useWaveformData } from './hooks/useWaveFormData';
import { useSpeedControl } from './hooks/useSpeedControl';
import { getThemeStyles } from './styles/themeStyles';
import { renderWaveform } from './components/WaveformRender';
import { SpeedControl } from './components/SpeedControl';

const AudioWaveform = ({
  src,
  style = 'viridara',
  theme = 'dark',
  height = 80,
  width = 600,
  barSpacing = 2,
  primaryColor,
  progressColor,
  backgroundColor,
  showControls = true,
  showTimestamp = true,
  showSpeedControl = true,
  showBackground = true,
  className = '',
  externalAudioRef,
  initialDuration,
  onPlay,
  onPause,
  onEnded,
}) => {
  const internalAudioRef = useRef(null);
  const audioRef = externalAudioRef || internalAudioRef;
  const waveformRef = useRef(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Используем initialDuration если он передан, иначе 0
  const [duration, setDuration] = useState(
    initialDuration && initialDuration > 0 ? initialDuration : 0
  );
  const [progress, setProgress] = useState(0);

  // Обновляем duration когда initialDuration меняется (только если duration еще не установлен из audio)
  useEffect(() => {
    if (initialDuration && initialDuration > 0) {
      setDuration((prevDuration) => {
        // Если duration еще не установлен (0) или равен предыдущему initialDuration, обновляем
        // Но не перезаписываем, если уже есть валидный duration из audio
        if (prevDuration === 0) {
          return initialDuration;
        }
        // Если prevDuration совпадает с предыдущим initialDuration, обновляем на новый
        return initialDuration;
      });
    }
  }, [initialDuration]);

  // Calculate scale factor based on screen size
  useEffect(() => {
    const updateScale = () => {
      const screenWidth = window.innerWidth;
      let scale = 1;

      if (screenWidth <= 320) {
        // Very small phones
        scale = 0.5;
      } else if (screenWidth <= 480) {
        // Mobile phones
        scale = 0.65;
      } else if (screenWidth <= 768) {
        // Small tablets
        scale = 0.8;
      } else if (screenWidth <= 1024) {
        // Tablets
        scale = 0.9;
      }

      setScaleFactor(scale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Scaled dimensions
  const scaledWidth = Math.floor(width * scaleFactor);
  const scaledHeight = Math.floor(height * scaleFactor);
  const scaledBarSpacing = Math.max(1, Math.floor(barSpacing * scaleFactor));

  const speedControlData = useSpeedControl(audioRef);
  const { playbackRate, toggleSpeed } = speedControlData;
  const waveformData = useWaveformData(src, scaledWidth, scaledBarSpacing);

  // Use audio handlers only if not using external audio
  useAudioHandlers(
    externalAudioRef ? null : audioRef,
    src,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setProgress,
    initialDuration
  );

  // Handle external audio callbacks and time updates
  useEffect(() => {
    if (externalAudioRef && audioRef.current) {
      const audio = audioRef.current;
      let animationFrameId = null;
      let isPlayingLocal = false;

      const updateProgress = () => {
        if (audio && isPlayingLocal) {
          const currentTime = audio.currentTime;
          const dur = audio.duration;

          setCurrentTime(currentTime);

          // Используем duration из audio если он валидный, иначе используем initialDuration
          let effectiveDuration =
            dur && isFinite(dur) && dur > 0
              ? dur
              : initialDuration && initialDuration > 0
                ? initialDuration
                : 0;

          if (dur && isFinite(dur) && dur > 0) {
            setDuration(dur);
          } else if (initialDuration && initialDuration > 0) {
            // Сохраняем initialDuration если audio.duration еще не загружен
            setDuration(initialDuration);
          }

          if (effectiveDuration > 0) {
            setProgress(currentTime / effectiveDuration);
          }

          animationFrameId = requestAnimationFrame(updateProgress);
        }
      };

      const handlePlay = () => {
        setIsPlaying(true);
        isPlayingLocal = true;
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(updateProgress);
        }
        if (onPlay) onPlay();
      };

      const handlePause = () => {
        setIsPlaying(false);
        isPlayingLocal = false;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        if (onPause) onPause();
      };

      const handleEnded = () => {
        setIsPlaying(false);
        isPlayingLocal = false;
        setProgress(0);
        setCurrentTime(0);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        if (onEnded) onEnded();
      };

      const onTimeUpdate = () => {
        // Fallback для случаев, когда requestAnimationFrame не работает
        const currentTime = audio.currentTime;
        const dur = audio.duration;
        setCurrentTime(currentTime);

        // Используем duration из audio если он валидный, иначе используем initialDuration
        let effectiveDuration =
          dur && isFinite(dur) && dur > 0
            ? dur
            : initialDuration && initialDuration > 0
              ? initialDuration
              : 0;

        if (dur && isFinite(dur) && dur > 0) {
          setDuration(dur);
        } else if (initialDuration && initialDuration > 0) {
          setDuration(initialDuration);
        }

        if (effectiveDuration > 0) {
          setProgress(currentTime / effectiveDuration);
        }
      };

      const onLoadedMetadata = () => {
        const dur = audio.duration;
        if (dur && isFinite(dur) && dur > 0) {
          setDuration(dur);
        }
      };

      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);

      // Initial check - используем initialDuration если audio.duration еще не загружен
      if (audio.readyState >= 1) {
        const dur = audio.duration;
        if (dur && isFinite(dur) && dur > 0) {
          setDuration(dur);
        } else if (initialDuration && initialDuration > 0) {
          setDuration(initialDuration);
        }
      } else if (initialDuration && initialDuration > 0) {
        // Устанавливаем initialDuration сразу, если audio еще не загружен
        setDuration(initialDuration);
      }

      // Проверяем начальное состояние
      if (!audio.paused) {
        isPlayingLocal = true;
        animationFrameId = requestAnimationFrame(updateProgress);
      }

      return () => {
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      };
    }
  }, [
    externalAudioRef,
    onPlay,
    onPause,
    onEnded,
    initialDuration,
    setCurrentTime,
    setDuration,
    setProgress,
  ]);

  const themeStyles = getThemeStyles(style, theme, backgroundColor, primaryColor, progressColor);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (externalAudioRef && (onPlay || onPause)) {
      // Use external callbacks
      if (isPlaying) {
        if (onPause) onPause();
      } else {
        if (onPlay) onPlay();
      }
      return;
    }

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleWaveformClick = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration || !isFinite(duration) || duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const containerWidth = rect.width;
    const clickRatio = clickX / containerWidth;
    const newTime = clickRatio * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(clickRatio);
  };

  const containerStyle = {
    backgroundColor: showBackground ? themeStyles.background : 'transparent',
    padding: `0 ${Math.floor(2 * scaleFactor)}px`,
    borderRadius: 0,
    display: 'flex',
    alignItems: 'center',
    gap: `${Math.floor(6 * scaleFactor)}px`,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    minHeight: scaledHeight,
    maxHeight: scaledHeight,
    boxShadow: 'none',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative',
    marginBottom: 0,
    overflow: 'visible',
  };

  const waveformContainerStyle = {
    width: '100%',
    minWidth: 0,
    height: `${scaledHeight}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 1,
    position: 'relative',
    flex: 1,
  };

  const playButtonStyle = {
    ...themeStyles.playButton,
    width: `${Math.floor(36 * scaleFactor)}px`,
    height: `${Math.floor(36 * scaleFactor)}px`,
    minWidth: `${Math.floor(36 * scaleFactor)}px`,
    minHeight: `${Math.floor(36 * scaleFactor)}px`,
    transformOrigin: 'center',
    transition: 'transform 0.2s ease',
  };

  const timestampStyle = {
    ...themeStyles.timestamp,
    width: 'auto',
    textAlign: 'left',
    flexShrink: 0,
    minWidth: `${Math.floor(35 * scaleFactor)}px`,
    fontSize: `${Math.floor(11 * scaleFactor)}px`,
    color: '#6b7280',
    whiteSpace: 'nowrap',
  };

  const iconSize = Math.floor(16 * scaleFactor);

  return (
    <div className={className} style={containerStyle}>
      {!externalAudioRef && <audio ref={audioRef} src={src} preload="metadata" />}

      {showControls && (
        <button
          onClick={togglePlay}
          style={playButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={iconSize} fill={themeStyles.playButtonIcon} />
          ) : (
            <Play size={iconSize} fill={themeStyles.playButtonIcon} style={{ marginLeft: '1px' }} />
          )}
        </button>
      )}

      {showTimestamp && <div style={timestampStyle}>{formatTime(currentTime)}</div>}

      <div style={waveformContainerStyle}>
        <svg
          ref={waveformRef}
          width="100%"
          height={scaledHeight}
          viewBox={`0 0 ${scaledWidth} ${scaledHeight}`}
          preserveAspectRatio="none"
          style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
          onClick={handleWaveformClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {renderWaveform(
            waveformData,
            scaledWidth,
            scaledHeight,
            scaledBarSpacing,
            progress,
            style,
            themeStyles
          )}
        </svg>
      </div>

      {showTimestamp && (
        <div style={timestampStyle}>
          {duration && isFinite(duration) && duration > 0 ? formatTime(duration) : '0:00'}
        </div>
      )}

      {showControls && showSpeedControl && (
        <div style={{ position: 'relative', zIndex: 1000, marginLeft: 'auto', flexShrink: 0 }}>
          <SpeedControl
            playbackRate={playbackRate}
            themeStyles={themeStyles}
            toggleSpeed={toggleSpeed}
          />
        </div>
      )}
    </div>
  );
};

export default AudioWaveform;
