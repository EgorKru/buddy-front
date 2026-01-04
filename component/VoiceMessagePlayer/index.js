import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { chatAPI, getToken } from '@/utils/api';
import styles from './index.module.css';

export default function VoiceMessagePlayer({ fileUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoadedMetadata = () => {
      setIsLoading(false);
    };
    const handleError = () => {
      setIsLoading(false);
      setError('Не удалось загрузить аудио');
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      // Очищаем Blob URL при размонтировании
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const loadAudioWithAuth = async () => {
    const url = chatAPI.getVoiceFileUrl(fileUrl);
    const token = getToken();
    
    if (typeof window !== 'undefined') {
      console.log('[VoicePlayer] Loading audio with auth:', { 
        url, 
        fileUrl,
        hasToken: !!token 
      });
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      // Попробуем получить текст ошибки от сервера
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error body';
      }
      
      if (typeof window !== 'undefined') {
        console.error('[VoicePlayer] Server error:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
      }
      
      throw new Error(`Failed to load audio: ${response.status} - ${errorText || response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;
    
    if (typeof window !== 'undefined') {
      console.log('[VoicePlayer] Audio loaded, blob URL created, size:', blob.size);
    }
    
    return blobUrl;
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src) {
      setIsLoading(true);
      setError(null);
      try {
        const blobUrl = await loadAudioWithAuth();
        audio.src = blobUrl;
      } catch (err) {
        if (typeof window !== 'undefined') {
          console.error('[VoicePlayer] Failed to load audio:', err);
        }
        setIsLoading(false);
        setError('Не удалось загрузить аудио');
        return;
      }
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        if (typeof window !== 'undefined') {
          console.error('[VoicePlayer] Failed to play audio:', err);
        }
        setIsLoading(false);
        setError('Не удалось воспроизвести');
      }
    }
  };

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioRef.current?.duration
    ? (currentTime / audioRef.current.duration) * 100
    : 0;

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
          <Pause size={16} />
        ) : (
          <Play size={16} />
        )}
      </button>
      <div className={styles.voiceInfo}>
        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.duration}>
              {formatTime(currentTime || 0)} / {formatTime(duration || audioRef.current?.duration || 0)}
            </div>
          </>
        )}
      </div>
      <audio ref={audioRef} preload="none" />
    </div>
  );
}

