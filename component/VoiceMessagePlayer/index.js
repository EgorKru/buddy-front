import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from './index.module.css';

export default function VoiceMessagePlayer({ fileUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

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

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src) {
      setIsLoading(true);
      const url = chatAPI.getVoiceFileUrl(fileUrl);
      audio.src = url;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        setIsLoading(false);
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
        title={isPlaying ? 'Пауза' : 'Воспроизвести'}
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
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={styles.duration}>
          {formatTime(currentTime || 0)} / {formatTime(duration || audioRef.current?.duration || 0)}
        </div>
      </div>
      <audio ref={audioRef} preload="none" />
    </div>
  );
}

