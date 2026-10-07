import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { fetchChatFileBlob } from '@/shared/lib/chat/fetchChatFileBlob';
import styles from './index.module.css';

export default function VideoNoteMessage({ fileUrl, isOwn }) {
  const videoRef = useRef(null);
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchChatFileBlob(fileUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить кружок');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  const toggle = async (event) => {
    event.stopPropagation();
    if (!videoRef.current || !src) return;
    if (videoRef.current.paused) {
      try {
        await videoRef.current.play();
      } catch {
        setError('Не удалось воспроизвести кружок');
      }
    } else {
      videoRef.current.pause();
    }
  };

  return (
    <div
      className={`${styles.videoNote} ${isOwn ? styles.own : ''}`}
      style={{ '--video-note-progress': `${progress * 360}deg` }}
      data-testid="chat-video-note"
    >
      <button
        type="button"
        onClick={toggle}
        className={styles.videoButton}
        aria-label={playing ? 'Пауза' : 'Воспроизвести видеокружок'}
      >
        {src && (
          <video
            ref={videoRef}
            src={src}
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setProgress(0);
            }}
            onTimeUpdate={(event) => {
              const current = event.currentTarget;
              setProgress(current.duration ? current.currentTime / current.duration : 0);
            }}
          />
        )}
        <span
          className={`${styles.videoOverlay} ${loading || !playing ? styles.videoOverlayVisible : ''}`}
        >
          {loading ? (
            <Loader2 size={25} className={styles.spinner} />
          ) : playing ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={25} fill="currentColor" />
          )}
        </span>
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
