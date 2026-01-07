import { useState, useRef, useEffect } from 'react';
import { Download, X, ZoomIn } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from './index.module.css';

export default function ImageMessage({ fileUrl, content, messageTime, isOwn, statusIcon, isPinned, onImageClick }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!fileUrl || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.01,
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!fileUrl || !shouldLoad) {
      return;
    }

    const url = chatAPI.getImageFileUrl(fileUrl);
    setImageUrl(url);
    setLoading(true);
    setError(null);
    setImageLoaded(false);

    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      setLoading(false);
    };
    img.onerror = () => {
      setError('Не удалось загрузить изображение');
      setLoading(false);
    };
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [fileUrl, shouldLoad]);

  const handleImageClick = (e) => {
    e.stopPropagation();
    if (onImageClick && imageUrl) {
      onImageClick(imageUrl, fileUrl);
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (fileUrl) {
      const downloadUrl = chatAPI.getImageFileUrl(fileUrl, true);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (error) {
    return (
      <div className={`${styles.imageMessage} ${isOwn ? styles.ownMessage : ''}`}>
        <div className={styles.errorMessage}>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.imageMessage} ${isOwn ? styles.ownMessage : ''}`} ref={containerRef}>
      <div className={styles.imageContainer}>
        {loading && shouldLoad && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
          </div>
        )}
        {!shouldLoad && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
          </div>
        )}
        {imageUrl && shouldLoad && (
          <>
            <img
              ref={imgRef}
              src={imageUrl}
              alt={content || 'Изображение'}
              className={`${styles.image} ${imageLoaded ? styles.loaded : ''}`}
              onClick={handleImageClick}
              loading="lazy"
              onError={() => {
                setError('Не удалось загрузить изображение');
                setLoading(false);
              }}
            />
            <div className={styles.imageOverlay}>
              <button
                type="button"
                className={styles.zoomButton}
                onClick={handleImageClick}
                title="Увеличить"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                className={styles.downloadButton}
                onClick={handleDownload}
                title="Скачать"
              >
                <Download size={18} />
              </button>
            </div>
          </>
        )}
      </div>
      {content && content.trim() && (
        <div className={styles.imageCaption}>
          {content}
        </div>
      )}
      <div className={styles.imageMeta}>
        {isPinned && (
          <span className={styles.pinnedIcon} title="Закреплено">📌</span>
        )}
        <span className={styles.messageTime}>{messageTime}</span>
        {statusIcon && (
          <span className={styles.statusIcon}>{statusIcon}</span>
        )}
      </div>
    </div>
  );
}

