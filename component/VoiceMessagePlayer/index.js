import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, Pin } from 'lucide-react';
import { chatAPI, getToken } from '@/utils/api';
import { useVoicePlayer } from '@/context/voicePlayer';
import styles from './index.module.css';

// Генерация псевдо-waveform из размера файла (пока нет реальных данных)
const generateWaveform = (seed, barCount = 40) => {
  const bars = [];
  // Используем seed для псевдо-случайных, но стабильных значений
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  for (let i = 0; i < barCount; i++) {
    // Псевдо-случайное значение от 15% до 100% высоты
    const val = Math.abs(Math.sin(hash * (i + 1) * 0.1)) * 0.85 + 0.15;
    bars.push(val);
    hash = ((hash << 5) - hash) + i;
  }
  
  return bars;
};

export default function VoiceMessagePlayer({ fileUrl, duration: propDuration, messageTime, isOwn, statusIcon, isPinned }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(propDuration || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  
  // Уникальный ID для этого плеера
  const playerIdRef = useRef(fileUrl || `player-${Date.now()}-${Math.random()}`);
  const { activePlayerId, registerPlayer, unregisterPlayer } = useVoicePlayer();

  // Генерируем waveform на основе fileUrl (стабильный для одного файла)
  const waveform = useMemo(() => {
    return generateWaveform(fileUrl || 'default', 35);
  }, [fileUrl]);

  // Функция остановки воспроизведения
  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  // Если другой плеер стал активным - останавливаем этот
  useEffect(() => {
    if (activePlayerId && activePlayerId !== playerIdRef.current && isPlaying) {
      stopPlayback();
    }
  }, [activePlayerId, isPlaying, stopPlayback]);

  // Используем propDuration если передан (от бэкенда)
  useEffect(() => {
    if (propDuration && propDuration > 0) {
      setAudioDuration(propDuration);
    }
  }, [propDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      unregisterPlayer(playerIdRef.current);
    };
    const handleLoadedMetadata = () => {
      setIsLoading(false);
      const dur = audio.duration;
      if (dur && Number.isFinite(dur) && dur > 0) {
        setAudioDuration(dur);
      }
    };
    const handleDurationChange = () => {
      const dur = audio.duration;
      if (dur && Number.isFinite(dur) && dur > 0) {
        setAudioDuration(dur);
      }
    };
    const handleError = () => {
      setIsLoading(false);
      setError('Не удалось загрузить');
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('error', handleError);
      // Очищаем blob URL только при размонтировании компонента
      // и только если audio не играет
      if (blobUrlRef.current && !isPlaying) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [unregisterPlayer]);

  const loadAudioWithAuth = async () => {
    const url = chatAPI.getVoiceFileUrl(fileUrl);
    const token = getToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;
    
    return blobUrl;
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src) {
      if (blobUrlRef.current) {
        audio.src = blobUrlRef.current;
      } else {
        setIsLoading(true);
        setError(null);
        try {
          const blobUrl = await loadAudioWithAuth();
          audio.src = blobUrl;
        } catch (err) {
          setIsLoading(false);
          setError('Не удалось загрузить');
          return;
        }
      }
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      unregisterPlayer(playerIdRef.current);
    } else {
      // Регистрируем этот плеер как активный (остановит другие)
      registerPlayer(playerIdRef.current, stopPlayback);
      
      try {
        audio.playbackRate = playbackRate;
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        setIsLoading(false);
        setError('Ошибка воспроизведения');
        unregisterPlayer(playerIdRef.current);
      }
    }
  };

  const handleWaveformClick = (e) => {
    if (!audioDuration || audioDuration <= 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audioDuration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackRate(newSpeed);
    
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) : 0;
  const playedBars = Math.floor(progress * waveform.length);

  return (
    <div className={styles.voiceMessage}>
      <button
        type="button"
        onClick={togglePlay}
        className={styles.playButton}
        disabled={isLoading}
        title={error || (isPlaying ? 'Пауза' : 'Воспроизвести')}
      >
        {isLoading ? (
          <div className={styles.spinner} />
        ) : isPlaying ? (
          <Pause size={20} />
        ) : (
          <Play size={20} />
        )}
      </button>
      
      <div className={styles.voiceContent}>
        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            <div 
              className={styles.waveformContainer}
              onClick={handleWaveformClick}
              title="Нажмите для перемотки"
            >
              {waveform.map((height, index) => (
                <div
                  key={index}
                  className={`${styles.waveformBar} ${index < playedBars ? styles.played : ''}`}
                  style={{ height: `${height * 100}%` }}
                />
              ))}
            </div>
            
            <div className={styles.timeRow}>
              <span className={styles.currentTime}>
                {isPlaying || currentTime > 0 
                  ? formatTime(currentTime) 
                  : formatTime(audioDuration)}
              </span>
              
              {playbackRate !== 1 && (
                <button 
                  type="button"
                  className={styles.speedButton}
                  onClick={toggleSpeed}
                  title="Изменить скорость"
                >
                  {playbackRate}×
                </button>
              )}
              
              <div className={styles.messageStatus}>
                {isPinned && (
                  <Pin size={12} className={styles.pinnedIcon} title="Закреплено" />
                )}
                {messageTime && (
                  <span className={styles.messageTime}>{messageTime}</span>
                )}
                {isOwn && statusIcon}
              </div>
            </div>
          </>
        )}
      </div>
      
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
