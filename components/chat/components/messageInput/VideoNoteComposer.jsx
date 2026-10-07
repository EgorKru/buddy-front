import { useEffect, useRef } from 'react';
import { Send, Trash2, Video } from 'lucide-react';
import styles from '@/styles/chat.module.css';

const formatDuration = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function VideoNoteComposer({ videoNote }) {
  const previewRef = useRef(null);

  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.srcObject = videoNote.stream || null;
  }, [videoNote.stream]);

  return (
    <div className={styles.videoNoteComposer} data-testid="video-note-composer">
      <div className={styles.videoNotePreviewShell}>
        <video ref={previewRef} autoPlay muted playsInline className={styles.videoNotePreview} />
        <span className={styles.videoNoteRecordDot} />
      </div>
      <div className={styles.videoNoteRecordingInfo}>
        <span className={styles.videoNoteRecordingLabel}>
          <Video size={15} /> Видеокружок
        </span>
        <strong>{formatDuration(videoNote.duration)}</strong>
        <span>До минуты · камера и звук</span>
      </div>
      <div className={styles.videoNoteWave} aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <i
            key={index}
            style={{
              '--wave-index': index,
              '--wave-min': `${7 + (index % 4) * 4}px`,
              '--wave-max': `${12 + (index % 5) * 5}px`,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className={styles.videoNoteCancel}
        onClick={videoNote.cancel}
        aria-label="Удалить видеокружок"
      >
        <Trash2 size={20} />
      </button>
      <button
        type="button"
        className={styles.videoNoteSend}
        onClick={videoNote.send}
        aria-label="Отправить видеокружок"
      >
        <Send size={20} />
      </button>
    </div>
  );
}
