import { useEffect, useRef, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from './index.module.css';

export default function ImageModal({ imageUrl, fileUrl, onClose }) {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('wheel', handleWheel, { passive: false });

    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleDownload = async () => {
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

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3, prev + 0.25));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!imageUrl) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.controlButton}
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              title="Уменьшить"
            >
              <ZoomOut size={20} />
            </button>
            <span className={styles.zoomLevel}>{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className={styles.controlButton}
              onClick={handleZoomIn}
              disabled={scale >= 3}
              title="Увеличить"
            >
              <ZoomIn size={20} />
            </button>
            {scale !== 1 && (
              <button
                type="button"
                className={styles.controlButton}
                onClick={handleResetZoom}
                title="Сбросить масштаб"
              >
                Сброс
              </button>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleDownload}
              title="Скачать"
            >
              <Download size={20} />
            </button>
            <button type="button" className={styles.closeButton} onClick={onClose} title="Закрыть">
              <X size={24} />
            </button>
          </div>
        </div>
        <div
          ref={containerRef}
          className={styles.imageContainer}
          onMouseDown={handleMouseDown}
          style={{
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Изображение"
            className={styles.image}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
