import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from './index.module.css';

export default function ImageMessage({
  fileUrl,
  content,
  messageTime,
  isOwn,
  statusIcon,
  isPinned,
  onImageClick,
}) {
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

    setLoading(true);
    setError(null);
    setImageLoaded(false);
    setImageUrl(null);

    let blobUrl = null;
    let cancelled = false;

    const loadImage = async () => {
      try {
        const url = chatAPI.getImageFileUrl(fileUrl);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          if (response.status === 401) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
            throw new Error('Unauthorized');
          }
          throw new Error(`Failed to load image: ${response.status}`);
        }

        if (cancelled) return;

        const blob = await response.blob();
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        blobUrl = URL.createObjectURL(blob);
        setImageUrl(blobUrl);

        const img = new Image();
        img.onload = () => {
          if (!cancelled) {
            setImageLoaded(true);
            setLoading(false);
          }
        };
        img.onerror = () => {
          if (!cancelled) {
            setError('Не удалось загрузить изображение');
            setLoading(false);
          }
        };
        img.src = blobUrl;
      } catch (err) {
        if (!cancelled) {
          setError('Не удалось загрузить изображение');
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileUrl, shouldLoad]);

  const handleImageClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!onImageClick || !fileUrl) return;

    if (imageUrl) {
      onImageClick(imageUrl, fileUrl);
    } else {
      const url = chatAPI.getImageFileUrl(fileUrl);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(url, { headers })
        .then((response) => {
          if (!response.ok) throw new Error('Failed to load image');
          return response.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          onImageClick(blobUrl, fileUrl);
        })
        .catch((err) => {});
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!fileUrl) return;

    try {
      const url = chatAPI.getImageFileUrl(fileUrl, true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert('Не удалось скачать изображение');
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

  const isEmbedded = !messageTime;

  return (
    <div
      className={`${styles.imageMessage} ${isOwn ? styles.ownMessage : ''} ${isEmbedded ? styles.embedded : ''}`}
      ref={containerRef}
    >
      <div className={`${styles.imageContainer} ${isEmbedded ? styles.embeddedContainer : ''}`}>
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
      {content && content.trim() && <div className={styles.imageCaption}>{content}</div>}
      {messageTime && (
        <div className={styles.imageMeta}>
          {isPinned && (
            <span className={styles.pinnedIcon} title="Закреплено">
              📌
            </span>
          )}
          <span className={styles.messageTime}>{messageTime}</span>
          {statusIcon && <span className={styles.statusIcon}>{statusIcon}</span>}
        </div>
      )}
    </div>
  );
}
