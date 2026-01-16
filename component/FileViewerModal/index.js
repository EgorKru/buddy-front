import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from './index.module.css';

export default function FileViewerModal({ fileUrl, fileName, mimeType, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileUrl) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = chatAPI.getFileUrl(fileUrl, false);
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
          throw new Error(`Failed to load file: ${response.status}`);
        }

        const text = await response.text();
        setContent(text);
      } catch (err) {
        
        setError('Не удалось загрузить файл');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [fileUrl]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleDownload = async () => {
    if (!fileUrl) return;

    try {
      const url = chatAPI.getFileUrl(fileUrl, true, fileName);
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
        throw new Error(`Failed to download file: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      
      alert('Не удалось скачать файл');
    }
  };

  if (!fileUrl) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.fileName}>{fileName || 'Файл'}</div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleDownload}
              title="Скачать"
            >
              <Download size={20} />
            </button>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              title="Закрыть"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        <div className={styles.contentContainer}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          )}
          {error && (
            <div className={styles.error}>
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && (
            <pre className={styles.textContent}>
              <code>{content}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

